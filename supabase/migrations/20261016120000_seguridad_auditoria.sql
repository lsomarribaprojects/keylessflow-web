-- =============================================================================
-- Auditoría de seguridad 2026-10 (idempotente; se puede correr varias veces)
-- Aplicar: Supabase → SQL Editor, o `supabase db push`.
-- =============================================================================

-- 1) D3 · La policy "users update own profile" deja que un usuario edite SU fila
--    completa con la anon key (p. ej. trial_ends_at = 2099 → trial infinito).
--    Trigger: solo el service_role (servidor) puede cambiar los campos de cuota/identidad.
create or replace function public.bloquear_campos_privilegiados()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if coalesce(auth.role(), '') <> 'service_role'
       and (new.id                        is distinct from old.id
         or new.email                     is distinct from old.email
         or new.trial_ends_at             is distinct from old.trial_ends_at
         or new.trial_promo_email_sent_at is distinct from old.trial_promo_email_sent_at
         or new.created_at                is distinct from old.created_at) then
        raise exception 'No puedes cambiar campos privilegiados de tu perfil';
    end if;
    return new;
end;
$$;

drop trigger if exists bloquear_campos_privilegiados on public.profiles;
create trigger bloquear_campos_privilegiados
    before update on public.profiles
    for each row execute function public.bloquear_campos_privilegiados();

-- Plan / estado / cuota viven en subscriptions y usage_logs: sin policy de
-- escritura para usuarios (solo service_role). Se deja explícito con WITH CHECK
-- en la policy de profiles para que nadie mueva su fila a otro id.
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
    on public.profiles for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- 2) X7 · search_path fijo en funciones security definer.
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.handle_new_profile_subscription() set search_path = public, pg_temp;

-- 3) X7 · La vista usage_current_month corría con permisos del dueño (se salta RLS):
--    con la anon key cualquiera leía el uso de TODOS los usuarios. La app solo la lee
--    con el service_role, así que security_invoker no rompe nada.
alter view if exists public.usage_current_month set (security_invoker = true);
