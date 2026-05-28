/**
 * GET /auth/callback?code=...&next=/account
 *
 * Supabase redirects here after the user clicks the magic link in their
 * email (or completes the Google OAuth dance). We exchange the temporary
 * `code` for a real session (which lands in cookies via @supabase/ssr),
 * then bounce to `next` — usually /account, or /pricing if the user was
 * mid-checkout.
 */
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";
  const errorParam = url.searchParams.get("error_description");

  // Magic-link errors (expired link, etc.) bounce back here without `code`.
  if (errorParam) {
    const back = new URL("/login", env.SITE_URL);
    back.searchParams.set("error", errorParam);
    return NextResponse.redirect(back);
  }

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const back = new URL("/login", env.SITE_URL);
      back.searchParams.set("error", error.message);
      return NextResponse.redirect(back);
    }
  }

  // Only allow same-origin redirects in `next` to prevent open-redirect abuse.
  const safeNext = next.startsWith("/") ? next : "/account";
  return NextResponse.redirect(new URL(safeNext, env.SITE_URL));
}
