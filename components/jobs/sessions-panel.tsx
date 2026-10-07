"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Camera, Clock, MessageSquare, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import type {
  InterviewSessionSummary,
  SavedAnswer,
  SavedCodeQa,
  TranscriptEntry,
} from "@/lib/validations/interview-session"
import type { JobWithSessions } from "@/hooks/api/job/useJobs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MarkdownMessage } from "@/components/ui/markdown-message"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyPlaceholder } from "@/components/empty-placeholder"
import { Icons } from "@/components/icons"
import { TranscriptionMessage } from "@/components/transcription-message"

type Chat = { id: string; role: string; content: string }
type Screenshot = {
  id: string
  image: string
  text: string
  model: string | null
  thread: SavedCodeQa[] | null
  createdAt: string
}
type SessionDetail = {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  transcript: TranscriptEntry[] | null
  answers: SavedAnswer[] | null
  screenshots: Screenshot[]
  chat: Chat[]
}

const LIVE_TONE = "bg-green-500/15 text-green-700 dark:text-green-300"

export function formatDuration(session: InterviewSessionSummary) {
  if (!session.endedAt) return "—"
  const ms =
    new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return `${minutes} min`
}

function questionCount(session: InterviewSessionSummary) {
  return (session.transcript ?? []).filter((e) => e.role === "interviewer")
    .length
}

function StatusBadge({ live }: { live: boolean }) {
  return live ? (
    <Badge
      variant="outline"
      className={cn("shrink-0 gap-1.5 border-0", LIVE_TONE)}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
      Live
    </Badge>
  ) : (
    <Badge variant="secondary" className="shrink-0">
      Ended
    </Badge>
  )
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })

/** Saved live sessions for this job: pick one to review, resume a Live one. */
export function SessionsPanel({ job }: { job: JobWithSessions }) {
  const router = useRouter()
  const sessions = job.sessions
  const [selectedId, setSelectedId] = React.useState<string | null>(
    sessions[0]?.id ?? null
  )
  const selectedSummary =
    sessions.find((s) => s.id === selectedId) ?? sessions[0] ?? null

  const detail = useQuery({
    queryKey: ["session-detail", selectedSummary?.id],
    enabled: !!selectedSummary,
    queryFn: async () => {
      const res = await fetch(`/api/interview-sessions/${selectedSummary!.id}`)
      if (!res.ok) throw new Error("Failed to load session")
      return (await res.json()) as SessionDetail
    },
    staleTime: 60_000,
  })

  const resume = (id: string) =>
    router.push(`/dashboard/jobs/${job.id}/live?session=${id}`)

  if (sessions.length === 0) {
    return (
      <EmptyPlaceholder>
        <EmptyPlaceholder.Icon name="post" />
        <EmptyPlaceholder.Title>No sessions yet</EmptyPlaceholder.Title>
        <EmptyPlaceholder.Description>
          Open the live page and press “Start session” to record your first
          interview run. It shows up here with its transcript, answers and
          screenshots.
        </EmptyPlaceholder.Description>
      </EmptyPlaceholder>
    )
  }

  const d = detail.data
  const live = (selectedSummary?.status ?? "") === "in_progress"

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      {/* List */}
      <div className="space-y-2">
        {sessions.map((session) => {
          const isLive = session.status === "in_progress"
          const isSelected = selectedSummary?.id === session.id
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelectedId(session.id)}
              className={cn(
                "w-full rounded-md border p-3 text-left transition-colors",
                isSelected
                  ? "bg-muted ring-1 ring-primary/40"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {dateLabel(session.startedAt)}
                </span>
                <StatusBadge live={isLive} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {formatDuration(session)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3.5" />
                  {questionCount(session)} questions
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail */}
      <Card className="flex min-h-0 flex-col overflow-hidden">
        {selectedSummary && (
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">
                  {dateLabel(selectedSummary.startedAt)}
                </span>
                <StatusBadge live={live} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {formatDuration(selectedSummary)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3.5" />
                  {questionCount(selectedSummary)} questions
                </span>
                {d && d.screenshots.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Camera className="size-3.5" />
                    {d.screenshots.length} screenshots
                  </span>
                )}
              </div>
            </div>
            {live && (
              <Button
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => resume(selectedSummary.id)}
              >
                <Play className="size-3.5" />
                Resume
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="h-[calc(100vh-19rem)] px-4 py-3">
          {detail.isLoading || !d ? (
            <div className="flex h-40 items-center justify-center">
              <Icons.spinner className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {d.answers && d.answers.length > 0 && (
                <Section title="Suggested answers">
                  {d.answers.map((a) => (
                    <div
                      key={a.messageId}
                      className="rounded-md border p-2.5 text-sm"
                    >
                      <p className="mb-1 flex items-center gap-2 font-medium">
                        {a.question}
                        {a.kind && (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px]"
                          >
                            {a.kind}
                          </Badge>
                        )}
                      </p>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {a.answer}
                      </p>
                    </div>
                  ))}
                </Section>
              )}

              {d.screenshots.length > 0 && (
                <Section title={`Screenshots (${d.screenshots.length})`}>
                  {d.screenshots.map((s) => (
                    <div
                      key={s.id}
                      className="space-y-2 rounded-md border p-2.5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.image}
                        alt="Captured screen"
                        className="max-h-56 w-full rounded border object-contain"
                      />
                      <MarkdownMessage
                        content={s.text}
                        className="border-0 bg-transparent p-0 shadow-none"
                      />
                      {(s.thread ?? []).map((t) => (
                        <div key={t.id} className="border-t pt-2 text-sm">
                          <p className="font-medium">› {t.question}</p>
                          <MarkdownMessage
                            content={t.answer}
                            className="border-0 bg-transparent p-0 shadow-none"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </Section>
              )}

              {d.chat.length > 0 && (
                <Section title="Chat">
                  {d.chat.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "text-sm",
                        m.role === "user"
                          ? "ml-8 rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                          : "mr-4"
                      )}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <MarkdownMessage content={m.content} />
                      )}
                    </div>
                  ))}
                </Section>
              )}

              <Section title="Transcript">
                {d.transcript && d.transcript.length > 0 ? (
                  d.transcript.map((entry, i) => (
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
                  <p className="text-sm text-muted-foreground">No transcript.</p>
                )}
              </Section>
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}
