/**
 * Browser-only: turn a big audio/video file (a long WhatsApp voice note, a
 * forwarded video, a meeting recording) into ≤ 8-minute 16 kHz mono WAV chunks
 * (~15 MB each) so every piece fits Groq's 25 MB upload limit.
 *
 * Decoding happens in memory, so there is a practical ceiling (≈ 90 min of
 * audio on a phone). Beyond that we fail with a clear message instead of
 * crashing the tab.
 */
import { chunkRanges, encodeWav } from "./wav";

export const SPLIT_CHUNK_SECONDS = 480;
const MAX_DECODE_BYTES = 200 * 1024 * 1024;

export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitError";
  }
}

export async function splitAudioToWavChunks(file: Blob, chunkSeconds = SPLIT_CHUNK_SECONDS): Promise<Blob[]> {
  if (file.size > MAX_DECODE_BYTES) {
    throw new SplitError("El archivo es demasiado grande para procesarlo en el teléfono (máx. ~200 MB). Recórtalo o usa la app de Windows.");
  }
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctx = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctx || typeof OfflineAudioContext === "undefined") {
    throw new SplitError("Este navegador no puede dividir audios largos. Usa un archivo de menos de 25 MB.");
  }
  let decoded: AudioBuffer;
  const ctx = new Ctx();
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new SplitError("No se pudo leer el audio de este archivo (formato no soportado por el navegador).");
  } finally {
    void ctx.close().catch(() => undefined);
  }

  // Resample + downmix to mono. Old WebKit refuses rates < 22050 → fall back.
  let rendered: AudioBuffer | null = null;
  for (const rate of [16_000, 22_050]) {
    try {
      const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
      const src = off.createBufferSource();
      src.buffer = decoded;
      src.connect(off.destination);
      src.start();
      rendered = await off.startRendering();
      break;
    } catch {
      rendered = null;
    }
  }
  if (!rendered) throw new SplitError("No se pudo preparar el audio para transcribirlo.");

  const data = rendered.getChannelData(0);
  const rate = rendered.sampleRate;
  // 22.05 kHz → shorter chunks so each WAV stays < 25 MB.
  const seconds = rate > 16_000 ? Math.min(chunkSeconds, 360) : chunkSeconds;
  return chunkRanges(data.length, rate, seconds).map(
    ([a, b]) => new Blob([encodeWav(data.subarray(a, b), rate)], { type: "audio/wav" }),
  );
}
