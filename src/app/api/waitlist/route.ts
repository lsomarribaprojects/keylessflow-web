/**
 * POST /api/waitlist
 *   body: { email: string, platform: 'mac' | 'linux', source?: string }
 *
 * Captures intent for builds we haven't shipped yet. Public endpoint (no
 * auth required) — the only abuse vector is spamming with fake emails,
 * which we accept since the cost is tiny and we'd rather have lower
 * friction than a captcha.
 *
 * Idempotent: re-submitting the same (email, platform) returns 200 without
 * a DB error (we use upsert-on-conflict).
 */
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import type { WaitlistPlatform } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PLATFORMS: WaitlistPlatform[] = ["mac", "linux"];

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    platform?: string;
    source?: string;
  };

  const email = (body.email ?? "").trim().toLowerCase();
  const platform = (body.platform ?? "").trim() as WaitlistPlatform;
  const source = (body.source ?? "landing").trim().slice(0, 64);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("waitlist")
    .upsert(
      { email, platform, source } as never,
      { onConflict: "email,platform", ignoreDuplicates: false },
    );

  if (error) {
    console.error("[waitlist] insert failed:", error);
    return NextResponse.json({ error: "store_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, platform });
}
