/**
 * SegmentedRecorder — microphone capture for /movil that survives LONG
 * recordings (conversations, meetings).
 *
 * Groq rejects uploads > 25 MB, and one giant blob would also be lost entirely
 * if the phone kills the page. So, like the desktop's 10-minute chunks, we
 * rotate the MediaRecorder every `segmentMs` on the SAME MediaStream: each
 * stop() yields a complete, independently decodable file that is handed to
 * `onSegment` right away (the UI transcribes it while recording continues).
 * The gap between segments is a few milliseconds.
 *
 * iOS specifics: Safari records `audio/mp4`; if the app is backgrounded or a
 * call comes in, iOS ends the audio track → we finish gracefully with
 * `interrupted: true` so everything captured so far is still transcribed.
 * Wake Lock keeps the screen on (re-acquired when the page becomes visible).
 */

// Order matters: Chromium ALSO claims "audio/mp4" but fills it with Opus
// (`audio/mp4;codecs=opus`, seen 2026-09-18), an odd combo for server-side
// decoders. So: WebM/Opus where it exists (Chrome, Android, Firefox, new
// Safari), and MP4/AAC only as the fallback — which is what iOS Safari gives.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4", // Safari / iOS → AAC
  "audio/ogg;codecs=opus",
];

export function extFromMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("flac")) return "flac";
  return "webm";
}

export class RecorderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecorderError";
  }
}

export interface SegmentedRecorderOptions {
  segmentMs: number;
  onSegment: (blob: Blob, mime: string, index: number) => void;
  onFinished: (info: { interrupted: boolean; segments: number }) => void;
  onError: (err: RecorderError) => void;
}

type WakeLockSentinelLike = { release: () => Promise<void> };

export class SegmentedRecorder {
  private opts: SegmentedRecorderOptions;
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private mime = "";
  private active = false;
  private interrupted = false;
  private index = 0;
  private timer: number | null = null;
  private wakeLock: WakeLockSentinelLike | null = null;
  private onVisibility = () => {
    if (document.visibilityState === "visible" && this.active) void this.acquireWakeLock();
  };

  constructor(opts: SegmentedRecorderOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new RecorderError("Este navegador no permite grabar audio. En iPhone usa Safari.");
    }
    if (typeof MediaRecorder === "undefined") {
      throw new RecorderError("Este navegador no soporta grabación (MediaRecorder). Actualiza iOS o usa Safari.");
    }
    this.mime = "";
    for (const m of MIME_CANDIDATES) {
      try {
        if (MediaRecorder.isTypeSupported(m)) {
          this.mime = m;
          break;
        }
      } catch {
        /* ignore */
      }
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const name = (e as Error)?.name ?? "";
      throw new RecorderError(
        name === "NotAllowedError"
          ? "Sin permiso de micrófono. En iPhone: Ajustes → Safari → Micrófono → Permitir."
          : name === "NotFoundError"
            ? "No se encontró micrófono."
            : `No se pudo iniciar la grabación (${name || "error"}).`,
      );
    }
    this.stream.getAudioTracks().forEach((t) => {
      t.onended = () => {
        // iOS backgrounded the app / a call came in / mic was taken away.
        if (!this.active) return;
        this.interrupted = true;
        this.stop();
      };
    });
    this.active = true;
    this.interrupted = false;
    this.index = 0;
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.acquireWakeLock();
    this.beginSegment();
  }

  /** Finish the recording; the last segment is delivered, then onFinished fires. */
  stop(): void {
    if (!this.active && !this.rec) return;
    this.active = false;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    const rec = this.rec;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        this.finish();
      }
    } else {
      this.finish();
    }
  }

  private beginSegment(): void {
    if (!this.stream) return;
    const chunks: Blob[] = [];
    const myIndex = this.index;
    let rec: MediaRecorder;
    try {
      // 48 kbps is plenty for speech and keeps a 4-minute segment ≈ 1.5 MB.
      const options: MediaRecorderOptions = { audioBitsPerSecond: 48_000 };
      if (this.mime) options.mimeType = this.mime;
      rec = new MediaRecorder(this.stream, options);
    } catch {
      rec = new MediaRecorder(this.stream);
    }
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    rec.onerror = () => {
      this.opts.onError(new RecorderError("La grabación falló. Intenta de nuevo."));
      this.active = false;
      this.finish();
    };
    rec.onstop = () => {
      const mime = rec.mimeType || this.mime || "audio/webm";
      const blob = new Blob(chunks, { type: mime });
      if (blob.size > 1500) {
        this.opts.onSegment(blob, mime, myIndex);
        this.index += 1;
      }
      if (this.active) this.beginSegment();
      else this.finish();
    };
    this.rec = rec;
    rec.start();
    this.timer = window.setTimeout(() => {
      if (this.active && rec.state !== "inactive") rec.stop(); // rotates → onstop → next segment
    }, this.opts.segmentMs);
  }

  private finish(): void {
    this.rec = null;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
    this.opts.onFinished({ interrupted: this.interrupted, segments: this.index });
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
      };
      this.wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* optional */
    }
  }
}
