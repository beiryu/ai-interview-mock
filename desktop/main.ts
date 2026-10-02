import path from "node:path"
import {
  BrowserWindow,
  app,
  globalShortcut,
  ipcMain,
  session,
  shell,
  systemPreferences,
} from "electron"

import { SystemAudio } from "./system-audio"
import { loadState, saveState } from "./window-state"

/**
 * Interview Copilot desktop shell: a window onto the Next app (run it with
 * `pnpm dev`), plus what a browser tab can't do — system audio from any
 * meeting app, global shortcuts, an always-on-top compact overlay, and
 * content protection (hidden from screen capture where the OS honours it;
 * see desktop/README.md).
 */

const APP_URL = process.env.DESKTOP_URL ?? "http://localhost:3000"
const ORIGIN = new URL(APP_URL).origin
const COMPACT = { width: 440, height: 360 }

// Global shortcuts → renderer actions (hooks/use-copilot-hotkeys.ts)
const SHORTCUTS: Record<string, string> = {
  "CommandOrControl+Shift+Enter": "answer-now",
  "CommandOrControl+Shift+X": "skip",
  "CommandOrControl+Shift+E": "regenerate",
}
const TOGGLE_COMPACT = "CommandOrControl+Shift+O"

let win: BrowserWindow | null = null
let compact = false
const state = loadState()
const audio = new SystemAudio()

function isAppUrl(url: string) {
  try {
    return new URL(url).origin === ORIGIN
  } catch {
    return false
  }
}

function setCompact(on: boolean) {
  if (!win || on === compact) return
  const bounds = win.getBounds()
  if (compact) state.compact = bounds
  else state.normal = bounds
  compact = on

  if (on) {
    win.setBounds(state.compact ?? { ...bounds, ...COMPACT })
    // Above full-screen meeting windows, on every Space
    win.setAlwaysOnTop(true, "screen-saver")
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    win.setAlwaysOnTop(false)
    win.setVisibleOnAllWorkspaces(false)
    if (state.normal) win.setBounds(state.normal)
  }
  saveState(state)
  win.webContents.send("desktop:compact", on)
}

function createWindow() {
  win = new BrowserWindow({
    width: state.normal?.width ?? 1400,
    height: state.normal?.height ?? 900,
    x: state.normal?.x,
    y: state.normal?.y,
    title: "Interview Copilot",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.setContentProtection(true)

  // Only the app itself loads in the window; everything else opens outside
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) void shell.openExternal(url)
    return { action: "deny" }
  })
  win.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    void shell.openExternal(url)
  })

  win.on("close", () => {
    if (!win) return
    if (compact) state.compact = win.getBounds()
    else state.normal = win.getBounds()
    saveState(state)
  })
  win.on("closed", () => {
    win = null
    void audio.stop()
  })

  // The Next app may still be starting (`pnpm dev`): keep retrying
  win.webContents.on("did-fail-load", (_event, code, _description, url) => {
    if (code === -3) return // aborted by a redirect
    setTimeout(() => void win?.loadURL(url || `${APP_URL}/dashboard`), 1500)
  })

  void win.loadURL(`${APP_URL}/dashboard`)
}

function registerShortcuts() {
  for (const [accelerator, action] of Object.entries(SHORTCUTS)) {
    globalShortcut.register(accelerator, () =>
      win?.webContents.send("desktop:shortcut", action)
    )
  }
  globalShortcut.register(TOGGLE_COMPACT, () => setCompact(!compact))
}

function registerIpc() {
  ipcMain.handle("desktop:set-compact", (_event, on: boolean) => setCompact(on))
  ipcMain.handle("desktop:audio-start", async () => {
    await audio.start(
      (pcm) => win?.webContents.send("desktop:audio-chunk", pcm),
      (message) => win?.webContents.send("desktop:audio-error", message)
    )
  })
  ipcMain.handle("desktop:audio-stop", () => audio.stop())
}

void app.whenReady().then(() => {
  // The mic (candidate side) still uses getUserMedia in the page
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) =>
      callback(permission === "media" && isAppUrl(details.requestingUrl))
  )
  registerIpc()
  createWindow()
  registerShortcuts()

  // Don't block the window on the macOS permission prompt
  if (process.platform === "darwin") {
    void systemPreferences.askForMediaAccess("microphone")
  }

  app.on("activate", () => {
    if (!win) createWindow()
  })
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
  void audio.stop()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
