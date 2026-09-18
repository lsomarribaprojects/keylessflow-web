/**
 * Full dictation pipeline for /movil — same order as the desktop
 * `core/transcriber.py`: Whisper → hallucination filter → LLM cleanup.
 * The cleanup step NEVER breaks the result: on any LLM failure we return the
 * raw (filtered) transcription, exactly like the desktop does.
 */
import { stripHallucinations } from "./hallucination";
import {
  buildCleanupSystemPrompt,
  plausibleCleanup,
  unfence,
  wrapTranscription,
  type Tone,
} from "./cleanup";
import { llmChat, transcribeAudio, type Connection } from "./engine";

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

export async function runPipeline(
  conn: Connection,
  audio: Blob,
  filename: string,
  settings: PipelineSettings,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const tr = await transcribeAudio(conn, audio, filename, {
    language: settings.language,
    vocabulary: vocabularyPrompt(settings.vocabulary),
    signal,
  });
  const raw = stripHallucinations(tr.text);
  const base: PipelineResult = {
    text: raw,
    raw,
    cleaned: false,
    transcribeMs: tr.elapsedMs,
    cleanupMs: 0,
    model: tr.model,
  };
  if (!raw || raw.length < 3 || !settings.cleanup) return base;

  const t0 = Date.now();
  try {
    const out = await llmChat(conn, buildCleanupSystemPrompt(settings.tone), wrapTranscription(raw), {
      temperature: 0,
      maxTokens: 1500,
      signal,
    });
    const cleaned = unfence(out.text);
    const ok = plausibleCleanup(raw, cleaned);
    return {
      ...base,
      text: ok ? cleaned : raw,
      cleaned: ok,
      cleanupError: ok ? undefined : "El modelo no devolvió una corrección creíble; se usó el texto original.",
      cleanupMs: Date.now() - t0,
      model: `${tr.model} + ${out.model}`,
    };
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    return { ...base, cleanupError: (e as Error)?.message ?? String(e), cleanupMs: Date.now() - t0 };
  }
}
