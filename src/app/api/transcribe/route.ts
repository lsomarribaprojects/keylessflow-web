/**
 * POST /api/transcribe
 *
 * The KeyLess Flow desktop app (Pro plan only) sends a multipart upload of
 * MP3 audio + Bearer JWT. We verify the user, check subscription status,
 * forward to Groq Whisper with Sinsajo's master key, and log usage.
 *
 * Returns { text: string, model: string, elapsed_ms: number }.
 *
 * Free-plan users hit Groq directly from the desktop app with their own
 * key — they never touch this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyDesktopToken } from "@/lib/desktop-token";
import { checkQuotaAndConsume } from "@/lib/quota";

const GROQ_MODEL = "whisper-large-v3-turbo";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // Groq hard limit

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel: long-running uploads

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  // ---------------------------------------------------------- 1. Auth check
  // Accept two token types:
  //   - Desktop HMAC token (prefix "kfd_") — minted by /api/auth/activate
  //   - Supabase JWT (web sessions, future browser-based dictation)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  const admin = createAdminClient();
  let userId: string;
  let userEmail = "";

  if (token.startsWith("kfd_")) {
    const desktop = verifyDesktopToken(token);
    if (!desktop) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    userId = desktop.userId;
    // Look up email for logging; not strictly required for proxy.
    const { data: lookup } = await admin.auth.admin.getUserById(userId);
    userEmail = lookup?.user?.email ?? "";
  } else {
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    userId = userData.user.id;
    userEmail = userData.user.email ?? "";
  }

  // ---------------------------------------------------- 2. Quota + trial check
  // Single source of truth in lib/quota.ts: handles Pro (always serve, log
  // soft-cap warning), Free Trial (check trial_ends_at + 8h/mo cap), and
  // expired/inactive accounts (402 with upgrade_url).
  const decision = await checkQuotaAndConsume(admin, userId, env.SITE_URL);
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: decision.reason,
        upgrade_url: decision.upgrade_url,
        seconds_used: decision.seconds_used,
        seconds_cap: decision.seconds_cap,
      },
      { status: 402 },
    );
  }
  if (decision.warn) {
    // Log only — don't block Pro users. Useful for spotting abuse early.
    console.warn(`[transcribe] user=${userId} ${decision.warn}`);
  }

  // -------------------------------------------------------- 3. Read upload
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", max_bytes: MAX_UPLOAD_BYTES },
      { status: 413 },
    );
  }
  const language = (formData.get("language") as string) || "es";
  const prompt = (formData.get("prompt") as string) || "";

  // -------------------------------------------------- 4. Forward to Groq
  const groqForm = new FormData();
  groqForm.set("file", file, file.name || "audio.mp3");
  groqForm.set("model", GROQ_MODEL);
  groqForm.set("language", language);
  groqForm.set("response_format", "text");
  groqForm.set("temperature", "0");
  if (prompt) groqForm.set("prompt", prompt);

  const groqResp = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!groqResp.ok) {
    const detail = await groqResp.text().catch(() => "");
    // Log the failure so we don't burn quota on bad uploads
    await admin.from("usage_logs").insert([
      {
        user_id: userId,
        seconds_audio: 0,
        bytes_upload: file.size,
        model: GROQ_MODEL,
        elapsed_ms: Date.now() - t0,
        success: false,
        error_message: `groq_${groqResp.status}: ${detail.slice(0, 200)}`,
      },
    ] as never);
    return NextResponse.json(
      { error: "groq_failed", status: groqResp.status },
      { status: 502 },
    );
  }

  const text = (await groqResp.text()).trim();
  const elapsed = Date.now() - t0;

  // ------------------------------------------------- 5. Log usage (fire-and-forget)
  // Rough audio length estimate: 32 kbps mono MP3 = ~4 KB/s.
  const secondsEstimate = Math.round(file.size / 4096);
  await admin.from("usage_logs").insert([
    {
      user_id: userId,
      seconds_audio: secondsEstimate,
      bytes_upload: file.size,
      model: GROQ_MODEL,
      elapsed_ms: elapsed,
      success: true,
    },
  ] as never);
  void userEmail; // reserved for future per-user logging context

  return NextResponse.json({
    text,
    model: GROQ_MODEL,
    elapsed_ms: elapsed,
  });
}
