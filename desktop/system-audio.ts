import { AudioTee } from "audiotee"

/**
 * System audio (whatever plays through the speakers/headphones: Meet in
 * Chrome, Teams…) via Core Audio taps (macOS 14.2+), as 16 kHz mono Int16 in
 * 120 ms chunks — the exact frames the web pipeline already sends to Soniox.
 *
 * macOS asks for "System Audio Recording" the first time; without it the tap
 * delivers silence rather than an error (see desktop/README.md).
 */
export class SystemAudio {
  private tee: AudioTee | null = null

  async start(
    onChunk: (pcm: Buffer) => void,
    onError: (message: string) => void
  ) {
    if (this.tee) return
    const tee = new AudioTee({ sampleRate: 16000, chunkDurationMs: 120 })
    tee.on("data", ({ data }: { data: Buffer }) => onChunk(data))
    tee.on("error", (error: Error) => onError(error.message))
    this.tee = tee
    try {
      await tee.start()
    } catch (error) {
      this.tee = null
      onError(error instanceof Error ? error.message : String(error))
    }
  }

  async stop() {
    const tee = this.tee
    this.tee = null
    await tee?.stop().catch(() => {})
  }
}
