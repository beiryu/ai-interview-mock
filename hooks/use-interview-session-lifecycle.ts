import { useCallback, useEffect, useRef, useState } from "react"
import {
  useInterviewSessionStore,
  type ResumePayload,
} from "@/stores/interview-session.store"

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
 * - on open, RESUMES the job's recent in-progress session (transcript +
 *   answers + screenshots) if there is one; otherwise waits for an explicit
 *   `start()` (a DB session is created and the timer runs from that press —
 *   not implicitly on audio/transcript)
 * - autosaves the transcript every 30s; answers and screenshots are saved
 *   incrementally by the store as they happen
 * - leaving the page / reloading only SAVES (keeps "in_progress"); only
 *   "End session" marks it "completed", so the next visit can resume
 */
export function useInterviewSessionLifecycle(
  jobId: string,
  preferredSessionId?: string
) {
  const { mutateAsync: createSession } = useCreateInterviewSession()
  const startStore = useInterviewSessionStore((s) => s.startSession)
  const hydrateSession = useInterviewSessionStore((s) => s.hydrateSession)
  const resetSession = useInterviewSessionStore((s) => s.resetSession)

  const sessionIdRef = useRef<string | null>(null)
  const savedCountRef = useRef(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  // While we check for a resumable session (so the UI doesn't flash "Start")
  const [checking, setChecking] = useState(true)
  const [starting, setStarting] = useState(false)

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

  // Save the transcript and clear local state. `final` marks the session
  // completed (End); without it the session stays in_progress (leaving the
  // page) so it can be resumed next time.
  const persist = useCallback(
    async (final: boolean) => {
      const id = sessionIdRef.current
      const transcript = snapshotTranscript()
      sessionIdRef.current = null
      savedCountRef.current = 0
      setStartedAt(null)
      resetSession()

      if (!id) return false
      try {
        await save(id, transcript, final)
      } catch (error) {
        console.error("Failed to save session:", error)
      }
      return true
    },
    [resetSession, save]
  )

  // Explicit "Start": create the DB session and run the timer from now.
  const start = useCallback(async () => {
    if (sessionIdRef.current || starting) return
    setStarting(true)
    try {
      const session = await createSession({ jobId })
      sessionIdRef.current = session.id
      startStore(session.id)
      setStartedAt(Date.now())
    } catch (error) {
      console.error("Failed to start session:", error)
    } finally {
      setStarting(false)
    }
  }, [createSession, jobId, startStore, starting])

  // "End session": finalize + clear
  const finish = useCallback(() => persist(true), [persist])

  // On open: reset, then resume the job's recent in-progress session if any.
  // Leaving the page just saves (keeps in_progress) so it can be resumed.
  useEffect(() => {
    let cancelled = false
    resetSession(jobId)
    void (async () => {
      try {
        const sessionParam = preferredSessionId
          ? `&session=${encodeURIComponent(preferredSessionId)}`
          : ""
        const res = await fetch(
          `/api/interview-sessions/resume?jobId=${encodeURIComponent(
            jobId
          )}${sessionParam}`
        )
        const session = (res.ok ? await res.json() : null) as
          | (ResumePayload & { startedAt?: string })
          | null
        if (cancelled || !session) return
        hydrateSession(session)
        sessionIdRef.current = session.id
        savedCountRef.current = session.transcript?.length ?? 0
        setStartedAt(
          session.startedAt ? new Date(session.startedAt).getTime() : Date.now()
        )
      } catch (error) {
        console.error("Failed to resume session:", error)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()

    return () => {
      cancelled = true
      void persist(false)
    }
  }, [jobId, preferredSessionId, resetSession, hydrateSession, persist])

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

  // Tab closed / reloaded: fetch may be cancelled, sendBeacon is not. Save
  // the transcript but keep in_progress so the session resumes next time.
  useEffect(() => {
    const onPageHide = () => {
      const id = sessionIdRef.current
      if (!id) return
      const body = JSON.stringify({ transcript: snapshotTranscript() })
      navigator.sendBeacon(
        `/api/interview-sessions/${id}`,
        new Blob([body], { type: "application/json" })
      )
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [])

  return { startedAt, checking, starting, start, finish }
}
