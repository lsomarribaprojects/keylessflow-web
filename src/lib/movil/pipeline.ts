/**
 * Dictation pipeline for /movil — same order as the desktop
 * `core/transcriber.py`: Whisper → hallucination filter → (optional) LLM cleanup.
 *
 *   transcribeSegment()  one audio piece → filtered text, with retry+backoff on
 *                        TRANSIENT errors only (network / 5xx / 429) — a 401 or
 *                        402 fails fast, exactly like `core/errors.py`.
 *   cleanupText()        minimal LLM correction; NEVER breaks the result: any
 *                        failure / refusal / rewrite → the raw text is kept.
 *   buildClaudePaste()   wraps a transcript so it can be pasted into Claude.
 */
import { stripHallucinations } from "./hallucination";
import {
  buildCleanupSystemPrompt,
  plausibleCleanup,
  unfence,
  wrapTranscription,
  type Tone,
} from "./cleanup";
import { EngineError, llmChat, transcribeAudio, type Connection } from "./engine";

export interface PipelineSettings {
  language: string; // "auto" | "es" | "en"
  cleanup: boolean;
  tone: Tone;
  vocabulary: string; // one term per line or comma separated
}

export interface PipelineResult {
  /** Final text to show / copy. "" means no speech was detected. */
  text: string;
  raw: string;
  cleaned: boolean;
  cleanupError?: string;
  transcribeMs: number;
  cleanupMs: number;
  model: string;
}

/** Above this the cleanup would exceed the LLM output cap and get truncated. */
export const CLEANUP_MAX_CHARS = 5000;

const RETRY_DELAYS_MS = [1500, 4000];
const TRANSIENT = new Set(["network", "server", "rate_limited"]);

export function vocabularyPrompt(vocabulary: string, maxChars = 800): string {
  const terms = vocabulary
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return "";
  let joined = terms.join(", ");
  if (joined.length > maxChars) joined = joined.slice(0, maxChars).replace(/,[^,]*$/, "");
  return joined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function transcribeSegment(
  conn: Connection,
  audio: Blob,
  filename: string,
  settings: Pick<PipelineSettings, "language" | "vocabulary">,
  signal?: AbortSignal,
): Promise<{ text: string; ms: number; model: string }> {
  let attempt = 0;
  for (;;) {
    try {
      const tr = await transcribeAudio(conn, audio, filename, {
        language: settings.language,
        vocabulary: vocabularyPrompt(settings.vocabulary),
        signal,
      });
      return { text: stripHallucinations(tr.text), ms: tr.elapsedMs, model: tr.model };
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      const code = e instanceof EngineError ? e.code : "";
      if (!TRANSIENT.has(code) || attempt >= RETRY_DELAYS_MS.length) throw e;
      await sleep(RETRY_DELAYS_MS[attempt], signal);
      attempt += 1;
    }
  }
}

export async function cleanupText(
  conn: Connection,
  raw: string,
  tone: Tone,
  signal?: AbortSignal,
): Promise<{ text: string; cleaned: boolean; error?: string; ms: number; model: string }> {
  const t0 = Date.now();
  if (!raw || raw.length < 3) return { text: raw, cleaned: false, ms: 0, model: "" };
  if (raw.length > CLEANUP_MAX_CHARS) {
    return { text: raw, cleaned: false, error: "Texto largo: se deja tal cual lo transcribió Whisper.", ms: 0, model: "" };
  }
  try {
    const out = await llmChat(conn, buildCleanupSystemPrompt(tone), wrapTranscription(raw), {
      temperature: 0,
      maxTokens: 2000,
      signal,
    });
    const cleaned = unfence(out.text);
    const ok = plausibleCleanup(raw, cleaned);
    return {
      text: ok ? cleaned : raw,
      cleaned: ok,
      error: ok ? undefined : "El modelo no devolvió una corrección creíble; se usó el texto original.",
      ms: Date.now() - t0,
      model: out.model,
    };
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    return { text: raw, cleaned: false, error: (e as Error)?.message ?? String(e), ms: Date.now() - t0, model: "" };
  }
}

/** One short audio → final text (used for single files and by the E2E). */
export async function runPipeline(
  conn: Connection,
  audio: Blob,
  filename: string,
  settings: PipelineSettings,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const tr = await transcribeSegment(conn, audio, filename, settings, signal);
  const base: PipelineResult = {
    text: tr.text,
    raw: tr.text,
    cleaned: false,
    transcribeMs: tr.ms,
    cleanupMs: 0,
    model: tr.model,
  };
  if (!tr.text || !settings.cleanup) return base;
  const c = await cleanupText(conn, tr.text, settings.tone, signal);
  return {
    ...base,
    text: c.text,
    cleaned: c.cleaned,
    cleanupError: c.error,
    cleanupMs: c.ms,
    model: c.model ? `${tr.model} + ${c.model}` : tr.model,
  };
}

/* ------------------------------------------------------------ Claude paste */

export const DEFAULT_CLAUDE_INSTRUCTION =
  "Ayúdame con esto: dame un resumen claro, los puntos clave, las decisiones y tareas pendientes, y dime qué harías o responderías tú.";

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function buildClaudePaste(
  text: string,
  meta: { kind: "dictado" | "conversacion" | "archivo"; at: number; seconds: number },
  instruction: string,
): string {
  const what =
    meta.kind === "conversacion" ? "una conversación grabada" : meta.kind === "archivo" ? "un audio que me enviaron" : "un audio dictado";
  const when = new Date(meta.at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
  const dur = formatDuration(meta.seconds);
  const head = `Te comparto la transcripción automática de ${what} (${when}${dur ? `, duración ${dur}` : ""}). Puede estar en español o en inglés, tener errores de transcripción y no distingue quién habla.`;
  const ask = (instruction || DEFAULT_CLAUDE_INSTRUCTION).trim();
  return `${head}\n\n${ask}\n\n<transcripcion>\n${text.trim()}\n</transcripcion>`;
}
