import { useEffect } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"

import { getDesktop } from "@/lib/desktop"

function regenerateLatest() {
  const { regenerate, messages } = useInterviewSessionStore.getState()
  const last = [...messages].reverse().find((m) => m.questionAnalysis !== null)
  if (last) regenerate(last.id)
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

/**
 * Playground shortcuts (ignored while typing, e.g. in the chat):
 *   Alt+Enter  answer now
 *   Alt+S      skip the current answer
 *   Alt+R      regenerate the latest answer
 * Uses `event.code` because Alt changes `event.key` on macOS (Alt+S = "ß").
 *
 * In the desktop app the same actions also come from global shortcuts
 * (desktop/main.ts), which work while the meeting app has focus.
 */
export function useCopilotHotkeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      if (isTyping(event.target)) return

      const { answerNow, skipCurrent } = useInterviewSessionStore.getState()

      if (event.code === "Enter") {
        answerNow()
      } else if (event.code === "KeyS") {
        skipCurrent()
      } else if (event.code === "KeyR") {
        regenerateLatest()
      } else {
        return
      }
      event.preventDefault()
    }

    window.addEventListener("keydown", onKeyDown)

    const offShortcut = getDesktop()?.onShortcut((action) => {
      const { answerNow, skipCurrent } = useInterviewSessionStore.getState()
      if (action === "answer-now") answerNow()
      else if (action === "skip") skipCurrent()
      else if (action === "regenerate") regenerateLatest()
      // "screenshot"/"capture"/view shortcuts are owned by the overlay
      // (components/compact-overlay.tsx), not here
    })

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      offShortcut?.()
    }
  }, [])
}
