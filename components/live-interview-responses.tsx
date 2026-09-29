import { useInterviewSessionStore } from "@/stores/interview-session.store"
import { RotateCcw, X } from "lucide-react"

import type { AnswerMetrics, QuestionAnalysis } from "@/types/interview-message"
import { splitAnswer } from "@/lib/answer/format"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const REASON_LABEL: Record<string, string> = {
  endpoint: "end of turn",
  stable: "complete question",
  "candidate-started": "you started",
  "max-silence": "silence",
  manual: "answer now",
}

function ms(value: number | null) {
  return value === null ? "…" : `${value}ms`
}

function LatencyBadge({ metrics }: { metrics: AnswerMetrics }) {
  const first =
    metrics.firstTokenMs === null
      ? "…"
      : metrics.firstTokenMs === 0
      ? "ready"
      : `${metrics.firstTokenMs}ms`
  const parts = [
    REASON_LABEL[metrics.commitReason] ?? metrics.commitReason,
    `silence ${metrics.silenceMs}ms`,
    metrics.endpointLagMs !== null && `<end> lag ${metrics.endpointLagMs}ms`,
    `judge ${ms(metrics.judgeMs)}`,
    `first token ${first}${metrics.speculated ? " ⚡" : ""}`,
    metrics.discardedSpeculations > 0 &&
      `${metrics.discardedSpeculations} draft${
        metrics.discardedSpeculations > 1 ? "s" : ""
      } discarded`,
  ].filter(Boolean)

  return (
    <span className="text-[10px] tabular-nums text-muted-foreground/70">
      {parts.join(" · ")}
    </span>
  )
}

function AnswerCard({ response }: { response: QuestionAnalysis }) {
  const regenerate = useInterviewSessionStore((s) => s.regenerate)
  const { points, script } = splitAnswer(response.suggestedAnswer)
  const empty = response.suggestedAnswer.length === 0

  return (
    <div className="group flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-all hover:bg-accent">
      <div className="flex items-start gap-2">
        <div className="min-w-14 shrink-0 text-xs text-muted-foreground">
          {response.createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {response.language && (
            <div className="mt-1 text-[10px] font-medium uppercase">
              {response.language}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="text-sm font-medium">{response.question}</div>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                title="Regenerate (Alt+R)"
                onClick={() => regenerate(response.messageId)}
              >
                <RotateCcw className="size-3" />
              </Button>
              <SkipButton messageId={response.messageId} />
            </div>
          </div>

          {response.error ? (
            <p className="text-sm text-destructive">{response.error}</p>
          ) : (
            <>
              {points.length > 0 && (
                <ul className="mb-2 space-y-0.5">
                  {points.map((point, i) => (
                    <li key={i} className="text-sm font-semibold leading-snug">
                      • {point}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                {script}
                {empty && (
                  <span className="inline-block h-3 w-2 animate-pulse rounded-sm bg-muted-foreground/50" />
                )}
              </p>
            </>
          )}

          {response.metrics && (
            <div className="mt-2">
              <LatencyBadge metrics={response.metrics} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SkipButton({ messageId }: { messageId: string }) {
  const messages = useInterviewSessionStore((s) => s.messages)
  const skipCurrent = useInterviewSessionStore((s) => s.skipCurrent)
  // Skip only applies to the newest card (the one being answered)
  const latest = [...messages].reverse().find((m) => m.questionAnalysis)
  if (latest?.id !== messageId) return null
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      title="Skip (Alt+S)"
      onClick={skipCurrent}
    >
      <X className="size-3" />
    </Button>
  )
}

export function LiveInterviewResponses() {
  const messages = useInterviewSessionStore((s) => s.messages)

  const analyzedResponses = messages
    .map((m) => m.questionAnalysis)
    .filter((analysis) => analysis !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {analyzedResponses.map((response) => (
          <AnswerCard key={response.id} response={response} />
        ))}
      </div>
    </ScrollArea>
  )
}
