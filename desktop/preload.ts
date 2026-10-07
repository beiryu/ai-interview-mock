import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"

/**
 * The page's only door to the desktop shell: `window.desktop` (see
 * types/desktop.d.ts). Web builds never have it, so every desktop branch in
 * the app is skipped there.
 */

function subscribe<T>(channel: string, callback: (value: T) => void) {
  const listener = (_event: IpcRendererEvent, value: T) => callback(value)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  onShortcut: (callback: (action: string) => void) =>
    subscribe("desktop:shortcut", callback),
  onCompact: (callback: (on: boolean) => void) =>
    subscribe("desktop:compact", callback),
  setCompact: (on: boolean) => ipcRenderer.invoke("desktop:set-compact", on),
  focus: () => ipcRenderer.invoke("desktop:focus"),
  screenshot: (): Promise<string | null> =>
    ipcRenderer.invoke("desktop:screenshot"),
  systemAudio: {
    start: () => ipcRenderer.invoke("desktop:audio-start"),
    stop: () => ipcRenderer.invoke("desktop:audio-stop"),
    onChunk: (callback: (pcm: Uint8Array) => void) =>
      subscribe("desktop:audio-chunk", callback),
    onError: (callback: (message: string) => void) =>
      subscribe("desktop:audio-error", callback),
  },
})
