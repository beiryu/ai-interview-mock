import { useEffect } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"

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
 * Playground shortcuts (ignored while typing, e.g. in document chat):
 *   Alt+Enter  answer now
 *   Alt+S      skip the current answer
 *   Alt+R      regenerate the latest answer
 * Uses `event.code` because Alt changes `event.key` on macOS (Alt+S = "ß").
 */
export function useCopilotHotkeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      if (isTyping(event.target)) return

      const { answerNow, skipCurrent, regenerate, messages } =
        useInterviewSessionStore.getState()

      if (event.code === "Enter") {
        answerNow()
      } else if (event.code === "KeyS") {
        skipCurrent()
      } else if (event.code === "KeyR") {
        const last = [...messages]
          .reverse()
          .find((m) => m.questionAnalysis !== null)
        if (!last) return
        regenerate(last.id)
      } else {
        return
      }
      event.preventDefault()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
