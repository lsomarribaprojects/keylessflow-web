/**
 * Transcription + LLM engine for the mobile PWA (/movil).
 *
 * Two connection modes, mirroring the desktop app:
 *   - "byok":    the user's own Groq key, calls api.groq.com DIRECTLY from the
 *                browser (Groq answers with `access-control-allow-origin: *`,
 *                verified 2026-09-18). Works even if our backend is down.
 *   - "account": a KeyLess account. The phone holds a desktop-style `kfd_`
 *                token (minted by POST /api/auth/activate from the KF-… code
 *                shown in /account) and talks to /api/transcribe + /api/llm,
 *                which enforce trial/plan/quota server-side.
 *
 * Model list for the LLM step is a PREFERENCE LIST with fallback — Groq
 * rotates its catalog (llama-3.3-70b retired 2026-08). Keep in sync with
 * `config.LLM_MODEL_CANDIDATES` (desktop) and `api/llm/route.ts`.
 *
 * No imports on purpose: `scripts/movil_e2e.mjs` loads this file directly
 * under Node's native type stripping and runs it against the real Groq API.
 */

export const WHISPER_MODEL = "whisper-large-v3-turbo";
export const GROQ_LLM_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "qwen/qwen3.6-27b",
];
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // Groq hard limit

const GROQ_TRANSCRIBE = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions";

export type Connection =
  | { kind: "byok"; groqKey: string }
  | { kind: "account"; token: string; apiBase: string };

export type EngineErrorCode =
  | "no_connection"
  | "invalid_key"
  | "invalid_token"
  | "quota"
  | "too_large"
  | "rate_limited"
  | "network"
  | "server"
  | "rejected" // 4xx the server will never accept on retry (bad/unsupported audio…)
  | "no_model";

export class EngineError extends Error {
  code: EngineErrorCode;
  status?: number;
  upgradeUrl?: string;
  /** Technical detail for the on-device diagnostics (never shown as the headline). */
  detail?: string;
  constructor(code: EngineErrorCode, message: string, status?: number, upgradeUrl?: string, detail?: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.status = status;
    this.upgradeUrl = upgradeUrl;
    this.detail = detail;
  }
}

/**
 * A key/token pasted on a phone often drags invisible junk (zero-width space,
 * BOM, smart quotes, a line break from Notes/WhatsApp). Any non-Latin-1 char in
 * an `authorization` header makes fetch() throw a TypeError BEFORE the request —
 * which used to surface as a fake "Sin conexión". Keep printable ASCII only.
 */
export function cleanSecret(value: string): string {
  return value.replace(/[^!-~]/g, "");
}

export interface TranscribeOptions {
  /** "" or "auto" → Whisper detects the language (es/en/…). */
  language?: string;
  /** Comma-separated personal dictionary terms (Whisper `prompt` hint). */
  vocabulary?: string;
  signal?: AbortSignal;
}

export interface TranscribeResult {
  text: string;
  model: string;
  elapsedMs: number;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  text: string;
  model: string;
}

/* ------------------------------------------------------------------ helpers */

async function readJson(resp: Response): Promise<Record<string, unknown>> {
  try {
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function groqErrorMessage(body: Record<string, unknown>): string {
  const err = body.error as { message?: string } | undefined;
  return err?.message ?? "";
}

function mapGroqFailure(status: number, body: Record<string, unknown>): EngineError {
  const detail = groqErrorMessage(body);
  if (status === 401) return new EngineError("invalid_key", "La Groq key no es válida. Revísala en Ajustes.", status);
  if (status === 413) return new EngineError("too_large", "El audio supera el límite de 25 MB.", status);
  if (status === 429) return new EngineError("rate_limited", "Groq está limitando las peticiones. Espera unos segundos e intenta de nuevo.", status);
  if (status >= 500) return new EngineError("server", `Groq respondió ${status}. Intenta de nuevo.`, status, undefined, detail);
  return new EngineError("rejected", detail ? `Groq: ${detail}` : `Groq respondió ${status}.`, status, undefined, detail);
}

function mapBackendFailure(status: number, body: Record<string, unknown>): EngineError {
  const error = String(body.error ?? "");
  const upgrade = typeof body.upgrade_url === "string" ? body.upgrade_url : undefined;
  if (status === 401) return new EngineError("invalid_token", "La sesión de tu cuenta expiró. Vuelve a conectar con tu código de activación.", status);
  if (status === 402) {
    const why =
      error === "trial_expired" ? "Tu trial terminó."
      : error === "free_quota_exceeded" ? "Llegaste al límite de horas de este mes."
      : error === "no_profile" ? "Esta cuenta no tiene plan activo."
      : "Tu suscripción no está activa.";
    return new EngineError("quota", `${why} Suscríbete para seguir dictando.`, status, upgrade);
  }
  if (status === 413) return new EngineError("too_large", "El audio supera el límite de 25 MB.", status);
  if (status === 429) return new EngineError("rate_limited", "Demasiadas peticiones. Espera unos segundos.", status);
  if (status >= 500) return new EngineError("server", `El servidor respondió ${status}. Intenta de nuevo en un momento.`, status);
  return new EngineError("rejected", error ? `Error del servidor: ${error}` : `El servidor respondió ${status}.`, status);
}

async function doFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    const host = input.startsWith("http") ? new URL(input).host : "backend";
    throw new EngineError("network", "Sin conexión. Revisa tu internet e intenta de nuevo.", undefined, undefined, `fetch ${host}: ${String(e)}`);
  }
}

/* ------------------------------------------------------------- transcribe */

export async function transcribeAudio(
  conn: Connection,
  audio: Blob,
  filename: string,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  if (audio.size > MAX_UPLOAD_BYTES) {
    throw new EngineError("too_large", "El audio supera el límite de 25 MB. Graba en partes más cortas.");
  }
  const t0 = Date.now();
  const language = !opts.language || opts.language === "auto" ? "" : opts.language;
  const form = new FormData();
  form.set("file", audio, filename);

  try {
    return await transcribeWith(conn, form, language, opts, t0);
  } catch (e) {
    if (e instanceof EngineError) {
      const about = `${filename} · ${audio.type || "sin tipo"} · ${Math.round(audio.size / 1024)} KB`;
      e.detail = e.detail ? `${e.detail} · ${about}` : about;
    }
    throw e;
  }
}

async function transcribeWith(
  conn: Connection,
  form: FormData,
  language: string,
  opts: TranscribeOptions,
  t0: number,
): Promise<TranscribeResult> {
  if (conn.kind === "byok") {
    form.set("model", WHISPER_MODEL);
    form.set("response_format", "text");
    form.set("temperature", "0");
    if (language) form.set("language", language);
    if (opts.vocabulary) form.set("prompt", opts.vocabulary);
    const resp = await doFetch(GROQ_TRANSCRIBE, {
      method: "POST",
      headers: { authorization: `Bearer ${conn.groqKey}` },
      body: form,
      signal: opts.signal,
    });
    if (!resp.ok) throw mapGroqFailure(resp.status, await readJson(resp));
    const text = (await resp.text()).trim();
    return { text, model: WHISPER_MODEL, elapsedMs: Date.now() - t0 };
  }

  // account → our backend (same contract the desktop uses)
  if (language) form.set("language", language);
  if (opts.vocabulary) form.set("prompt", opts.vocabulary);
  const resp = await doFetch(`${conn.apiBase}/api/transcribe`, {
    method: "POST",
    headers: { authorization: `Bearer ${conn.token}` },
    body: form,
    signal: opts.signal,
  });
  const body = await readJson(resp);
  if (!resp.ok) throw mapBackendFailure(resp.status, body);
  return {
    text: String(body.text ?? "").trim(),
    model: String(body.model ?? WHISPER_MODEL),
    elapsedMs: Date.now() - t0,
  };
}

/* -------------------------------------------------------------------- chat */

function isRetiredModel(status: number, body: Record<string, unknown>): boolean {
  if (status === 404) return true;
  const msg = groqErrorMessage(body).toLowerCase();
  return status === 400 && (msg.includes("decommissioned") || msg.includes("does not exist") || msg.includes("not found"));
}

export async function llmChat(
  conn: Connection,
  system: string,
  user: string,
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const temperature = opts.temperature ?? 0;
  const maxTokens = opts.maxTokens ?? 1500;

  if (conn.kind === "account") {
    const resp = await doFetch(`${conn.apiBase}/api/llm`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${conn.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ system, user, temperature, max_tokens: maxTokens }),
      signal: opts.signal,
    });
    const body = await readJson(resp);
    if (!resp.ok) throw mapBackendFailure(resp.status, body);
    return { text: String(body.text ?? ""), model: String(body.model ?? "") };
  }

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let lastErr: EngineError | null = null;
  for (const model of GROQ_LLM_MODELS) {
    const payload: Record<string, unknown> = { model, messages, temperature, max_tokens: maxTokens };
    if (model.startsWith("openai/gpt-oss")) payload.reasoning_effort = "low";
    const resp = await doFetch(GROQ_CHAT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${conn.groqKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });
    const body = await readJson(resp);
    if (resp.ok) {
      const choices = body.choices as { message?: { content?: string } }[] | undefined;
      const raw = choices?.[0]?.message?.content ?? "";
      const text = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
      return { text, model };
    }
    if (isRetiredModel(resp.status, body)) {
      lastErr = new EngineError("no_model", `Modelo ${model} no disponible`, resp.status);
      continue; // retired → next candidate
    }
    throw mapGroqFailure(resp.status, body);
  }
  throw lastErr ?? new EngineError("no_model", "Ningún modelo LLM disponible en Groq ahora mismo.");
}

/* -------------------------------------------------------------- activation */

export interface ActivationResult {
  token: string;
  email: string;
  plan: string;
  expiresAt: string;
}

/** Exchange a KF-XXXX-XXXX-XXXX code (from /account) for a long-lived token. */
export async function activateAccount(apiBase: string, code: string): Promise<ActivationResult> {
  const clean = code.trim().toUpperCase();
  if (!/^KF-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(clean)) {
    throw new EngineError("invalid_token", "El código debe verse así: KF-XXXX-XXXX-XXXX (está en tu cuenta web).");
  }
  const resp = await doFetch(`${apiBase}/api/auth/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: clean }),
  });
  const body = await readJson(resp);
  if (resp.status === 404) throw new EngineError("invalid_token", "No encontramos una cuenta con ese código.", 404);
  if (resp.status === 400) throw new EngineError("invalid_token", "Código con formato inválido.", 400);
  if (!resp.ok) throw mapBackendFailure(resp.status, body);
  return {
    token: String(body.token ?? ""),
    email: String(body.email ?? ""),
    plan: String(body.plan ?? ""),
    expiresAt: String(body.expires_at ?? ""),
  };
}

/** Cheap check that a Groq key works (lists models; no cost). */
export async function verifyGroqKey(groqKey: string): Promise<boolean> {
  const resp = await doFetch("https://api.groq.com/openai/v1/models", {
    headers: { authorization: `Bearer ${groqKey}` },
  });
  if (resp.status === 401) return false;
  if (!resp.ok) throw mapGroqFailure(resp.status, await readJson(resp));
  return true;
}
