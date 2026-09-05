/**
 * POST /api/llm
 *
 * Generic, guarded chat-completion proxy for the KeyLess desktop app.
 * Managed (non-BYOK) users have no local Groq key, so the desktop routes its
 * LLM steps — transcription cleanup (filler removal + tone), Option+N
 * transforms and the Redactor — through here. The backend forwards to Groq
 * with Sinsajo's master key.
 *
 * Design: the DESKTOP owns the prompt logic and sends the fully-built
 * { system, user } pair. The backend stays dumb + safe:
 *   - auth required (desktop HMAC token or Supabase JWT)
 *   - gated to paid/trial accounts
 *   - model chosen server-side from a PREFERENCE LIST with fallback — Groq
 *     rotates its catalog (llama-3.3-70b-versatile was retired 2026-08 and
 *     404'd everything), so a retired id just moves us to the next one
 *   - hard caps on input size and output tokens (abuse / cost guard)
 *
 * Returns { text: string, model: string }.
 */
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyDesktopToken } from "@/lib/desktop-token";
import { checkAccess } from "@/lib/quota";

// Keep in sync with config.LLM_MODEL_CANDIDATES in the desktop app.
const GROQ_LLM_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "qwen/qwen3.6-27b",
];
const GROQ_CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_INPUT_CHARS = 20_000; // system + user combined
const MAX_OUTPUT_TOKENS = 2_000;

export const runtime = "nodejs";
export const maxDuration = 30;

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

export async function POST(req: NextRequest) {
  // ---------------------------------------------------------- 1. Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  const admin = createAdminClient();
  let userId: string;
  if (token.startsWith("kfd_")) {
    const desktop = verifyDesktopToken(token);
    if (!desktop) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    userId = desktop.userId;
  } else {
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    userId = userData.user.id;
  }

  // ------------------------------------------------- 2. Plan / trial gate
  const access = await checkAccess(admin, userId, env.SITE_URL);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason, upgrade_url: access.upgrade_url },
      { status: 402 },
    );
  }

  // --------------------------------------------------------- 3. Read body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const system = typeof b.system === "string" ? b.system : "";
  const user = typeof b.user === "string" ? b.user : "";
  if (!user.trim()) {
    return NextResponse.json({ error: "missing_text" }, { status: 400 });
  }
  if (system.length + user.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: "input_too_large", max_chars: MAX_INPUT_CHARS },
      { status: 413 },
    );
  }
  const temperature = clamp(Number(b.temperature ?? 0), 0, 1);
  const maxTokens = clamp(Number(b.max_tokens ?? MAX_OUTPUT_TOKENS), 1, MAX_OUTPUT_TOKENS);

  // ------------------------------------- 4. Forward to Groq (with fallback)
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });

  let lastStatus = 0;
  let lastDetail = "";
  for (const model of GROQ_LLM_MODELS) {
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (model.startsWith("openai/gpt-oss")) payload.reasoning_effort = "low";

    let groqResp: Response;
    try {
      groqResp = await fetch(GROQ_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.GROQ_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return NextResponse.json(
        { error: "groq_unreachable", detail: String(e).slice(0, 200) },
        { status: 502 },
      );
    }

    if (groqResp.status === 404) {
      // Model retired → try the next candidate.
      lastStatus = 404;
      lastDetail = await groqResp.text().catch(() => "");
      console.warn(`[llm] model ${model} unavailable (404), trying next`);
      continue;
    }
    if (!groqResp.ok) {
      const detail = await groqResp.text().catch(() => "");
      return NextResponse.json(
        { error: "groq_failed", status: groqResp.status, detail: detail.slice(0, 200) },
        { status: 502 },
      );
    }

    const data = (await groqResp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = stripThink(data.choices?.[0]?.message?.content ?? "");
    return NextResponse.json({ text, model });
  }

  return NextResponse.json(
    { error: "no_model_available", status: lastStatus, detail: lastDetail.slice(0, 200) },
    { status: 502 },
  );
}
