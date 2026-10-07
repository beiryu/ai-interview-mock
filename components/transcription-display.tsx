import { useEffect, useRef } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"

import { TranscriptionMessage } from "./transcription-message"

const timeLabel = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export function TranscriptionDisplay() {
  const messages = useInterviewSessionStore((s) => s.messages)
  const live = useInterviewSessionStore((s) => s.live)
  const sttError = useInterviewSessionStore((s) => s.sttError)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Newest entries render at the top; keep them in view
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [messages.length, live.interviewer.text, live.candidate.text])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {sttError && (
        <p className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
          Transcription: {sttError}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex flex-col gap-2 p-4">
          {live.interviewer.text && (
            <TranscriptionMessage
              type="speaking"
              role="interviewer"
              text={live.interviewer.text}
              language={live.interviewer.language}
            />
          )}

          {live.candidate.text && (
            <TranscriptionMessage
              type="speaking"
              role="candidate"
              text={live.candidate.text}
              language={live.candidate.language}
            />
          )}

          {[...messages].reverse().map((message) => (
            <TranscriptionMessage
              key={message.id}
              timestamp={timeLabel(new Date(message.createdAt))}
              text={message.content}
              type="final"
              role={message.role as "interviewer" | "candidate"}
              language={message.questionAnalysis?.language ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
