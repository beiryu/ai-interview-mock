import { useInterviewSessionStore } from "@/stores/interview-session.store"

import type { AnswerMetrics } from "@/types/interview-message"
import { ScrollArea } from "@/components/ui/scroll-area"

const REASON_LABEL: Record<string, string> = {
  endpoint: "end of turn",
  "complete-pause": "complete question",
  "candidate-started": "you started",
  "max-silence": "silence",
}

function LatencyBadge({ metrics }: { metrics: AnswerMetrics }) {
  const first =
    metrics.firstTokenMs === null
      ? "…"
      : metrics.firstTokenMs === 0
      ? "ready"
      : `${metrics.firstTokenMs}ms`
  return (
    <span
      className="text-[10px] tabular-nums text-muted-foreground/70"
      title="Silence before commit · commit to first answer token"
    >
      {REASON_LABEL[metrics.commitReason] ?? metrics.commitReason} ·{" "}
      {metrics.silenceMs}ms → {first}
      {metrics.speculated && " ⚡"}
    </span>
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
          <div
            key={response.id}
            className="flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-all hover:bg-accent"
          >
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
                <div className="mb-2 text-sm font-medium">
                  {response.question}
                </div>
                {response.error ? (
                  <p className="text-sm text-destructive">{response.error}</p>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {response.suggestedAnswer}
                    {response.suggestedAnswer.length === 0 && (
                      <span className="inline-block h-3 w-2 animate-pulse rounded-sm bg-muted-foreground/50" />
                    )}
                  </p>
                )}
                {response.metrics && (
                  <div className="mt-2">
                    <LatencyBadge metrics={response.metrics} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
