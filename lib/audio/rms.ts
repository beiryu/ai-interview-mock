/**
 * RMS level (0..1) of 16-bit PCM — the same measure the capture worklet
 * reports (public/worklets/pcm-capture.js), so the speech threshold
 * (SPEECH_RMS) means the same thing for every audio source.
 */
export function pcm16Rms(pcm: Int16Array) {
  if (pcm.length === 0) return 0
  let sum = 0
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff
    sum += sample * sample
  }
  return Math.sqrt(sum / pcm.length)
}

/** Copies bytes into an Int16Array (IPC buffers may be unaligned). */
export function toPcm16(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength - (bytes.byteLength % 2))
  copy.set(bytes.subarray(0, copy.byteLength))
  return new Int16Array(copy.buffer)
}
