import path from "node:path"
import {
  BrowserWindow,
  app,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
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
// Wide enough for the overlay's control bar in one row
const COMPACT = { width: 820, height: 480 }
const COMPACT_MIN = { width: 760, height: 280 }
// Saved bounds outside min..max (e.g. a double-click zoom) fall back to COMPACT
const COMPACT_MAX = { width: 1000, height: 860 }
const NORMAL_MIN = { width: 360, height: 220 }
const MAC = process.platform === "darwin"

// Next listens on 127.0.0.1 only, but "localhost" may resolve to ::1 first,
// where another dev server can answer with its own 404s
app.commandLine.appendSwitch("host-resolver-rules", "MAP localhost 127.0.0.1")

// Global shortcuts → renderer actions (hooks/use-copilot-hotkeys.ts)
const SHORTCUTS: Record<string, string> = {
  "CommandOrControl+Shift+Enter": "answer-now",
  "CommandOrControl+Shift+X": "skip",
  "CommandOrControl+Shift+E": "regenerate",
  // Overlay chat (components/compact-overlay.tsx); overrides Chrome's
  // inspect-element shortcut while the app runs
  "CommandOrControl+Shift+C": "chat",
  // Overlay mode group (components/compact-overlay.tsx): select a view
  "CommandOrControl+Shift+I": "interview",
  "CommandOrControl+Shift+S": "screenshot",
  // ⌘⇧C "chat" is declared above; ⌘⇧P captures inside the Screenshot view
  "CommandOrControl+Shift+P": "capture",
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
  // Before resizing: the new size must fit the new min/max
  setFloating(on)

  if (on) {
    const saved = state.compact
    const fits =
      saved &&
      saved.width >= COMPACT_MIN.width &&
      saved.width <= COMPACT_MAX.width &&
      saved.height >= COMPACT_MIN.height &&
      saved.height <= COMPACT_MAX.height
    win.setBounds(fits ? saved : { x: bounds.x, y: bounds.y, ...COMPACT })
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

/**
 * macOS compact mode floats: the window itself is clear (created
 * `transparent`), so only the overlay's cards show, with the meeting
 * visible through and between them. No traffic lights, no window shadow.
 */
function setFloating(on: boolean) {
  if (!win) return
  // Double-clicking the drag bar would otherwise zoom the overlay to full size
  win.setMaximizable(!on)
  if (on) {
    win.setMinimumSize(COMPACT_MIN.width, COMPACT_MIN.height)
    win.setMaximumSize(COMPACT_MAX.width, COMPACT_MAX.height)
  } else {
    win.setMaximumSize(0, 0)
    win.setMinimumSize(NORMAL_MIN.width, NORMAL_MIN.height)
  }
  if (!MAC) return
  win.setWindowButtonVisibility(!on)
  win.setHasShadow(!on)
}

function createWindow() {
  // Default to full screen height (minus the menu bar / dock) on first launch
  const workArea = screen.getPrimaryDisplay().workArea
  const defaultWidth = Math.min(1400, workArea.width)
  win = new BrowserWindow({
    width: state.normal?.width ?? defaultWidth,
    height: state.normal?.height ?? workArea.height,
    x:
      state.normal?.x ??
      workArea.x + Math.round((workArea.width - defaultWidth) / 2),
    y: state.normal?.y ?? workArea.y,
    minWidth: NORMAL_MIN.width,
    minHeight: NORMAL_MIN.height,
    title: "Interview Copilot",
    // The page draws its own title bar strip (components/desktop-chrome.tsx),
    // so compact mode can drop it entirely
    ...(MAC && {
      titleBarStyle: "hidden" as const,
      trafficLightPosition: { x: 12, y: 8 },
      // Clear so compact mode can float; the page paints the normal window
      transparent: true,
    }),
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
  // Typing in the overlay's chat needs the window focused (not the meeting)
  ipcMain.handle("desktop:focus", () => {
    win?.show()
    win?.focus()
  })
  ipcMain.handle("desktop:audio-start", async () => {
    await audio.start(
      (pcm) => win?.webContents.send("desktop:audio-chunk", pcm),
      (message) => win?.webContents.send("desktop:audio-error", message)
    )
  })
  ipcMain.handle("desktop:audio-stop", () => audio.stop())
  // A screenshot of the screen under the overlay (coding-question capture).
  // The overlay is briefly hidden so it isn't in the shot; needs macOS
  // Screen Recording permission (same as system audio).
  ipcMain.handle("desktop:screenshot", async () => {
    if (!win) return null
    // Fade the overlay out (not hide): it stays on its Space and keeps focus,
    // but is invisible so it isn't in the shot. A short wait lets the
    // compositor apply the opacity before the capture.
    win.setOpacity(0)
    await new Promise((resolve) => setTimeout(resolve, 60))
    try {
      // Logical resolution (not × scaleFactor): plenty to read a coding
      // problem, and keeps the data URL small enough for the model + route
      const display = screen.getPrimaryDisplay()
      const { width, height } = display.size
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width, height },
      })
      const source =
        sources.find((s) => String(s.display_id) === String(display.id)) ??
        sources[0]
      return source ? source.thumbnail.toDataURL() : null
    } catch {
      return null
    } finally {
      win.setOpacity(1)
    }
  })
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
