"use client";

/**
 * <MobileDictation /> — the whole /movil app.
 *
 * Flow: tap the big button → MediaRecorder captures the mic → tap again →
 * Whisper (Groq) → hallucination filter → LLM cleanup → text on screen with
 * Copiar / Compartir. Everything the desktop does except the paste-into-
 * other-app step, which iOS does not allow (there's no global clipboard
 * injection for web apps); the user pastes with a long-press instead.
 *
 * iOS notes baked in:
 *   - MediaRecorder on Safari records `audio/mp4` (AAC); Groq accepts it.
 *   - getUserMedia must start from a user gesture → we request it in the
 *     button handler, never on mount.
 *   - navigator.clipboard.writeText needs a user gesture too → the auto-copy
 *     after transcription is best-effort; the "Copiar" button is the reliable
 *     path.
 *   - Wake Lock (iOS 16.4+) keeps the screen on while recording.
 *   - Home-screen install: no `beforeinstallprompt` on iOS → we show a hint.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TONE_LABELS, type Tone } from "@/lib/movil/cleanup";
import { activateAccount, EngineError, verifyGroqKey, type Connection } from "@/lib/movil/engine";
import { runPipeline, type PipelineResult } from "@/lib/movil/pipeline";
import {
  clearHistory,
  loadHistory,
  loadSettings,
  pushHistory,
  removeHistory,
  saveSettings,
  type HistoryItem,
  type MobileSettings,
} from "@/lib/movil/storage";

type Phase = "idle" | "requesting" | "recording" | "processing" | "done" | "error";

const MIME_CANDIDATES: { mime: string; ext: string }[] = [
  { mime: "audio/mp4", ext: "mp4" }, // Safari / iOS
  { mime: "audio/webm;codecs=opus", ext: "webm" }, // Chrome / Android
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" }, // Firefox
];

function pickMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const c of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      /* ignore */
    }
  }
  return { mime: "", ext: "webm" }; // let the browser choose
}

function extFromMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("flac")) return "flac";
  return "webm";
}

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function fmtWhen(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `hoy ${time}`;
  return `${d.toLocaleDateString("es", { day: "numeric", month: "short" })} ${time}`;
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

/**
 * Rendered client-only (see MovilClient.tsx → next/dynamic ssr:false), so the
 * lazy initializers below may read localStorage / navigator safely and there
 * is no server/client hydration mismatch to worry about.
 */
export function MobileDictation({ apiBase }: { apiBase: string }) {
  const [settings, setSettings] = useState<MobileSettings>(() => loadSettings());
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<{ message: string; upgradeUrl?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<"none" | "settings" | "history">("none");
  const [standalone] = useState(() => isStandalone());
  const [ios] = useState(() => isIOS());
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");
  const [busyLabel, setBusyLabel] = useState("");
  const hydrated = true;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    // Offline app shell (external system → effect is the right place).
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
  }, []);

  const connection: Connection | null = useMemo(() => {
    if (settings.mode === "byok" && settings.groqKey) return { kind: "byok", groqKey: settings.groqKey };
    if (settings.mode === "account" && settings.accountToken) {
      return { kind: "account", token: settings.accountToken, apiBase };
    }
    return null;
  }, [settings, apiBase]);

  const updateSettings = useCallback((patch: Partial<MobileSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // ---------------------------------------------------------- recording
  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  };

  const processAudio = useCallback(
    async (blob: Blob, filename: string, recSeconds: number) => {
      if (!connection) {
        setSheet("settings");
        setPhase("idle");
        return;
      }
      setPhase("processing");
      setBusyLabel("Transcribiendo…");
      setError(null);
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await runPipeline(
          connection,
          blob,
          filename,
          {
            language: settings.language,
            cleanup: settings.cleanup,
            tone: settings.tone,
            vocabulary: settings.vocabulary,
          },
          ac.signal,
        );
        if (!res.text) {
          setResult(res);
          setText("");
          setPhase("done");
          return;
        }
        setResult(res);
        setText(res.text);
        setPhase("done");
        setHistory(
          pushHistory({
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            text: res.text,
            at: Date.now(),
            seconds: recSeconds,
            cleaned: res.cleaned,
          }),
        );
        // Best-effort auto copy (Safari usually requires a gesture; the button is the fallback).
        try {
          await navigator.clipboard.writeText(res.text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          /* user taps Copiar */
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          setPhase("idle");
          return;
        }
        const err = e as EngineError;
        setError({ message: err?.message ?? String(e), upgradeUrl: err?.upgradeUrl });
        setPhase("error");
        if (err?.code === "invalid_key" || err?.code === "invalid_token") setSheet("settings");
      } finally {
        abortRef.current = null;
        setBusyLabel("");
      }
    },
    [connection, settings.cleanup, settings.language, settings.tone, settings.vocabulary],
  );

  const startRecording = useCallback(async () => {
    if (!connection) {
      setSheet("settings");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError({ message: "Este navegador no permite grabar audio. En iPhone usa Safari." });
      setPhase("error");
      return;
    }
    const picked = pickMime();
    if (!picked) {
      setError({ message: "Este navegador no soporta grabación (MediaRecorder). Actualiza iOS o usa Safari." });
      setPhase("error");
      return;
    }
    setPhase("requesting");
    setError(null);
    setResult(null);
    setText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const rec = picked.mime ? new MediaRecorder(stream, { mimeType: picked.mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stopTimer();
        const mime = rec.mimeType || picked.mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        const recSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        releaseStream();
        if (blob.size < 1500 || recSeconds < 1) {
          setError({ message: "Grabación demasiado corta. Mantén el micrófono un momento más." });
          setPhase("error");
          return;
        }
        void processAudio(blob, `grabacion.${extFromMime(mime)}`, recSeconds);
      };
      rec.onerror = () => {
        stopTimer();
        releaseStream();
        setError({ message: "La grabación falló. Intenta de nuevo." });
        setPhase("error");
      };
      recorderRef.current = rec;
      rec.start(1000);
      startedAtRef.current = Date.now();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      }, 500);
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        wakeLockRef.current = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        /* optional */
      }
    } catch (e) {
      releaseStream();
      const name = (e as Error)?.name ?? "";
      const msg =
        name === "NotAllowedError"
          ? "Sin permiso de micrófono. En iPhone: Ajustes → Safari → Micrófono → Permitir (o Ajustes → KeyLess si la instalaste)."
          : name === "NotFoundError"
            ? "No se encontró micrófono."
            : `No se pudo iniciar la grabación (${name || "error"}).`;
      setError({ message: msg });
      setPhase("error");
    }
  }, [connection, processAudio]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  }, []);

  const cancelProcessing = () => {
    abortRef.current?.abort();
  };

  useEffect(() => () => {
    // unmount safety
    stopTimer();
    releaseStream();
  }, []);

  // ------------------------------------------------------------- actions
  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Legacy path (rare on iOS ≥ 13.4)
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const shareText = async () => {
    if (!text || !navigator.share) return;
    try {
      await navigator.share({ text });
    } catch {
      /* cancelled */
    }
  };

  const onPickFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : extFromMime(file.type);
    await processAudio(file, `archivo.${ext}`, 0);
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setText("");
    setError(null);
  };

  // ------------------------------------------------------------ render
  const recording = phase === "recording";
  const processing = phase === "processing" || phase === "requesting";
  const showInstallHint = hydrated && ios && !standalone && !settings.installHintDismissed;

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-bg text-fg"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        touchAction: "manipulation",
      }}
    >
      {/* Top bar */}
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
          <IconButton label="Ajustes" onClick={() => setSheet("settings")} attention={hydrated && !connection}>
            <GearIcon />
          </IconButton>
        </div>
      </header>

      {/* Install hint (iOS only, outside the installed app) */}
      {showInstallHint && (
        <div className="mx-5 mt-2 rounded-lg border border-accent/30 bg-surface px-4 py-3 text-sm">
          <p className="text-fg">
            Instálala como app: toca <span className="font-mono text-accent">Compartir</span> y luego{" "}
            <span className="font-mono text-accent">Añadir a pantalla de inicio</span>.
          </p>
          <button
            type="button"
            className="mt-2 font-mono text-xs text-faint"
            onClick={() => updateSettings({ installHintDismissed: true })}
          >
            entendido
          </button>
        </div>
      )}

      {/* Main */}
      <main className="flex flex-1 flex-col px-5 pb-6">
        {/* Status / result area */}
        <section className="mt-4 flex-1">
          {phase === "idle" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="font-display text-2xl font-semibold tracking-tight">
                {connection ? "Toca y habla." : "Conecta tu cuenta."}
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                {connection
                  ? "Cuando termines, toca de nuevo. El texto aparece aquí listo para copiar o compartir."
                  : "En Ajustes pega tu Groq key (BYOK) o el código de activación de tu cuenta KeyLess."}
              </p>
              {hydrated && connection && (
                <p className="mt-4 font-mono text-[0.7rem] text-faint">
                  {connection.kind === "byok" ? "Groq key propia" : `Cuenta · ${settings.accountEmail || settings.accountPlan}`}
                  {" · "}
                  {settings.language === "auto" ? "idioma auto" : settings.language}
                  {" · "}
                  {settings.cleanup ? `limpieza ${TONE_LABELS[settings.tone].toLowerCase()}` : "sin limpieza"}
                </p>
              )}
            </div>
          )}

          {(phase === "requesting" || phase === "recording") && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="wave" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <i key={i} style={{ animationDelay: `${i * 90}ms`, animationPlayState: recording ? "running" : "paused" }} />
                ))}
              </div>
              <p className="font-display mt-6 text-4xl font-semibold tabular-nums tracking-tight">
                {recording ? fmtClock(seconds) : "0:00"}
              </p>
              <p className="mt-2 text-sm text-muted">
                {recording ? "Grabando · toca para terminar" : "Pidiendo micrófono…"}
              </p>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Spinner />
              <p className="font-display mt-5 text-xl font-semibold">{busyLabel || "Procesando…"}</p>
              <p className="mt-1 font-mono text-xs text-faint">Whisper · limpieza IA</p>
              <button type="button" onClick={cancelProcessing} className="mt-6 font-mono text-xs text-faint underline">
                cancelar
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="flex h-full flex-col">
              {text ? (
                <>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                    className="min-h-[11rem] w-full flex-1 resize-none rounded-lg border border-border-2 bg-surface px-4 py-3 text-[17px] leading-relaxed text-fg outline-none focus:border-accent"
                    aria-label="Texto transcrito"
                  />
                  <p className="mt-2 font-mono text-[0.68rem] text-faint">
                    {result?.cleaned ? "limpieza IA ✓" : result?.cleanupError ? "sin limpieza (se usó el texto original)" : "texto sin limpiar"}
                    {" · "}
                    {Math.round(((result?.transcribeMs ?? 0) + (result?.cleanupMs ?? 0)) / 100) / 10}s
                    {copied ? " · copiado ✓" : ""}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button type="button" onClick={copyText} className="btn-primary text-[15px]">
                      {copied ? "✓ Copiado" : "Copiar"}
                    </button>
                    {canShare ? (
                      <button type="button" onClick={shareText} className="btn-ghost text-[15px]">
                        Compartir
                      </button>
                    ) : (
                      <button type="button" onClick={reset} className="btn-ghost text-[15px]">
                        Nuevo
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="font-display text-xl font-semibold">No se detectó voz</p>
                  <p className="mt-2 max-w-xs text-sm text-muted">
                    Whisper no encontró palabras claras. Acércate al micrófono e intenta de nuevo.
                  </p>
                </div>
              )}
            </div>
          )}

          {phase === "error" && error && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="font-display text-xl font-semibold text-red-400">Algo falló</p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{error.message}</p>
              {error.upgradeUrl && (
                <a href={error.upgradeUrl} className="btn-primary mt-5 text-sm">
                  Ver planes
                </a>
              )}
            </div>
          )}
        </section>

        {/* Record button — always in thumb reach */}
        <section className="mt-6 flex flex-col items-center">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={processing}
            aria-label={recording ? "Detener grabación" : "Empezar a grabar"}
            aria-pressed={recording}
            className="rec-btn"
            data-recording={recording ? "true" : "false"}
          >
            <span className="rec-btn-inner" />
          </button>
          <div className="mt-4 flex items-center gap-5 font-mono text-[0.72rem] text-faint">
            {phase === "done" && text ? (
              <button type="button" onClick={reset} className="underline">
                nueva grabación
              </button>
            ) : (
              <span>{recording ? "toca para terminar" : "toca para dictar"}</span>
            )}
            <span aria-hidden>·</span>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={processing || recording} className="underline">
              transcribir un audio
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav,.ogg,.opus,.webm" className="hidden" onChange={onPickFile} />
          </div>
        </section>
      </main>

      {/* Sheets */}
      {sheet === "settings" && (
        <Sheet title="Ajustes" onClose={() => setSheet("none")}>
          <SettingsPanel settings={settings} update={updateSettings} apiBase={apiBase} />
        </Sheet>
      )}
      {sheet === "history" && (
        <Sheet title="Historial" onClose={() => setSheet("none")}>
          <HistoryPanel
            items={history}
            onCopy={async (t) => {
              try {
                await navigator.clipboard.writeText(t);
              } catch {
                /* ignore */
              }
            }}
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
    const k = keyDraft.trim();
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
      {/* Connection */}
      <section>
        <p className="eyebrow">conexión</p>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-border bg-bg-band p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setTab("byok")}
            className={`rounded-md px-3 py-2 ${tab === "byok" ? "bg-surface text-fg" : "text-faint"}`}
          >
            Groq key propia
          </button>
          <button
            type="button"
            onClick={() => setTab("account")}
            className={`rounded-md px-3 py-2 ${tab === "account" ? "bg-surface text-fg" : "text-faint"}`}
          >
            Cuenta KeyLess
          </button>
        </div>

        {tab === "byok" ? (
          <div className="mt-4">
            <label className="block">
              <span className="text-sm text-muted">Groq API key</span>
              <input
                type="password"
                inputMode="text"
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
              Se guarda solo en este teléfono y va directo a Groq (no pasa por nuestro servidor). La misma
              key que usas en la app de Windows.
            </p>
            <button type="button" onClick={saveKey} disabled={busy !== ""} className="btn-primary mt-3 w-full text-[15px]" aria-disabled={busy !== ""}>
              {busy === "key" ? "Verificando…" : settings.mode === "byok" && settings.groqKey === keyDraft.trim() ? "Key guardada ✓" : "Guardar y verificar"}
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
                    inputMode="text"
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

      {/* Dictation */}
      <section>
        <p className="eyebrow">dictado</p>
        <label className="mt-3 block">
          <span className="text-sm text-muted">Idioma</span>
          <select
            value={settings.language}
            onChange={(e) => update({ language: e.target.value as MobileSettings["language"] })}
            className={inputCls}
          >
            <option value="auto">Automático (es / en)</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="mt-4 flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm text-fg">Limpieza con IA</span>
            <span className="block text-xs text-faint">Puntuación, mayúsculas, quita “eh”/“um”. Nunca reescribe.</span>
          </span>
          <input
            type="checkbox"
            checked={settings.cleanup}
            onChange={(e) => update({ cleanup: e.target.checked })}
            className="h-6 w-6 accent-[var(--accent)]"
          />
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

      <section className="border-t border-border pt-5 text-xs leading-relaxed text-faint">
        <p>
          En iPhone no existe “pegar donde está el cursor” para apps web: copia y pega con una pulsación larga.
          Para audios de WhatsApp: mantén el audio → Compartir → Guardar en Archivos → aquí “transcribir un audio”.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ History */
function HistoryPanel({
  items,
  onCopy,
  onRemove,
  onClear,
}: {
  items: HistoryItem[];
  onCopy: (t: string) => Promise<void>;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  if (items.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay dictados. Se guardan aquí, solo en este teléfono.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((h) => (
        <article key={h.id} className="rounded-lg border border-border bg-bg-band p-3.5">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{h.text}</p>
          <div className="mt-2.5 flex items-center gap-3 font-mono text-[0.68rem] text-faint">
            <span>{fmtWhen(h.at)}</span>
            {h.seconds > 0 && <span>{fmtClock(h.seconds)}</span>}
            <span className="ml-auto flex gap-3">
              <button
                type="button"
                className="text-accent"
                onClick={async () => {
                  await onCopy(h.text);
                  setCopiedId(h.id);
                  window.setTimeout(() => setCopiedId(null), 1500);
                }}
              >
                {copiedId === h.id ? "copiado ✓" : "copiar"}
              </button>
              <button type="button" onClick={() => onRemove(h.id)}>
                borrar
              </button>
            </span>
          </div>
        </article>
      ))}
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
function IconButton({
  label,
  onClick,
  children,
  attention,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  attention?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative rounded-md p-2.5 text-muted transition-colors duration-150 hover:text-fg"
    >
      {children}
      {attention && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent" aria-hidden />}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-9 w-9 animate-spin rounded-full border-[3px] border-border-2 border-t-[var(--accent)]"
    />
  );
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
