import { useCallback, useEffect, useRef, useState } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"
import {
  LiveClient,
  LiveTranscriptionEvents,
  createClient,
} from "@deepgram/sdk"

import { useConfig } from "@/lib/config/config.hooks"

type DeepgramConnectionStatus = "loading" | "ready" | "error"

interface UseDeepgramConnectionReturn {
  connection: LiveClient | null
  status: DeepgramConnectionStatus
  error: Error | null
}

export function useDeepgramConnection(
  role: "interviewer" | "candidate" = "interviewer"
): UseDeepgramConnectionReturn {
  const { config } = useConfig()
  // Latest config for values that don't warrant a reconnect
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const [status, setStatus] = useState<DeepgramConnectionStatus>("loading")
  const [error, setError] = useState<Error | null>(null)
  const [connection, setConnection] = useState<LiveClient | null>(null)

  const { language, utteranceEndMs, endpointing } = config.deepgram

  // (Re)connect whenever the role or a transcription-relevant setting changes
  useEffect(() => {
    let cancelled = false
    let conn: LiveClient | null = null
    let keepAlive: ReturnType<typeof setInterval> | undefined
    let silenceCheck: ReturnType<typeof setInterval> | undefined

    const connect = async () => {
      const cfg = configRef.current
      try {
        const response = await fetch("/api/deepgram", { cache: "no-store" })
        const data = await response.json()
        if (cancelled) return
        if (!("key" in data)) {
          throw new Error("No API key returned")
        }

        conn = createClient(data.key).listen.live({
          model: cfg.deepgram.model,
          language,
          interim_results: cfg.deepgram.interimResults,
          smart_format: cfg.deepgram.smartFormat,
          utterance_end_ms: utteranceEndMs,
          endpointing,
        })
        const live = conn

        keepAlive = setInterval(() => {
          if (live.getReadyState() === 1) live.keepAlive() // 1 = OPEN
        }, cfg.deepgram.keepAliveIntervalMs)

        silenceCheck = setInterval(() => {
          const state = useInterviewSessionStore.getState()
          const silentFor = Date.now() - state.lastSpeakTime
          if (silentFor <= cfg.interview.silenceThresholdMs) return
          const bufferKey =
            role === "interviewer" ? "interviewerBuffer" : "candidateBuffer"
          if (state[bufferKey].trim()) state.flushTranscript(role)
        }, cfg.interview.silenceCheckIntervalMs)

        live.on(LiveTranscriptionEvents.Open, () => {
          if (!cancelled) setStatus("ready")
        })

        live.on(LiveTranscriptionEvents.Close, () => {
          if (!cancelled) setConnection(null)
        })

        live.on(LiveTranscriptionEvents.UtteranceEnd, () => {
          void useInterviewSessionStore.getState().flushTranscript(role)
        })

        live.on(LiveTranscriptionEvents.Transcript, (event) => {
          const alt = event.channel.alternatives[0]
          const words = alt.words ?? []
          const fromWords =
            words.length > 0
              ? words
                  .map(
                    (w: { punctuated_word?: string; word?: string }) =>
                      w.punctuated_word ?? w.word
                  )
                  .join(" ")
              : ""
          const transcript = (fromWords || alt.transcript || "").trim()
          if (!transcript) return

          useInterviewSessionStore
            .getState()
            .processTranscript(transcript, event.is_final, role)
        })

        setConnection(live)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setStatus("error")
      }
    }

    void connect()

    return () => {
      cancelled = true
      clearInterval(keepAlive)
      clearInterval(silenceCheck)
      try {
        conn?.requestClose()
      } catch {
        /* ignore close errors */
      }
      setConnection(null)
      setStatus("loading")
    }
  }, [role, language, utteranceEndMs, endpointing])

  return { connection, status, error }
}

/**
 * Returns a MediaRecorder `ondataavailable` handler that streams chunks to the
 * Deepgram connection. Chunks produced before the connection exists are held
 * back and flushed once it does — the first chunk carries the container
 * header, so it must not be dropped.
 */
export function useDeepgramAudioSender(connection: LiveClient | null) {
  const connectionRef = useRef(connection)
  const pendingRef = useRef<Blob[]>([])

  useEffect(() => {
    connectionRef.current = connection
    if (!connection) return
    for (const chunk of pendingRef.current) connection.send(chunk)
    pendingRef.current = []
  }, [connection])

  return useCallback((event: BlobEvent) => {
    if (event.data.size === 0) return
    const current = connectionRef.current
    if (current) current.send(event.data)
    else pendingRef.current.push(event.data)
  }, [])
}
