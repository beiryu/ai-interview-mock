import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { app, type Rectangle } from "electron"

/** Remembers the normal and compact window bounds across launches. */
type State = { normal?: Rectangle; compact?: Rectangle }

const file = () => path.join(app.getPath("userData"), "window-state.json")

export function loadState(): State {
  try {
    return JSON.parse(readFileSync(file(), "utf8")) as State
  } catch {
    return {}
  }
}

export function saveState(state: State) {
  try {
    writeFileSync(file(), JSON.stringify(state))
  } catch {
    // Non-critical: bounds just won't be remembered
  }
}
