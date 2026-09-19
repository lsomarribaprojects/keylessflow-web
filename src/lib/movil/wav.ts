/**
 * Pure PCM → WAV helpers (no imports; unit-tested from scripts/movil_e2e.mjs).
 * Used to cut big audio/video files (> 25 MB, Groq's limit) into 16 kHz mono
 * WAV chunks the transcription API accepts.
 */

/** Encode mono float samples (-1..1) as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** [start, end) sample ranges of at most `chunkSeconds` each. */
export function chunkRanges(totalSamples: number, sampleRate: number, chunkSeconds: number): [number, number][] {
  const size = Math.max(1, Math.floor(sampleRate * chunkSeconds));
  const out: [number, number][] = [];
  for (let s = 0; s < totalSamples; s += size) out.push([s, Math.min(totalSamples, s + size)]);
  return out;
}
