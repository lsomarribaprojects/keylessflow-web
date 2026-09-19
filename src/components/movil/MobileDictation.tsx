"use client";

/**
 * <MobileDictation /> — the whole /movil app.
 *
 * Two capture modes (big switch on the main screen):
 *   - Dictado:       short voice note → Whisper → filter → LLM cleanup → text.
 *   - Conversación:  long recording (meeting, call on speaker, a video playing
 *                    next to the phone). The mic is cut into ~4-minute segments
 *                    that are transcribed WHILE recording continues, the text
 *                    grows live on screen, and every segment is saved to a
 *                    draft so nothing is lost if iOS kills the page.
 * Plus "transcribir un audio": any audio/video file (WhatsApp voice notes,
 * forwarded videos). Files > 25 MB are split into WAV chunks in the browser.
 *
 * Every transcript lands in the local Historial and has two copy buttons:
 * "Copiar" (plain) and "Copiar para Claude" (transcript wrapped with context +
 * the user's standing instruction, ready to paste into Claude).
 *
 * Language: Whisper auto-detects per segment (Spanish / English / mixed).
 *
 * iOS notes baked in:
 *   - getUserMedia must start from a user gesture → only in the button handler.
 *   - navigator.clipboard.writeText needs a gesture → auto-copy is best-effort;
 *     the buttons are the reliable path.
 *   - iOS stops the mic when the app goes to the background → we finish
 *     gracefully and keep everything captured so far.
 *
 * Rendered client-only (MovilClient.tsx → next/dynamic ssr:false), so the lazy
 * initializers may read localStorage / navigator safely.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { TONE_LABELS, type Tone } from "@/lib/movil/cleanup";
import { SplitError, splitAudioToWavChunks } from "@/lib/movil/audio-split";
import {
  activateAccount,
  cleanSecret,
  EngineError,
  MAX_UPLOAD_BYTES,
  verifyGroqKey,
  type Connection,
} from "@/lib/movil/engine";
import {
  buildClaudePaste,
  cleanupText,
  DEFAULT_CLAUDE_INSTRUCTION,
  transcribeSegment,
} from "@/lib/movil/pipeline";
import { extFromMime, pickRecorderMime, RecorderError, SegmentedRecorder } from "@/lib/movil/recorder";
import {
  clearDraft,
  clearHistory,
  debugNumber,
  loadDiag,
  logDiag,
  recoverDraft,
  loadHistory,
  loadSettings,
  pushHistory,
  removeHistory,
  saveDraft,
  saveSettings,
  type CaptureMode,
  type HistoryItem,
  type MobileSettings,
  type TranscriptKind,
} from "@/lib/movil/storage";

type Phase = "idle" | "requesting" | "recording" | "processing" | "done" | "error";

interface DoneInfo {
  kind: TranscriptKind;
  at: number;
  seconds: number;
  cleaned: boolean;
  note: string; // small status line under the text
}

/** Mutable state of ONE capture (recording or file); lives outside React state. */
interface Session {
  kind: TranscriptKind;
  parts: (string | null)[];
  chain: Promise<void>;
  failed: number;
  firstError: Error | null;
  ac: AbortController;
  startedAt: number;
}

const SEGMENT_MS = 4 * 60 * 1000;

function fmtClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}` : `${m}:${r.toString().padStart(2, "0")}`;
}

function fmtWhen(ts: number): string {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `hoy ${time}` : `${d.toLocaleDateString("es", { day: "numeric", month: "short" })} ${time}`;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
}

function joinParts(parts: (string | null)[], kind: TranscriptKind): string {
  const done = parts.filter((p): p is string => Boolean(p && p.trim()));
  return done.join(kind === "dictado" ? " " : "\n\n").trim();
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function MobileDictation({ apiBase }: { apiBase: string }) {
  const [settings, setSettings] = useState<MobileSettings>(() => loadSettings());
  // A draft on boot = a recording that never reached "done" (page killed): it is
  // moved into the Historial and shown. Must run BEFORE the history initializer.
  const [recovered] = useState(() => recoverDraft());
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [phase, setPhase] = useState<Phase>(() => (recovered ? "done" : "idle"));
  const [text, setText] = useState(() => recovered?.text ?? "");
  const [info, setInfo] = useState<DoneInfo | null>(() =>
    recovered
      ? { kind: recovered.kind, at: recovered.at, seconds: recovered.seconds, cleaned: false, note: "recuperado de una grabación interrumpida" }
      : null,
  );
  const [seconds, setSeconds] = useState(0);
  const [liveText, setLiveText] = useState("");
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<{ message: string; upgradeUrl?: string; detail?: string } | null>(null);
  const [copied, setCopied] = useState<"" | "plain" | "claude">("");
  const [sheet, setSheet] = useState<"none" | "settings" | "history">("none");
  const [standalone] = useState(() => isStandalone());
  const [ios] = useState(() => isIOS());
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");
  const [busyLabel, setBusyLabel] = useState("");

  const recorderRef = useRef<SegmentedRecorder | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const liveBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Offline app shell (external system → effect is the right place).
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    // keep the newest live text in view while recording
    const el = liveBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveText]);

  const connection: Connection | null = useMemo(() => {
    if (settings.mode === "byok" && settings.groqKey) return { kind: "byok", groqKey: settings.groqKey };
    if (settings.mode === "account" && settings.accountToken) {
      return { kind: "account", token: settings.accountToken, apiBase };
    }
    return null;
  }, [settings, apiBase]);

  const updateSettings = (patch: Partial<MobileSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const flashCopied = (which: "plain" | "claude") => {
    setCopied(which);
    window.setTimeout(() => setCopied(""), 2200);
  };

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const fail = (e: unknown) => {
    const err = e as EngineError;
    const detail = [err?.code, err?.status, err?.detail].filter(Boolean).join(" · ");
    logDiag("pipeline", err?.message ?? String(e), detail);
    setError({ message: err?.message ?? String(e), upgradeUrl: err?.upgradeUrl, detail });
    setPhase("error");
    if (err?.code === "invalid_key" || err?.code === "invalid_token") setSheet("settings");
  };

  /** Queue one audio piece; pieces are transcribed in order, one at a time. */
  const enqueue = (session: Session, conn: Connection, s: MobileSettings, blob: Blob, filename: string, index: number) => {
    session.parts[index] = null;
    setPending((n) => n + 1);
    session.chain = session.chain.then(async () => {
      try {
        const r = await transcribeSegment(conn, blob, filename, s, session.ac.signal);
        session.parts[index] = r.text;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        session.parts[index] = "";
        session.failed += 1;
        session.firstError ??= e as Error;
        const ee = e as EngineError;
        logDiag(`tramo ${index + 1}`, ee?.message ?? String(e), [ee?.code, ee?.status, ee?.detail].filter(Boolean).join(" · "));
      } finally {
        setPending((n) => Math.max(0, n - 1));
      }
      const joined = joinParts(session.parts, session.kind);
      setLiveText(joined);
      if (joined) {
        saveDraft({ text: joined, at: session.startedAt, seconds: Math.round((Date.now() - session.startedAt) / 1000), kind: session.kind });
      }
    });
  };

  /** All pieces queued → wait, assemble, optional cleanup, show + save. */
  const finalize = async (session: Session, conn: Connection, s: MobileSettings, recSeconds: number, interrupted: boolean) => {
    stopTimer();
    setPhase("processing");
    setBusyLabel("Transcribiendo…");
    await session.chain;
    if (session.ac.signal.aborted) {
      setPhase("idle");
      return;
    }
    const raw = joinParts(session.parts, session.kind);
    if (!raw && session.firstError) {
      clearDraft();
      fail(session.firstError);
      return;
    }
    let finalText = raw;
    let cleaned = false;
    const notes: string[] = [];
    if (raw && session.kind === "dictado" && s.cleanup) {
      setBusyLabel("Limpiando con IA…");
      try {
        const c = await cleanupText(conn, raw, s.tone, session.ac.signal);
        finalText = c.text;
        cleaned = c.cleaned;
        notes.push(c.cleaned ? "limpieza IA ✓" : "sin limpieza (texto original)");
      } catch {
        setPhase("idle");
        return;
      }
    } else if (raw) {
      notes.push(session.kind === "conversacion" ? "transcripción literal" : session.kind === "archivo" ? "audio transcrito" : "texto sin limpiar");
    }
    if (session.failed > 0) notes.push(`${session.failed} segmento(s) no se pudieron transcribir`);
    if (interrupted) notes.push("grabación interrumpida por el sistema (se guardó lo captado)");

    setBusyLabel("");
    setText(finalText);
    setInfo({ kind: session.kind, at: session.startedAt, seconds: recSeconds, cleaned, note: notes.join(" · ") });
    setPhase("done");
    clearDraft();
    if (!finalText) return;
    setHistory(
      pushHistory({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        text: finalText,
        at: session.startedAt,
        seconds: recSeconds,
        cleaned,
        kind: session.kind,
      }),
    );
    // Best-effort auto copy (Safari usually demands a gesture; buttons are the fallback).
    try {
      await navigator.clipboard.writeText(finalText);
      flashCopied("plain");
    } catch {
      /* user taps Copiar */
    }
  };

  const newSession = (kind: TranscriptKind): Session => ({
    kind,
    parts: [],
    chain: Promise.resolve(),
    failed: 0,
    firstError: null,
    ac: new AbortController(),
    startedAt: Date.now(),
  });

  // ------------------------------------------------------------ recording
  const startRecording = async () => {
    if (!connection) {
      setSheet("settings");
      return;
    }
    const conn = connection;
    const s = settings;
    const session = newSession(s.captureMode);
    sessionRef.current = session;
    setPhase("requesting");
    setError(null);
    setInfo(null);
    setText("");
    setLiveText("");
    setPending(0);
    setSeconds(0);
    clearDraft();

    const rec = new SegmentedRecorder({
      segmentMs: debugNumber("segMs", SEGMENT_MS),
      onSegment: (blob, mime, index) => enqueue(session, conn, s, blob, `segmento-${index + 1}.${extFromMime(mime)}`, index),
      onFinished: ({ interrupted, segments }) => {
        recorderRef.current = null;
        const recSeconds = Math.round((Date.now() - session.startedAt) / 1000);
        if (segments === 0) {
          stopTimer();
          logDiag("grabador", "sin segmentos", `${recSeconds}s · mime ${pickRecorderMime() || "default"} · interrumpida=${interrupted}`);
          setError({ message: "Grabación demasiado corta. Mantén el micrófono un momento más." });
          setPhase("error");
          return;
        }
        void finalize(session, conn, s, recSeconds, interrupted);
      },
      onError: (e) => {
        stopTimer();
        logDiag("grabador", e.message, `mime ${pickRecorderMime() || "default"}`);
        setError({ message: e.message });
        setPhase("error");
      },
    });
    try {
      await rec.start();
    } catch (e) {
      logDiag("micrófono", e instanceof RecorderError ? e.message : String(e));
      setError({ message: e instanceof RecorderError ? e.message : `No se pudo grabar: ${String(e)}` });
      setPhase("error");
      return;
    }
    recorderRef.current = rec;
    session.startedAt = Date.now();
    setPhase("recording");
    timerRef.current = window.setInterval(() => {
      setSeconds(Math.round((Date.now() - session.startedAt) / 1000));
    }, 500);
  };

  const stopRecording = () => recorderRef.current?.stop();

  const cancelProcessing = () => sessionRef.current?.ac.abort();

  // ---------------------------------------------------------------- files
  const onPickFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!connection) {
      setSheet("settings");
      return;
    }
    const conn = connection;
    const s = settings;
    const session = newSession("archivo");
    sessionRef.current = session;
    setPhase("processing");
    setError(null);
    setInfo(null);
    setText("");
    setLiveText("");
    setPending(0);
    try {
      const limit = debugNumber("splitBytes", MAX_UPLOAD_BYTES - 512 * 1024);
      let pieces: { blob: Blob; name: string }[];
      if (file.size > limit) {
        setBusyLabel("Preparando audio largo…");
        const chunks = await splitAudioToWavChunks(file, debugNumber("splitSeconds", 480));
        pieces = chunks.map((blob, i) => ({ blob, name: `parte-${i + 1}.wav` }));
      } else {
        const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : extFromMime(file.type);
        pieces = [{ blob: file, name: `archivo.${ext}` }];
      }
      setBusyLabel(pieces.length > 1 ? `Transcribiendo ${pieces.length} partes…` : "Transcribiendo…");
      pieces.forEach((p, i) => enqueue(session, conn, s, p.blob, p.name, i));
      await finalize(session, conn, s, 0, false);
    } catch (e) {
      if (e instanceof SplitError) {
        logDiag("archivo", e.message, `${file.type || "sin tipo"} · ${Math.round(file.size / 1024)} KB`);
        setError({ message: e.message });
        setPhase("error");
      } else {
        fail(e);
      }
    }
  };

  // -------------------------------------------------------------- actions
  const claudeText = (t: string, meta: { kind?: TranscriptKind; at: number; seconds: number }) =>
    buildClaudePaste(t, { kind: meta.kind ?? "dictado", at: meta.at, seconds: meta.seconds }, settings.claudeInstruction);

  const copyPlain = async () => {
    if (text && (await writeClipboard(text))) flashCopied("plain");
  };
  const copyForClaude = async () => {
    if (!text) return;
    const meta = info ?? { kind: "dictado" as TranscriptKind, at: Date.now(), seconds: 0 };
    if (await writeClipboard(claudeText(text, meta))) flashCopied("claude");
  };
  const shareText = async () => {
    if (!text || !navigator.share) return;
    try {
      await navigator.share({ text });
    } catch {
      /* cancelled */
    }
  };

  const reset = () => {
    clearDraft();
    setPhase("idle");
    setInfo(null);
    setText("");
    setLiveText("");
    setError(null);
  };

  // --------------------------------------------------------------- render
  const recording = phase === "recording";
  const busy = phase === "processing" || phase === "requesting";
  const conversation = settings.captureMode === "conversacion";
  const showInstallHint = ios && !standalone && !settings.installHintDismissed;

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-bg text-fg"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", touchAction: "manipulation" }}
    >
      <header className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hummingbird.png" alt="" width={24} height={24} />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight">KeyLess</span>
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-faint">móvil</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Historial" onClick={() => setSheet("history")}>
            <HistoryIcon />
          </IconButton>
          <IconButton label="Ajustes" onClick={() => setSheet("settings")} attention={!connection}>
            <GearIcon />
          </IconButton>
        </div>
      </header>

      {showInstallHint && (
        <div className="mx-5 mt-2 rounded-lg border border-accent/30 bg-surface px-4 py-3 text-sm">
          <p className="text-fg">
            Instálala como app: toca <span className="font-mono text-accent">Compartir</span> y luego{" "}
            <span className="font-mono text-accent">Añadir a pantalla de inicio</span>.
          </p>
          <button type="button" className="mt-2 font-mono text-xs text-faint" onClick={() => updateSettings({ installHintDismissed: true })}>
            entendido
          </button>
        </div>
      )}

      <main className="flex flex-1 flex-col px-5 pb-6">
        <section className="mt-4 flex min-h-0 flex-1 flex-col">
          {phase === "idle" && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="font-display text-2xl font-semibold tracking-tight">
                {!connection ? "Conecta tu cuenta." : conversation ? "Graba la conversación." : "Toca y habla."}
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                {!connection
                  ? "En Ajustes pega tu Groq key (BYOK) o el código de activación de tu cuenta KeyLess."
                  : conversation
                    ? "Deja el teléfono cerca de quien habla (o del altavoz). El texto va apareciendo mientras graba y queda guardado. Español o inglés."
                    : "Cuando termines, toca de nuevo. El texto aparece aquí listo para copiar o compartir."}
              </p>
              {connection && (
                <p className="mt-4 font-mono text-[0.7rem] text-faint">
                  {connection.kind === "byok" ? "Groq key propia" : `Cuenta · ${settings.accountEmail || settings.accountPlan}`}
                  {" · "}
                  {settings.language === "auto" ? "idioma auto (es/en)" : settings.language}
                  {!conversation && ` · ${settings.cleanup ? `limpieza ${TONE_LABELS[settings.tone].toLowerCase()}` : "sin limpieza"}`}
                </p>
              )}
            </div>
          )}

          {(phase === "requesting" || recording) && (
            <div className="flex min-h-0 flex-1 flex-col items-center text-center">
              <div className={`flex flex-col items-center ${liveText ? "pt-2" : "flex-1 justify-center"}`}>
                <div className="wave" aria-hidden>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <i key={i} style={{ animationDelay: `${i * 90}ms`, animationPlayState: recording ? "running" : "paused" }} />
                  ))}
                </div>
                <p className="font-display mt-5 text-4xl font-semibold tabular-nums tracking-tight">{fmtClock(seconds)}</p>
                <p className="mt-2 text-sm text-muted">
                  {recording ? (conversation ? "Grabando conversación · toca para terminar" : "Grabando · toca para terminar") : "Pidiendo micrófono…"}
                </p>
                {recording && conversation && (
                  <p className="mt-1 font-mono text-[0.68rem] text-faint">
                    {pending > 0 ? "transcribiendo un tramo…" : "mantén esta pantalla abierta"}
                  </p>
                )}
              </div>
              {liveText && (
                <div
                  ref={liveBoxRef}
                  className="mt-4 min-h-0 w-full flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface px-4 py-3 text-left text-[15px] leading-relaxed text-muted"
                  style={{ maxHeight: "38dvh" }}
                  aria-live="polite"
                >
                  {liveText}
                </div>
              )}
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Spinner />
              <p className="font-display mt-5 text-xl font-semibold">{busyLabel || "Procesando…"}</p>
              <p className="mt-1 font-mono text-xs text-faint">{pending > 1 ? `${pending} tramos en cola` : "Whisper · Groq"}</p>
              <button type="button" onClick={cancelProcessing} className="mt-6 font-mono text-xs text-faint underline">
                cancelar
              </button>
            </div>
          )}

          {phase === "done" &&
            (text ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[11rem] w-full flex-1 resize-none rounded-lg border border-border-2 bg-surface px-4 py-3 text-[17px] leading-relaxed text-fg outline-none focus:border-accent"
                  aria-label="Texto transcrito"
                />
                <p className="mt-2 font-mono text-[0.68rem] leading-relaxed text-faint">
                  {info?.note}
                  {info && info.seconds > 0 ? ` · ${fmtClock(info.seconds)}` : ""}
                  {` · ${text.trim().split(/\s+/).length} palabras · guardado en Historial`}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button type="button" onClick={copyPlain} className="btn-primary text-[15px]">
                    {copied === "plain" ? "✓ Copiado" : "Copiar"}
                  </button>
                  <button type="button" onClick={copyForClaude} className="btn-ghost text-[15px]">
                    {copied === "claude" ? "✓ Listo, pega en Claude" : "Copiar para Claude"}
                  </button>
                </div>
                {canShare && (
                  <button type="button" onClick={shareText} className="mt-3 font-mono text-xs text-faint underline">
                    compartir a otra app
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="font-display text-xl font-semibold">No se detectó voz</p>
                <p className="mt-2 max-w-xs text-sm text-muted">Whisper no encontró palabras claras. Acerca el teléfono a quien habla e intenta de nuevo.</p>
              </div>
            ))}

          {phase === "error" && error && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="font-display text-xl font-semibold text-red-400">Algo falló</p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{error.message}</p>
              {error.detail && <p className="mt-2 max-w-xs break-words font-mono text-[0.65rem] leading-relaxed text-faint">{error.detail}</p>}
              {error.upgradeUrl && (
                <a href={error.upgradeUrl} className="btn-primary mt-5 text-sm">
                  Ver planes
                </a>
              )}
            </div>
          )}
        </section>

        {/* Controls — always in thumb reach */}
        <section className="mt-5 flex flex-col items-center">
          {!recording && !busy && (
            <div className="mb-4 grid w-full max-w-xs grid-cols-2 gap-1 rounded-full border border-border bg-bg-band p-1 font-mono text-xs" role="tablist" aria-label="Modo de captura">
              {(["dictado", "conversacion"] as CaptureMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={settings.captureMode === m}
                  onClick={() => updateSettings({ captureMode: m })}
                  className={`rounded-full px-3 py-2 ${settings.captureMode === m ? "bg-surface-2 text-fg" : "text-faint"}`}
                >
                  {m === "dictado" ? "Dictado" : "Conversación"}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
            aria-label={recording ? "Detener grabación" : "Empezar a grabar"}
            aria-pressed={recording}
            className="rec-btn"
            data-recording={recording ? "true" : "false"}
          >
            <span className="rec-btn-inner" />
          </button>
          <div className="mt-4 flex items-center gap-4 whitespace-nowrap font-mono text-[0.72rem] text-faint">
            {phase === "done" || phase === "error" ? (
              <button type="button" onClick={reset} className="underline">
                nuevo
              </button>
            ) : (
              <span>{recording ? "toca para terminar" : conversation ? "toca para grabar" : "toca para dictar"}</span>
            )}
            <span aria-hidden>·</span>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy || recording} className="underline">
              subir audio o video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.m4a,.mp3,.wav,.ogg,.opus,.webm,.mp4,.mov"
              className="hidden"
              onChange={onPickFile}
            />
          </div>
        </section>
      </main>

      {sheet === "settings" && (
        <Sheet title="Ajustes" onClose={() => setSheet("none")}>
          <SettingsPanel settings={settings} update={updateSettings} apiBase={apiBase} />
        </Sheet>
      )}
      {sheet === "history" && (
        <Sheet title="Historial" onClose={() => setSheet("none")}>
          <HistoryPanel
            items={history}
            toClaude={(h) => claudeText(h.text, h)}
            onRemove={(id) => setHistory(removeHistory(id))}
            onClear={() => {
              clearHistory();
              setHistory([]);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Settings */
function SettingsPanel({
  settings,
  update,
  apiBase,
}: {
  settings: MobileSettings;
  update: (p: Partial<MobileSettings>) => void;
  apiBase: string;
}) {
  const [keyDraft, setKeyDraft] = useState(settings.groqKey);
  const [codeDraft, setCodeDraft] = useState("");
  const [busy, setBusy] = useState<"" | "key" | "code">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"byok" | "account">(settings.mode === "account" ? "account" : "byok");

  const saveKey = async () => {
    const k = cleanSecret(keyDraft);
    if (k !== keyDraft) setKeyDraft(k);
    if (!k.startsWith("gsk_")) {
      setMsg({ ok: false, text: "Una Groq key empieza por gsk_ (console.groq.com → API Keys)." });
      return;
    }
    setBusy("key");
    setMsg(null);
    try {
      const ok = await verifyGroqKey(k);
      if (!ok) {
        setMsg({ ok: false, text: "Groq rechazó esa key (401). Revísala." });
        return;
      }
      update({ mode: "byok", groqKey: k });
      setMsg({ ok: true, text: "Key verificada. Ya puedes dictar." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const activate = async () => {
    setBusy("code");
    setMsg(null);
    try {
      const r = await activateAccount(apiBase, codeDraft);
      update({ mode: "account", accountToken: r.token, accountEmail: r.email, accountPlan: r.plan });
      setMsg({ ok: true, text: `Cuenta conectada: ${r.email} (${r.plan}).` });
      setCodeDraft("");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const disconnect = () => {
    update({ mode: "none", groqKey: "", accountToken: "", accountEmail: "", accountPlan: "" });
    setKeyDraft("");
    setMsg({ ok: true, text: "Desconectado." });
  };

  const inputCls =
    "mt-1.5 block w-full rounded-md border border-border-2 bg-bg-band px-3.5 py-2.5 text-[16px] text-fg outline-none transition focus:border-accent";

  return (
    <div className="space-y-7">
      <section>
        <p className="eyebrow">conexión</p>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-border bg-bg-band p-1 font-mono text-xs">
          <button type="button" onClick={() => setTab("byok")} className={`rounded-md px-3 py-2 ${tab === "byok" ? "bg-surface text-fg" : "text-faint"}`}>
            Groq key propia
          </button>
          <button type="button" onClick={() => setTab("account")} className={`rounded-md px-3 py-2 ${tab === "account" ? "bg-surface text-fg" : "text-faint"}`}>
            Cuenta KeyLess
          </button>
        </div>

        {tab === "byok" ? (
          <div className="mt-4">
            <label className="block">
              <span className="text-sm text-muted">Groq API key</span>
              <input
                type="password"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="gsk_…"
                className={inputCls}
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              Se guarda solo en este teléfono y va directo a Groq (no pasa por nuestro servidor). La misma key que usas en la app de Windows.
            </p>
            <button type="button" onClick={saveKey} disabled={busy !== ""} className="btn-primary mt-3 w-full text-[15px]" aria-disabled={busy !== ""}>
              {busy === "key" ? "Verificando…" : settings.mode === "byok" && settings.groqKey === cleanSecret(keyDraft) ? "Key guardada ✓" : "Guardar y verificar"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {settings.mode === "account" && settings.accountToken ? (
              <p className="rounded-md border border-accent/30 bg-surface px-3.5 py-3 text-sm">
                Conectado como <span className="text-fg">{settings.accountEmail || "cuenta"}</span>{" "}
                <span className="font-mono text-xs text-faint">({settings.accountPlan})</span>
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-sm text-muted">Código de activación</span>
                  <input
                    type="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
                    placeholder="KF-XXXX-XXXX-XXXX"
                    className={`${inputCls} font-mono`}
                  />
                </label>
                <p className="mt-2 text-xs leading-relaxed text-faint">
                  Lo encuentras en{" "}
                  <a href="/account" className="text-accent underline">
                    tu cuenta
                  </a>
                  . Mismo código que usa la app de escritorio; la cuota se descuenta de tu plan.
                </p>
                <button type="button" onClick={activate} disabled={busy !== ""} className="btn-primary mt-3 w-full text-[15px]" aria-disabled={busy !== ""}>
                  {busy === "code" ? "Conectando…" : "Conectar cuenta"}
                </button>
              </>
            )}
          </div>
        )}

        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-accent" : "text-red-400"}`} role="status">
            {msg.text}
          </p>
        )}
        {settings.mode !== "none" && (
          <button type="button" onClick={disconnect} className="mt-3 font-mono text-xs text-faint underline">
            desconectar
          </button>
        )}
      </section>

      <section>
        <p className="eyebrow">transcripción</p>
        <label className="mt-3 block">
          <span className="text-sm text-muted">Idioma</span>
          <select value={settings.language} onChange={(e) => update({ language: e.target.value as MobileSettings["language"] })} className={inputCls}>
            <option value="auto">Automático (español / inglés)</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="mt-4 flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm text-fg">Limpieza con IA (solo Dictado)</span>
            <span className="block text-xs text-faint">Puntuación, mayúsculas, quita “eh”/“um”. Nunca reescribe. Las conversaciones quedan literales.</span>
          </span>
          <input type="checkbox" checked={settings.cleanup} onChange={(e) => update({ cleanup: e.target.checked })} className="h-6 w-6 accent-[var(--accent)]" />
        </label>
        {settings.cleanup && (
          <label className="mt-4 block">
            <span className="text-sm text-muted">Tono</span>
            <select value={settings.tone} onChange={(e) => update({ tone: e.target.value as Tone })} className={inputCls}>
              {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                <option key={t} value={t}>
                  {TONE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="mt-4 block">
          <span className="text-sm text-muted">Diccionario personal</span>
          <textarea
            value={settings.vocabulary}
            onChange={(e) => update({ vocabulary: e.target.value })}
            rows={3}
            placeholder={"Nombres y términos que Whisper suele escribir mal, uno por línea:\nSinsajo, KeyLess, Gio"}
            className={`${inputCls} resize-none`}
          />
        </label>
      </section>

      <section>
        <p className="eyebrow">copiar para claude</p>
        <label className="mt-3 block">
          <span className="text-sm text-muted">Qué le pides a Claude junto con la transcripción</span>
          <textarea
            value={settings.claudeInstruction}
            onChange={(e) => update({ claudeInstruction: e.target.value })}
            rows={4}
            placeholder={DEFAULT_CLAUDE_INSTRUCTION}
            className={`${inputCls} resize-none`}
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          “Copiar para Claude” pega esto + la fecha y duración + la transcripción entre etiquetas. Si lo dejas vacío se usa el texto de ejemplo.
        </p>
      </section>

      <DiagnosticsSection settings={settings} />

      <section className="border-t border-border pt-5 text-xs leading-relaxed text-faint">
        <p>
          <span className="text-muted">Audios o videos de WhatsApp:</span> mantén pulsado el mensaje → Reenviar/Compartir → Guardar en Archivos → aquí “subir
          audio o video”. Los archivos largos se parten solos.
        </p>
        <p className="mt-2">
          <span className="text-muted">Conversaciones:</span> iOS detiene el micrófono si bloqueas el teléfono o cambias de app. Deja KeyLess abierta; lo grabado se va
          guardando por tramos.
        </p>
      </section>
    </div>
  );
}

/* -------------------------------------------------------- Diagnostics */
/** Plain-text report of this device + the last failures. Never includes keys or transcripts. */
function buildDiagnostics(settings: MobileSettings): string {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const lines = [
    `KeyLess móvil · ${new Date().toISOString()}`,
    `ua: ${nav.userAgent}`,
    `instalada: ${nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches ? "sí" : "no"} · https: ${window.location.protocol === "https:"} · online: ${nav.onLine}`,
    `mediaDevices: ${Boolean(nav.mediaDevices?.getUserMedia)} · MediaRecorder: ${typeof MediaRecorder !== "undefined"} · mime: ${pickRecorderMime() || "default"}`,
    `clipboard: ${Boolean(nav.clipboard?.writeText)} · share: ${typeof nav.share === "function"} · wakeLock: ${"wakeLock" in nav} · sw: ${"serviceWorker" in nav}`,
    `conexión: ${settings.mode}${settings.mode === "byok" ? ` (key de ${settings.groqKey.length} caracteres)` : ""} · modo: ${settings.captureMode} · idioma: ${settings.language} · limpieza: ${settings.cleanup}`,
    "",
    "últimos fallos:",
  ];
  const events = loadDiag();
  if (events.length === 0) lines.push("(ninguno registrado)");
  for (const ev of events) {
    lines.push(`- ${new Date(ev.at).toLocaleString("es")} [${ev.where}] ${ev.message}${ev.detail ? ` — ${ev.detail}` : ""}`);
  }
  return lines.join("\n");
}

function DiagnosticsSection({ settings }: { settings: MobileSettings }) {
  const [report, setReport] = useState("");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const r = buildDiagnostics(settings);
    setReport(r);
    if (await writeClipboard(r)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };
  return (
    <section>
      <p className="eyebrow">diagnóstico</p>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        Si algo falla, toca aquí y pega el resultado en el chat de soporte. No incluye tu key ni tus textos.
      </p>
      <button type="button" onClick={copy} className="btn-ghost mt-3 w-full text-[15px]">
        {copied ? "✓ Diagnóstico copiado" : "Copiar diagnóstico"}
      </button>
      {report && (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg-band p-3 font-mono text-[0.65rem] leading-relaxed text-muted">
          {report}
        </pre>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ History */
const KIND_LABEL: Record<TranscriptKind, string> = { dictado: "dictado", conversacion: "conversación", archivo: "audio" };

function HistoryPanel({
  items,
  toClaude,
  onRemove,
  onClear,
}: {
  items: HistoryItem[];
  toClaude: (h: HistoryItem) => string;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  if (items.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay transcripciones. Se guardan aquí, solo en este teléfono.</p>;
  }
  const copy = async (key: string, t: string) => {
    if (await writeClipboard(t)) {
      setFlash(key);
      window.setTimeout(() => setFlash(null), 1600);
    }
  };
  return (
    <div className="space-y-3">
      {items.map((h) => {
        const long = h.text.length > 320;
        const expanded = open === h.id;
        return (
          <article key={h.id} className="rounded-lg border border-border bg-bg-band p-3.5">
            <p className="font-mono text-[0.66rem] uppercase tracking-widest text-faint">
              {KIND_LABEL[h.kind ?? "dictado"]} · {fmtWhen(h.at)}
              {h.seconds > 0 ? ` · ${fmtClock(h.seconds)}` : ""}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-fg">
              {long && !expanded ? `${h.text.slice(0, 320)}…` : h.text}
            </p>
            {long && (
              <button type="button" className="mt-1 font-mono text-[0.68rem] text-faint underline" onClick={() => setOpen(expanded ? null : h.id)}>
                {expanded ? "ver menos" : "ver todo"}
              </button>
            )}
            <div className="mt-3 flex items-center gap-4 font-mono text-[0.72rem]">
              <button type="button" className="text-accent" onClick={() => copy(`${h.id}:p`, h.text)}>
                {flash === `${h.id}:p` ? "copiado ✓" : "copiar"}
              </button>
              <button type="button" className="text-accent" onClick={() => copy(`${h.id}:c`, toClaude(h))}>
                {flash === `${h.id}:c` ? "listo ✓" : "copiar para Claude"}
              </button>
              <button type="button" className="ml-auto text-faint" onClick={() => onRemove(h.id)}>
                borrar
              </button>
            </div>
          </article>
        );
      })}
      <button type="button" onClick={onClear} className="font-mono text-xs text-faint underline">
        vaciar historial
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- Sheet */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-border-2 bg-surface px-5 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-2" aria-hidden />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="font-mono text-xs text-faint">
            cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- bits */
function IconButton({ label, onClick, children, attention }: { label: string; onClick: () => void; children: React.ReactNode; attention?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="relative rounded-md p-2.5 text-muted transition-colors duration-150 hover:text-fg">
      {children}
      {attention && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent" aria-hidden />}
    </button>
  );
}

function Spinner() {
  return <span aria-hidden className="inline-block h-9 w-9 animate-spin rounded-full border-[3px] border-border-2 border-t-[var(--accent)]" />;
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
