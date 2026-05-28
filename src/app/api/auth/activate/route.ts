/**
 * POST /api/auth/activate
 *   body: { code: "KF-XXXX-XXXX-XXXX" }
 *
 * Desktop "Conectar con cuenta Pro" flow: the user copies the code from
 * /account and pastes it into the app. We reverse the format to a UUID
 * prefix, find the matching user, verify they have a paid subscription,
 * and return a long-lived HMAC token the desktop app stores in
 * %APPDATA%\KeyLessFlow\auth.json.
 *
 * Returns:
 *   200 { token, email, plan, expires_at }
 *   400 { error: "bad_code_format" }
 *   404 { error: "code_not_found" }
 *   402 { error: "subscription_required" }
 */
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/supabase/database.types";
import { mintDesktopToken, DESKTOP_TOKEN_TTL_SECONDS } from "@/lib/desktop-token";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").trim().toUpperCase();

  // Format: KF-XXXX-XXXX-XXXX where each X is hex from the user UUID.
  const match = code.match(/^KF-([0-9A-F]{4})-([0-9A-F]{4})-([0-9A-F]{4})$/);
  if (!match) {
    return NextResponse.json({ error: "bad_code_format" }, { status: 400 });
  }
  const uuidPrefix = `${match[1]}${match[2]}${match[3]}`.toLowerCase();

  // Find the user whose UUID starts with these 12 hex chars.
  // Random UUIDv4 → 12-hex prefix collision odds ~1 in 280 trillion.
  // For >1000 users we'd switch to a dedicated activation_codes table.
  const admin = createAdminClient();
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    return NextResponse.json({ error: "auth_lookup_failed" }, { status: 500 });
  }

  const user = users.users.find((u) =>
    u.id.replace(/-/g, "").toLowerCase().startsWith(uuidPrefix),
  );
  if (!user) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }

  // Verify subscription
  const subResult = await admin
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", user.id)
    .single();
  const sub = subResult.data as Pick<SubscriptionRow, "plan" | "status"> | null;
  const isPaid =
    sub &&
    (sub.plan === "pro" || sub.plan === "team") &&
    (sub.status === "active" || sub.status === "trialing");
  if (!isPaid) {
    return NextResponse.json(
      {
        error: "subscription_required",
        upgrade_url: `${env.SITE_URL}/pricing`,
      },
      { status: 402 },
    );
  }

  const token = mintDesktopToken(user.id);
  return NextResponse.json({
    token,
    email: user.email,
    plan: sub.plan,
    expires_at: new Date(
      Date.now() + DESKTOP_TOKEN_TTL_SECONDS * 1000,
    ).toISOString(),
  });
}
