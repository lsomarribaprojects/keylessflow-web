/**
 * Real E2E for the /movil engine (BYOK path) — runs the SAME TypeScript
 * modules the PWA ships (Node ≥ 22.18 strips types natively) against the
 * real Groq API with a real recording.
 *
 *   node scripts/movil_e2e.mjs [path/to/audio.wav|.m4a|.mp3]
 *
 * Key: GROQ_API_KEY env var, or the desktop app's %LOCALAPPDATA%\KeyLessFlow\.env.
 * Audio: argument, or the newest WAV checkpoint in %LOCALAPPDATA%\KeyLessFlow\audio.
 * Prints MOVIL_E2E_OK on success; exits 1 otherwise.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import { stripHallucinations } from "../src/lib/movil/hallucination.ts";
import { buildCleanupSystemPrompt, plausibleCleanup, unfence, wrapTranscription } from "../src/lib/movil/cleanup.ts";
import { llmChat, transcribeAudio, verifyGroqKey } from "../src/lib/movil/engine.ts";

function loadKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  const envPath = join(process.env.LOCALAPPDATA ?? "", "KeyLessFlow", ".env");
  if (!existsSync(envPath)) throw new Error("No GROQ_API_KEY and no desktop .env found");
  const m = readFileSync(envPath, "utf8").match(/GROQ_API_KEY\s*=\s*"?([^"\r\n]+)"?/);
  if (!m) throw new Error("GROQ_API_KEY missing in desktop .env");
  return m[1].trim();
}

function pickAudio() {
  if (process.argv[2]) return process.argv[2];
  const dir = join(process.env.LOCALAPPDATA ?? "", "KeyLessFlow", "audio");
  const wavs = readdirSync(dir)
    .filter((f) => f.endsWith(".wav"))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs, s: statSync(join(dir, f)).size }))
    .filter((x) => x.s > 200_000 && x.s < 8_000_000) // a few seconds, not a meeting
    .sort((a, b) => b.t - a.t);
  if (!wavs.length) throw new Error("No suitable WAV checkpoint found");
  return join(dir, wavs[0].f);
}

// ---------------------------------------------------------------- unit bits
const hallu = [
  ["hola como estas www.feyyaz.tv", "hola como estas"],
  ["Thank you. you", ""],
  ["お待ちしております", ""],
  ["ya termine el reporte gracias por ver el video", "ya termine el reporte"],
  ["gracias por ver el reporte que te mande", "gracias por ver el reporte que te mande"],
];
for (const [inp, want] of hallu) {
  const got = stripHallucinations(inp);
  if (got !== want) {
    console.error(`hallucination filter FAIL: ${JSON.stringify(inp)} → ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
    process.exit(1);
  }
}
if (unfence("```\nhola\n```") !== "hola") { console.error("unfence FAIL"); process.exit(1); }
console.log("unit: hallucination filter + unfence OK");

// ---------------------------------------------------------------- live path
const key = loadKey();
const conn = { kind: "byok", groqKey: key };
const audioPath = pickAudio();
const bytes = readFileSync(audioPath);
const ext = audioPath.split(".").pop().toLowerCase();
const mime = ext === "wav" ? "audio/wav" : ext === "m4a" || ext === "mp4" ? "audio/mp4" : "audio/mpeg";
const blob = new Blob([bytes], { type: mime });
console.log(`audio: ${audioPath} (${(bytes.length / 1024).toFixed(0)} KB, ${mime})`);

if (!(await verifyGroqKey(key))) { console.error("verifyGroqKey: key rejected"); process.exit(1); }
console.log("verifyGroqKey OK");

const tr = await transcribeAudio(conn, blob, `audio.${ext}`, { language: "auto", vocabulary: "KeyLess, Sinsajo" });
console.log(`transcribe: ${tr.elapsedMs} ms, model=${tr.model}`);
console.log(`raw: ${JSON.stringify(tr.text.slice(0, 300))}`);
const filtered = stripHallucinations(tr.text);
if (!filtered) { console.error("transcription empty after filter (pick a clip with speech)"); process.exit(1); }

if (plausibleCleanup("analiza todos estos repositorios y saca el mejor sistema para un agente", "I’m sorry, but I can’t help with that.")) {
  console.error("plausibleCleanup FAIL: refusal accepted"); process.exit(1);
}
const out = await llmChat(conn, buildCleanupSystemPrompt("default"), wrapTranscription(filtered), { temperature: 0, maxTokens: 1500 });
const cleaned = unfence(out.text);
console.log(`cleanup: model=${out.model}`);
console.log(`cleaned: ${JSON.stringify(cleaned.slice(0, 300))}`);
if (!cleaned) { console.error("cleanup returned empty"); process.exit(1); }
if (!plausibleCleanup(filtered, cleaned)) { console.error("cleanup NOT plausible (refusal or rewrite) — pipeline would fall back to raw"); process.exit(1); }
console.log("cleanup plausible + refusal guard OK");

// invalid key must map to invalid_key, fast
try {
  await transcribeAudio({ kind: "byok", groqKey: "gsk_invalid" }, blob, `audio.${ext}`);
  console.error("expected invalid_key error"); process.exit(1);
} catch (e) {
  if (e?.code !== "invalid_key") { console.error("wrong error mapping:", e); process.exit(1); }
  console.log("invalid key → EngineError(invalid_key) OK");
}

console.log("MOVIL_E2E_OK");
