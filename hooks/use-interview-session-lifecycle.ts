import { useCallback, useEffect, useRef, useState } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"

import type { TranscriptEntry } from "@/lib/validations/interview-session"
import { updateInterviewSession } from "@/hooks/api/interview-session/update-interview-session"
import useCreateInterviewSession from "@/hooks/api/interview-session/useCreateInterviewSession"

const AUTOSAVE_INTERVAL_MS = 30_000

function snapshotTranscript(): TranscriptEntry[] {
  return useInterviewSessionStore
    .getState()
    .messages.filter((m) => m.role === "interviewer" || m.role === "candidate")
    .map((m) => ({
      role: m.role as TranscriptEntry["role"],
      text: m.content,
      at: new Date(m.createdAt).toISOString(),
    }))
}

/**
 * Owns the DB InterviewSession for a playground visit:
 * - creates it lazily, once capture starts (not on page load)
 * - autosaves the transcript every 30s while it changes
 * - saves it on "End session", on leaving the page, and (best effort)
 *   via sendBeacon when the tab is closed
 * - clears the previous transcript/answers whenever the interview changes
 */
export function useInterviewSessionLifecycle(interviewId: string) {
  const { mutateAsync: createSession } = useCreateInterviewSession()
  const microphoneStatus = useInterviewSessionStore((s) => s.microphoneStatus)
  const messageCount = useInterviewSessionStore((s) => s.messages.length)
  const startSession = useInterviewSessionStore((s) => s.startSession)
  const resetSession = useInterviewSessionStore((s) => s.resetSession)

  const sessionIdRef = useRef<string | null>(null)
  const creatingRef = useRef(false)
  const savedCountRef = useRef(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const save = useCallback(
    async (id: string, transcript: TranscriptEntry[], final: boolean) => {
      await updateInterviewSession({
        id,
        transcript,
        ...(final
          ? { status: "completed", endedAt: new Date().toISOString() }
          : {}),
      })
      savedCountRef.current = transcript.length
    },
    []
  )

  /** Saves the session as completed and clears local state. */
  const finish = useCallback(async () => {
    const id = sessionIdRef.current
    const transcript = snapshotTranscript()
    sessionIdRef.current = null
    savedCountRef.current = 0
    setStartedAt(null)
    resetSession()

    if (!id) return false
    try {
      await save(id, transcript, true)
    } catch (error) {
      console.error("Failed to save session:", error)
    }
    return true
  }, [resetSession, save])

  // Fresh state per interview; finish the session when leaving the page
  useEffect(() => {
    resetSession(interviewId)
    return () => {
      void finish()
    }
  }, [interviewId, resetSession, finish])

  // Create the DB session only once something is actually being captured
  useEffect(() => {
    if (sessionIdRef.current || creatingRef.current) return
    if (microphoneStatus !== "connected" && messageCount === 0) return

    creatingRef.current = true
    createSession({ interviewId })
      .then((session) => {
        sessionIdRef.current = session.id
        startSession(session.id)
        setStartedAt(Date.now())
      })
      .catch((error) => console.error("Failed to start session:", error))
      .finally(() => {
        creatingRef.current = false
      })
  }, [microphoneStatus, messageCount, interviewId, createSession, startSession])

  // Periodic autosave while the transcript grows
  useEffect(() => {
    const timer = setInterval(() => {
      const id = sessionIdRef.current
      if (!id) return
      const transcript = snapshotTranscript()
      if (transcript.length === savedCountRef.current) return
      save(id, transcript, false).catch((error) =>
        console.error("Autosave failed:", error)
      )
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [save])

  // Tab closed / reloaded: fetch may be cancelled, sendBeacon is not
  useEffect(() => {
    const onPageHide = () => {
      const id = sessionIdRef.current
      if (!id) return
      const body = JSON.stringify({
        transcript: snapshotTranscript(),
        status: "completed",
        endedAt: new Date().toISOString(),
      })
      navigator.sendBeacon(
        `/api/interview-sessions/${id}`,
        new Blob([body], { type: "application/json" })
      )
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [])

  return { startedAt, finish }
}
