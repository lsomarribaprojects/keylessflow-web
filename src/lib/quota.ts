/**
 * Per-user quota + trial state for /api/transcribe.
 *
 * Centralised so the API route stays focused on multipart parsing + Groq
 * forwarding, and so future endpoints (e.g. an in-app "usage left" call)
 * can reuse the same logic.
 *
 * Tiers:
 *   - free / trialing   → 8h/mo cap, hard-blocks at trial_ends_at
 *   - pro / team        → 50h/mo soft cap (informational; we still serve)
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { ProfileRow, SubscriptionRow } from "@/lib/supabase/database.types";

export const FREE_QUOTA_SECONDS = 8 * 60 * 60;       // 8h / mo
export const PRO_SOFT_CAP_SECONDS = 50 * 60 * 60;    // 50h / mo (informational)

export type QuotaDecision =
  | { allowed: true; plan: string; seconds_used: number; seconds_cap: number; warn?: string }
  | {
      allowed: false;
      reason:
        | "trial_expired"
        | "free_quota_exceeded"
        | "subscription_inactive"
        | "no_profile";
      upgrade_url: string;
      seconds_used?: number;
      seconds_cap?: number;
    };

type Admin = ReturnType<typeof createAdminClient>;

export async function checkQuotaAndConsume(
  admin: Admin,
  userId: string,
  siteUrl: string,
): Promise<QuotaDecision> {
  // Pull profile (trial dates) + subscription in two parallel queries.
  const [profileRes, subRes] = await Promise.all([
    admin
      .from("profiles")
      .select("trial_ends_at")
      .eq("id", userId)
      .single(),
    admin
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", userId)
      .single(),
  ]);

  const profile = profileRes.data as Pick<ProfileRow, "trial_ends_at"> | null;
  const sub = subRes.data as Pick<SubscriptionRow, "plan" | "status"> | null;
  if (!sub) {
    return {
      allowed: false,
      reason: "no_profile",
      upgrade_url: `${siteUrl}/signup`,
    };
  }

  const plan = sub.plan;
  const isPaid =
    (plan === "pro" || plan === "team") &&
    (sub.status === "active" || sub.status === "trialing");

  // ----- Paid path: serve, log soft-cap warning if relevant -----
  if (isPaid) {
    const usage = await sumSecondsThisMonth(admin, userId);
    const warn =
      usage > PRO_SOFT_CAP_SECONDS
        ? `over soft cap (${Math.round(usage / 3600)}h / ${PRO_SOFT_CAP_SECONDS / 3600}h)`
        : undefined;
    return {
      allowed: true,
      plan,
      seconds_used: usage,
      seconds_cap: PRO_SOFT_CAP_SECONDS,
      warn,
    };
  }

  // ----- Free path: trial must be alive AND under 8h/mo -----
  if (plan !== "free") {
    return {
      allowed: false,
      reason: "subscription_inactive",
      upgrade_url: `${siteUrl}/pricing`,
    };
  }

  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialAlive = trialEnd && trialEnd.getTime() > Date.now();
  if (!trialAlive) {
    return {
      allowed: false,
      reason: "trial_expired",
      upgrade_url: `${siteUrl}/pricing?promo=trial-ended`,
    };
  }

  const usage = await sumSecondsThisMonth(admin, userId);
  if (usage >= FREE_QUOTA_SECONDS) {
    return {
      allowed: false,
      reason: "free_quota_exceeded",
      seconds_used: usage,
      seconds_cap: FREE_QUOTA_SECONDS,
      upgrade_url: `${siteUrl}/pricing?promo=quota-hit`,
    };
  }

  return {
    allowed: true,
    plan: "free",
    seconds_used: usage,
    seconds_cap: FREE_QUOTA_SECONDS,
  };
}

export type AccessDecision =
  | { allowed: true; plan: string }
  | {
      allowed: false;
      reason: "no_profile" | "subscription_inactive" | "trial_expired";
      upgrade_url: string;
    };

/**
 * Lighter gate for non-audio endpoints (e.g. /api/llm cleanup + transforms).
 * Same plan/trial logic as checkQuotaAndConsume but WITHOUT counting audio
 * seconds — LLM calls are cheap and shouldn't be blocked by the 8h audio cap.
 */
export async function checkAccess(
  admin: Admin,
  userId: string,
  siteUrl: string,
): Promise<AccessDecision> {
  const [profileRes, subRes] = await Promise.all([
    admin.from("profiles").select("trial_ends_at").eq("id", userId).single(),
    admin.from("subscriptions").select("plan,status").eq("user_id", userId).single(),
  ]);
  const profile = profileRes.data as Pick<ProfileRow, "trial_ends_at"> | null;
  const sub = subRes.data as Pick<SubscriptionRow, "plan" | "status"> | null;
  if (!sub) {
    return { allowed: false, reason: "no_profile", upgrade_url: `${siteUrl}/signup` };
  }
  const isPaid =
    (sub.plan === "pro" || sub.plan === "team") &&
    (sub.status === "active" || sub.status === "trialing");
  if (isPaid) return { allowed: true, plan: sub.plan };
  if (sub.plan !== "free") {
    return { allowed: false, reason: "subscription_inactive", upgrade_url: `${siteUrl}/pricing` };
  }
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialAlive = trialEnd !== null && trialEnd.getTime() > Date.now();
  if (!trialAlive) {
    return { allowed: false, reason: "trial_expired", upgrade_url: `${siteUrl}/pricing?promo=trial-ended` };
  }
  return { allowed: true, plan: "free" };
}

async function sumSecondsThisMonth(admin: Admin, userId: string): Promise<number> {
  // Use the view we created in schema.sql for an O(1) lookup.
  const res = await admin
    .from("usage_current_month")
    .select("seconds_this_month")
    .eq("user_id", userId)
    .maybeSingle();
  const row = res.data as { seconds_this_month: number } | null;
  return row?.seconds_this_month ?? 0;
}
