/**
 * Browser-only persistence for /movil (localStorage). Everything is wrapped
 * in try/catch: Safari private mode / cleared site data / storage quota can
 * make any access throw, and the app must still render.
 *
 * Stored:
 *   - settings (connection + mode + language + cleanup + tone + vocabulary)
 *   - history (last 50 transcripts) — the phone's Historial, so a text is
 *     never lost if the copy failed
 *   - draft: the transcript of the recording IN PROGRESS, saved after every
 *     segment, so a long conversation survives a crash / iOS killing the page
 */
import type { Tone } from "./cleanup";

export type CaptureMode = "dictado" | "conversacion";
export type TranscriptKind = "dictado" | "conversacion" | "archivo";

export interface MobileSettings {
  mode: "none" | "byok" | "account";
  groqKey: string;
  accountToken: string;
  accountEmail: string;
  accountPlan: string;
  captureMode: CaptureMode;
  language: "auto" | "es" | "en";
  cleanup: boolean;
  tone: Tone;
  vocabulary: string;
  claudeInstruction: string;
  installHintDismissed: boolean;
}

export interface HistoryItem {
  id: string;
  text: string;
  at: number; // epoch ms
  seconds: number; // recording length (0 for uploaded files)
  cleaned: boolean;
  kind?: TranscriptKind;
}

export interface Draft {
  text: string;
  at: number;
  seconds: number;
  kind: TranscriptKind;
}

const SETTINGS_KEY = "kf.movil.settings.v1";
const HISTORY_KEY = "kf.movil.history.v1";
const DRAFT_KEY = "kf.movil.draft.v1";
const HISTORY_MAX = 50;

export const DEFAULT_SETTINGS: MobileSettings = {
  mode: "none",
  groqKey: "",
  accountToken: "",
  accountEmail: "",
  accountPlan: "",
  captureMode: "dictado",
  language: "auto",
  cleanup: true,
  tone: "default",
  vocabulary: "",
  claudeInstruction: "",
  installHintDismissed: false,
};

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(): MobileSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<MobileSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: MobileSettings): boolean {
  return write(SETTINGS_KEY, s);
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function pushHistory(item: HistoryItem): HistoryItem[] {
  let next = [item, ...loadHistory()].slice(0, HISTORY_MAX);
  // Storage quota (long conversations): drop the oldest until it fits.
  while (!write(HISTORY_KEY, next) && next.length > 1) next = next.slice(0, -1);
  return next;
}

export function removeHistory(id: string): HistoryItem[] {
  const next = loadHistory().filter((h) => h.id !== id);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

export function saveDraft(d: Draft): void {
  write(DRAFT_KEY, d);
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const d = raw ? (JSON.parse(raw) as Draft) : null;
    return d && typeof d.text === "string" && d.text.trim() ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Boot-time recovery: a draft still present means the last recording never
 * reached "done" (iOS killed the page, crash, reload). Move it into the
 * Historial so it is never lost, and hand it back to show on screen.
 * Idempotent: the draft is cleared, so a second call returns null.
 */
export function recoverDraft(): Draft | null {
  const d = loadDraft();
  if (!d) return null;
  pushHistory({
    id: `rec-${d.at.toString(36)}`,
    text: d.text,
    at: d.at,
    seconds: d.seconds,
    cleaned: false,
    kind: d.kind,
  });
  clearDraft();
  return d;
}

/* ------------------------------------------------------------ diagnostics */
// Nobody can attach a debugger to Luis's iPhone: the app keeps its own short
// log of failures so "Copiar diagnóstico" (Ajustes) tells us exactly what broke.
// NEVER store keys, tokens or transcript text here.
export interface DiagEvent {
  at: number;
  where: string;
  message: string;
  detail?: string;
}

const DIAG_KEY = "kf.movil.diag.v1";
const DIAG_MAX = 15;

export function loadDiag(): DiagEvent[] {
  try {
    const arr = JSON.parse(window.localStorage.getItem(DIAG_KEY) ?? "[]") as DiagEvent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function logDiag(where: string, message: string, detail?: string): void {
  write(DIAG_KEY, [{ at: Date.now(), where, message, detail }, ...loadDiag()].slice(0, DIAG_MAX));
}

/** Test/debug overrides (set from the console): segment length, split threshold. */
export function debugNumber(name: string, fallback: number): number {
  try {
    const v = Number(window.localStorage.getItem(`kf.movil.debug.${name}`));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}
