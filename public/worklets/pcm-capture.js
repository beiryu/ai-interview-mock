/**
 * AudioWorklet: downmix to mono, resample to 16 kHz, emit Int16 PCM chunks.
 *
 * Posts `{ pcm: ArrayBuffer, rms: number }` every CHUNK_SAMPLES output samples
 * (120 ms at 16 kHz). `rms` is the chunk's root-mean-square level (0..1) and is
 * used as a cheap voice-activity signal on the main thread.
 */
const TARGET_RATE = 16000
const CHUNK_SAMPLES = 1920 // 120 ms at 16 kHz

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // `sampleRate` is the AudioContext rate (global in the worklet scope)
    this.step = sampleRate / TARGET_RATE
    this.phase = 0
    this.acc = 0
    this.accCount = 0
    this.chunk = new Int16Array(CHUNK_SAMPLES)
    this.chunkLen = 0
    this.sumSquares = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const channels = input.length
    const frames = input[0].length

    for (let i = 0; i < frames; i++) {
      let sample = 0
      for (let c = 0; c < channels; c++) sample += input[c][i]
      sample /= channels

      // Box-filter decimation: average the input samples that fall into
      // each output sample period
      this.acc += sample
      this.accCount++
      this.phase += 1
      if (this.phase < this.step) continue
      this.phase -= this.step

      const out = Math.max(-1, Math.min(1, this.acc / this.accCount))
      this.acc = 0
      this.accCount = 0

      this.chunk[this.chunkLen++] = out < 0 ? out * 0x8000 : out * 0x7fff
      this.sumSquares += out * out

      if (this.chunkLen === CHUNK_SAMPLES) {
        const rms = Math.sqrt(this.sumSquares / CHUNK_SAMPLES)
        const pcm = this.chunk.buffer
        this.port.postMessage({ pcm, rms }, [pcm])
        this.chunk = new Int16Array(CHUNK_SAMPLES)
        this.chunkLen = 0
        this.sumSquares = 0
      }
    }

    return true
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor)
