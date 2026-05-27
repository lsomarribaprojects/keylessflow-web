-- =============================================================================
-- KeyLess Flow — initial Supabase schema
-- =============================================================================
-- Run in Supabase: SQL Editor → New query → paste this → Run.
-- Idempotent: safe to re-run; uses IF NOT EXISTS / CREATE OR REPLACE.
--
-- Tables:
--   profiles        — public per-user row, 1:1 with auth.users
--   subscriptions   — Stripe subscription state mirrored locally
--   usage_logs      — every /api/transcribe call (for quota + analytics)
--
-- Row Level Security is enabled everywhere; the service-role key in the
-- backend bypasses RLS for admin writes (webhook handler, usage tracker).

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    email         text unique not null,
    display_name  text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "users update own profile"
    on public.profiles for update
    using (auth.uid() = id);

-- Auto-create a profile row when a new auth.users entry appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- subscriptions  (1:1 with profiles)
-- -----------------------------------------------------------------------------
create type subscription_plan as enum ('free', 'pro', 'team');
create type subscription_status as enum (
    'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete'
);

create table if not exists public.subscriptions (
    user_id                   uuid primary key references public.profiles(id) on delete cascade,
    plan                      subscription_plan not null default 'free',
    status                    subscription_status not null default 'active',
    stripe_customer_id        text unique,
    stripe_subscription_id    text unique,
    current_period_end        timestamptz,
    cancel_at_period_end      boolean not null default false,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "users read own subscription"
    on public.subscriptions for select
    using (auth.uid() = user_id);
-- All writes go through the service-role key in the Stripe webhook handler.

-- Seed a free subscription for any new profile.
create or replace function public.handle_new_profile_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.subscriptions (user_id, plan, status)
    values (new.id, 'free', 'active')
    on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
    after insert on public.profiles
    for each row execute function public.handle_new_profile_subscription();

-- -----------------------------------------------------------------------------
-- usage_logs  (1 row per transcription request)
-- -----------------------------------------------------------------------------
create table if not exists public.usage_logs (
    id                bigserial primary key,
    user_id           uuid not null references public.profiles(id) on delete cascade,
    seconds_audio     int not null,            -- audio length in seconds
    bytes_upload      int not null,            -- request payload size
    model             text not null,           -- groq model used
    elapsed_ms        int,                     -- end-to-end server time
    success           boolean not null default true,
    error_message     text,
    created_at        timestamptz not null default now()
);

create index if not exists usage_logs_user_created_idx
    on public.usage_logs (user_id, created_at desc);

alter table public.usage_logs enable row level security;

create policy "users read own usage"
    on public.usage_logs for select
    using (auth.uid() = user_id);
-- Writes only via service role.

-- Convenience view: current month usage per user (for quota checks).
create or replace view public.usage_current_month as
select
    user_id,
    sum(seconds_audio)::int as seconds_this_month,
    count(*)::int           as requests_this_month
from public.usage_logs
where created_at >= date_trunc('month', now())
group by user_id;
