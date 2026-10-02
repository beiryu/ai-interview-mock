/** Bridge exposed by the Electron shell (desktop/preload.ts); absent on the web. */
interface DesktopBridge {
  isDesktop: true
  platform: string
  onShortcut(callback: (action: string) => void): () => void
  onCompact(callback: (on: boolean) => void): () => void
  setCompact(on: boolean): Promise<void>
  systemAudio: {
    start(): Promise<void>
    stop(): Promise<void>
    /** 120 ms of 16 kHz mono pcm_s16le */
    onChunk(callback: (pcm: Uint8Array) => void): () => void
    onError(callback: (message: string) => void): () => void
  }
}

interface Window {
  desktop?: DesktopBridge
}
