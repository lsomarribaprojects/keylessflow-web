/**
 * Whisper hallucination filter — TypeScript port of the desktop app's
 * `core/hallucination_filter.py` (keep the two in sync).
 *
 * Whisper (incl. Groq's large-v3-turbo) hallucinates a FINITE set of
 * "subtitle-credit" phrases on non-speech / silent audio: bare credit URLs
 * ("www.feyyaz.tv"), "Thank you", "Thanks for watching", "Subtítulos por…",
 * "Gracias por ver el video", or whole phrases in Japanese/Chinese. The user
 * never said them.
 *
 * Strategy — conservative, trailing-anchored so real dictated text survives:
 *   - bare credit URLs and credit phrases are stripped only at the END
 *   - a couple of pure artifacts (feyyaz / amara.org) are removed anywhere
 *   - a non-Latin-dominant output is dropped entirely (es/en users never
 *     dictate CJK)
 * If nothing but artifacts remains the result is "" → caller shows
 * "no se detectó voz" instead of pasting garbage.
 *
 * No imports on purpose: this file is loaded by `scripts/movil_e2e.mjs`
 * under Node's native type stripping.
 */

const ALWAYS_FAKE = /\S*(?:feyyaz|feyyat|amara\.org)\S*/gi;

const TRAILING_ARTIFACT = new RegExp(
  "(?:" +
    "(?:https?:\\/\\/|www\\.)\\S+" +
    "|thanks?(?:\\s+you)?\\s+for\\s+watching" +
    "|thank\\s+you(?:\\s*\\.?\\s+you)*" +
    "|(?:please\\s+)?(?:like\\s+and\\s+)?subscribe\\b[^.!?]*" +
    "|subtitles?\\s+by\\b[^.!?]*" +
    "|subt[ií]tulos\\b[^.!?]*" +
    "|gracias\\s+por\\s+ver(?:\\s+el\\s+v[ií]deo)?" +
    "|suscr[ií]bete\\b[^.!?]*" +
    ")\\s*[.,!?…]*\\s*$",
  "i",
);

// Latin letters incl. accents (á é ñ ü …) and the Latin Extended blocks.
const LATIN_LETTER = /[A-Za-zÀ-ɏḀ-ỿ]/;

function foreignScriptDominant(text: string, threshold = 0.5): boolean {
  let letters = 0;
  let nonLatin = 0;
  for (const ch of text) {
    if (!/\p{L}/u.test(ch)) continue;
    letters += 1;
    if (!LATIN_LETTER.test(ch)) nonLatin += 1;
  }
  if (letters === 0) return false;
  return nonLatin / letters >= threshold;
}

/** Remove trailing/known Whisper hallucination artifacts. Returns cleaned
 *  text, or "" if the whole thing was an artifact. */
export function stripHallucinations(text: string): string {
  if (!text) return text;
  if (foreignScriptDominant(text)) return "";
  const normalized = text.replace(/\s{2,}/g, " ").trim();
  let out = text.replace(ALWAYS_FAKE, "");
  let prev: string | null = null;
  while (prev !== out) {
    prev = out;
    out = out.replace(TRAILING_ARTIFACT, "").replace(/[\s.,!?…\-]+$/u, "");
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  // Nothing but trailing punctuation came off → no artifact was present: keep
  // the sentence's own final "." / "?" (matters when segments are joined into
  // a long transcript; the desktop pastes single phrases so it never noticed).
  if (out === normalized.replace(/[\s.,!?…\-]+$/u, "")) return normalized;
  return out;
}
