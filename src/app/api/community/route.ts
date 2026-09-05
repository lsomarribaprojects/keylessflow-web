/**
 * POST /api/community
 *   body: { name: string, email: string, whatsapp?: string, source?: string }
 *
 * Lead capture for workshop / community attendees who get the app FREE with
 * their own Groq key (BYOK). Public endpoint, no auth.
 *
 * Storage strategy (no schema migration required to go live):
 *   1. PRIMARY  — create a real Supabase Auth user (email, no password) with
 *      the contact details in user_metadata. The `handle_new_user` trigger
 *      gives them a profile + free trial automatically, so the lead lands in
 *      the SAME funnel as every other user (they can later "forgot password"
 *      or magic-link into /account). Already-registered emails are treated as
 *      success (returning lead).
 *   2. SECONDARY — best-effort insert into `community_leads` (see
 *      supabase/schema.sql). If the table doesn't exist yet the error is
 *      logged and ignored; the auth user already captured the lead.
 *
 * Returns { ok: true, email } → the page then reveals the download links.
 */
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    whatsapp?: string;
    source?: string;
  };

  const name = (body.name ?? "").trim().slice(0, 80);
  const email = (body.email ?? "").trim().toLowerCase();
  const whatsapp = (body.whatsapp ?? "").trim().slice(0, 32);
  const source = (body.source ?? "comunidad").trim().slice(0, 64);

  if (name.length < 2) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Primary: auth user (works with the existing schema + triggers).
  const { error: authErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name, whatsapp, source, community: true },
  });
  if (authErr) {
    const msg = (authErr.message ?? "").toLowerCase();
    const alreadyExists =
      msg.includes("already") || msg.includes("exists") || msg.includes("registered");
    if (!alreadyExists) {
      console.error("[community] createUser failed:", authErr);
      return NextResponse.json({ error: "store_failed" }, { status: 500 });
    }
  }

  // 2. Secondary: dedicated leads table (optional until the SQL is applied).
  const { error: leadErr } = await admin
    .from("community_leads")
    .upsert({ name, email, whatsapp, source } as never, { onConflict: "email" });
  if (leadErr) {
    console.warn("[community] community_leads insert skipped:", leadErr.message);
  }

  return NextResponse.json({ ok: true, email, returning: Boolean(authErr) });
}
