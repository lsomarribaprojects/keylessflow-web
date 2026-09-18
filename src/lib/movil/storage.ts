/**
 * Browser-only persistence for /movil (localStorage). Everything is wrapped
 * in try/catch: Safari private mode / cleared site data / storage quota can
 * make any access throw, and the app must still render.
 *
 * Stored:
 *   - settings (connection + language + cleanup + tone + vocabulary)
 *   - history (last 50 dictations) — the phone's equivalent of the desktop
 *     Historial, so a text is never lost if the copy failed.
 */
import type { Tone } from "./cleanup";

export interface MobileSettings {
  mode: "none" | "byok" | "account";
  groqKey: string;
  accountToken: string;
  accountEmail: string;
  accountPlan: string;
  language: "auto" | "es" | "en";
  cleanup: boolean;
  tone: Tone;
  vocabulary: string;
  installHintDismissed: boolean;
}

export interface HistoryItem {
  id: string;
  text: string;
  at: number; // epoch ms
  seconds: number; // recording length (0 for uploaded files)
  cleaned: boolean;
}

const SETTINGS_KEY = "kf.movil.settings.v1";
const HISTORY_KEY = "kf.movil.history.v1";
const HISTORY_MAX = 50;

export const DEFAULT_SETTINGS: MobileSettings = {
  mode: "none",
  groqKey: "",
  accountToken: "",
  accountEmail: "",
  accountPlan: "",
  language: "auto",
  cleanup: true,
  tone: "default",
  vocabulary: "",
  installHintDismissed: false,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(): MobileSettings {
  return read(SETTINGS_KEY, DEFAULT_SETTINGS);
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
  const next = [item, ...loadHistory()].slice(0, HISTORY_MAX);
  write(HISTORY_KEY, next);
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
