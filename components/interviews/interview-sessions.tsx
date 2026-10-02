"use client"

import * as React from "react"
import Link from "next/link"
import { Play } from "lucide-react"

import { cn } from "@/lib/utils"
import type { InterviewSessionSummary } from "@/lib/validations/interview-session"
import { useGetInterview } from "@/hooks/api/interview/useGetInterview"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardHeader } from "@/components/header"
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

export function InterviewSessions({ interviewId }: { interviewId: string }) {
  const { data: interview, isLoading } = useGetInterview(interviewId)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const sessions = interview?.sessions ?? []
  const selected =
    sessions.find((s) => s.id === selectedId) ?? sessions[0] ?? null

  const subtitle = [interview?.companyName, interview?.jobTitle]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="grid gap-6">
      <DashboardHeader
        heading={interview?.name ?? "Past sessions"}
        text={subtitle || "Transcripts saved from your live sessions."}
      >
        <Link
          href={`/dashboard/interviews/${interviewId}`}
          className={cn(buttonVariants(), "gap-2")}
        >
          <Play className="size-4" />
          New session
        </Link>
      </DashboardHeader>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : sessions.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No saved sessions yet. A session is recorded once you share the
          meeting tab or turn on your microphone.
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
