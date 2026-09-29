import { useCallback, useEffect, useRef, useState } from "react"
import {
  registerFinalizer,
  turnEngine,
  useInterviewSessionStore,
} from "@/stores/interview-session.store"

import { STT_DEFAULTS } from "@/config/defaults/stt"
import { SonioxStream, type SttStatus } from "@/lib/stt/soniox-stream"
import { SPEECH_RMS, type Role } from "@/lib/turn/turn-engine"
import { useAudioCapture, type AudioFrame } from "@/hooks/use-audio-capture"

const TICK_MS = 100

async function fetchTemporaryKey() {
  const response = await fetch("/api/stt/token", { method: "POST" })
  const body = (await response.json().catch(() => ({}))) as {
    key?: string
    error?: string
  }
  if (!response.ok || !body.key) {
    const error = new Error(
      body.error ?? `Token request failed (${response.status})`
    )
    // 503 = server not configured; retrying won't fix it
    Object.assign(error, { retryable: response.status !== 503 })
    throw error
  }
  return body.key
}

/**
 * One live stream: capture (meeting tab or mic) → Soniox → turn engine.
 * The Soniox socket only exists while capturing, so idle time isn't billed.
 */
export function useLiveTranscriber(
  role: Role,
  options: { contextTerms?: string[] } = {}
) {
  const setSttError = useInterviewSessionStore((s) => s.setSttError)
  const setMicrophoneStatus = useInterviewSessionStore(
    (s) => s.setMicrophoneStatus
  )
  const [status, setStatus] = useState<SttStatus>("idle")

  const streamRef = useRef<SonioxStream | null>(null)
  const source = role === "interviewer" ? "tab" : "mic"

  const onFrame = useCallback(
    ({ pcm, rms }: AudioFrame) => {
      streamRef.current?.send(pcm, rms >= SPEECH_RMS)
      turnEngine.onAudioLevel(role, rms, performance.now())
    },
    [role]
  )

  const closeStream = useCallback(() => {
    streamRef.current?.stop()
    streamRef.current = null
    registerFinalizer(role, null)
    if (role === "interviewer") setMicrophoneStatus("disconnected")
  }, [role, setMicrophoneStatus])

  const capture = useAudioCapture(source, { onFrame, onEnded: closeStream })

  const start = useCallback(async () => {
    setSttError(null)
    if (role === "interviewer") setMicrophoneStatus("connecting")

    const stream = new SonioxStream(
      fetchTemporaryKey,
      { ...STT_DEFAULTS, contextTerms: options.contextTerms },
      {
        onUpdate: (update) =>
          turnEngine.onTranscript(role, update, performance.now()),
        onEndpoint: ({ lagMs }) => turnEngine.onEndpoint(role, lagMs),
        onStatus: (next) => {
          setStatus(next)
          if (role === "interviewer" && next === "open") {
            setMicrophoneStatus("connected")
          }
        },
        onError: (error) => setSttError(error.message),
      }
    )
    streamRef.current = stream
    registerFinalizer(role, () => stream.finalize())

    const started = await capture.start()
    if (!started) {
      closeStream()
      return
    }
    await stream.start()
  }, [
    capture,
    closeStream,
    options.contextTerms,
    role,
    setMicrophoneStatus,
    setSttError,
  ])

  const stop = useCallback(() => {
    capture.stop()
    closeStream()
  }, [capture, closeStream])

  // The turn engine's timing rules run on a shared clock
  useEffect(() => {
    if (role !== "interviewer" || !capture.active) return
    const timer = setInterval(() => turnEngine.tick(performance.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [role, capture.active])

  // Stop the socket if the component unmounts mid-capture
  useEffect(() => () => closeStream(), [closeStream])

  return {
    active: capture.active,
    stream: capture.stream,
    captureError: capture.error,
    status,
    start,
    stop,
  }
}
