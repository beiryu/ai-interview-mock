"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { InterviewSessionSummary } from "@/lib/validations/interview-session"
import type { JobWithSessions } from "@/hooks/api/job/useJobs"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TranscriptionMessage } from "@/components/transcription-message"

export function formatDuration(session: InterviewSessionSummary) {
  if (!session.endedAt) return "In progress"
  const ms =
    new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return `${minutes} min`
}

function questionCount(session: InterviewSessionSummary) {
  return (session.transcript ?? []).filter((e) => e.role === "interviewer")
    .length
}

/** Transcripts saved from this job's live sessions. */
export function SessionsPanel({ job }: { job: JobWithSessions }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const sessions = job.sessions
  const selected =
    sessions.find((s) => s.id === selectedId) ?? sessions[0] ?? null

  return (
    <div className="grid gap-6">
      {sessions.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No saved sessions yet. Launch the interview: a session is recorded
          once you share the meeting tab or turn on your microphone.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Card className="h-fit p-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedId(session.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  selected?.id === session.id && "bg-muted"
                )}
              >
                <div className="font-medium">
                  {new Date(session.startedAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDuration(session)} · {questionCount(session)} questions
                </div>
              </button>
            ))}
          </Card>

          <Card className="overflow-hidden">
            <ScrollArea className="h-[calc(100vh-16rem)] px-4 py-3">
              {selected?.transcript?.length ? (
                selected.transcript.map((entry, i) => (
                  <TranscriptionMessage
                    key={i}
                    type="final"
                    role={entry.role}
                    text={entry.text}
                    timestamp={new Date(entry.at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  />
                ))
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  This session has no transcript.
                </p>
              )}
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  )
}
