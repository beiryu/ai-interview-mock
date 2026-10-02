# Interview Copilot — desktop shell

A thin Electron window onto the Next app, adding what a browser tab can't do:

- **System audio** from any meeting app (Meet in Chrome, Teams…) via Core Audio
  taps ([`audiotee`](https://www.npmjs.com/package/audiotee), macOS 14.2+) — no
  tab sharing. Your mic still uses `getUserMedia`.
- **Global shortcuts** that work while the meeting app has focus.
- **Compact overlay**: a small always-on-top panel (status + latest answer),
  visible over full-screen windows and on every Space.
- **Content protection** (`setContentProtection`) — see the caveat below.

Everything else (turn engine, Soniox, coach, prep, DB) is the same code as the
web app; desktop-only branches check `window.desktop` (`desktop/preload.ts`,
`types/desktop.d.ts`).

## Run

```bash
pnpm dev        # the Next app on http://localhost:3000 (DESKTOP_URL to change)
pnpm desktop    # builds desktop/dist and opens the window (retries until Next is up)
```

The first `pnpm desktop` downloads the Electron binary if the install skipped it.

**Sign in:** the emailed magic link opens in your default browser, so the session
would land there. Request the email from the desktop window, **copy** the link
(don't open it) and paste it into "Sign in with link" on the login page.

## macOS permissions

When Electron is launched from a terminal, macOS attributes permissions to the
**terminal app** (Terminal, iTerm, VS Code…). Without them capture silently
returns zeros — no error.

- System Settings → Privacy & Security → **Screen & System Audio Recording** →
  **System Audio Recording Only** (the lower section) → add your terminal app.
- Privacy & Security → **Microphone** → allow the same terminal app.

Restart the terminal after granting. A packaged, signed app would get its own
entry instead (not built yet).

## Shortcuts (global)

| Shortcut  | Action                       |
| --------- | ---------------------------- |
| `⌘⇧Enter` | Answer now                   |
| `⌘⇧X`     | Skip the current answer      |
| `⌘⇧E`     | Regenerate the latest answer |
| `⌘⇧O`     | Toggle the compact overlay   |

In-page shortcuts from the web app (`Alt+Enter`, `Alt+S`, `Alt+R`) still work
when the window has focus.

## Hidden from screen sharing?

`setContentProtection(true)` sets `NSWindow.sharingType = .none`. Electron's
docs warn that _"newer Mac applications that use ScreenCaptureKit will capture
your window despite"_ it, so it depends on the meeting app and on what you
share. Fill this in from a real test (ask someone in the call what they see):

| What you share | Meet (Chrome) | Teams |
| -------------- | ------------- | ----- |
| Entire screen  | ?             | ?     |
| One window     | ?             | ?     |
| One tab        | ?             | —     |

**Always safe:** share a single window or tab (the overlay is never part of
it), or keep the overlay on a screen you don't share.

## Verified so far (2026-10-02, macOS 26.5, Apple Silicon, Electron 44.5.1)

- Window loads the app; `window.desktop` is exposed; the login page shows the
  paste-link form.
- System audio pipeline: 120 ms chunks of 1920 samples (16 kHz mono Int16)
  reach the page — but silent until the permission above is granted.
- Compact mode: 1400×868 → 440×328 and back, state event reaches the page.
- Not yet verified by a person: shortcuts while Meet/Teams has focus, real
  transcription of a meeting, and the screen-sharing table.
