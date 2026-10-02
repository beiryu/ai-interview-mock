"use client"

import { useMemo } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"
import { RotateCcw, X } from "lucide-react"

import type { AnswerMetrics, QuestionAnalysis } from "@/types/interview-message"
import { isAssumedStory, splitAnswer } from "@/lib/answer/format"
import { useInterviewPrep, useProfilePrep } from "@/hooks/api/prep/usePrep"
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

/** "deepseek/deepseek-v4.1-flash" → "deepseek-v4.1-flash" */
function shortModel(model: string) {
  return model.slice(model.indexOf("/") + 1)
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
    metrics.model && shortModel(metrics.model),
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

/** Prep ids → what they refer to, for the evidence chips' tooltips. */
function useEvidenceLabels() {
  const interviewId = useInterviewSessionStore((s) => s.interviewId)
  const profile = useProfilePrep()
  const interview = useInterviewPrep(interviewId ?? "")
  return useMemo(() => {
    const labels = new Map<string, string>()
    for (const f of profile.data?.content?.facts ?? [])
      labels.set(f.id, f.title)
    for (const s of profile.data?.content?.stories ?? [])
      labels.set(s.id, s.title)
    for (const r of interview.data?.content?.requirements ?? [])
      labels.set(r.id, r.text)
    return labels
  }, [profile.data, interview.data])
}

function EvidenceChip({ id, label }: { id: string; label?: string }) {
  return (
    <span
      title={label ?? "Not in your prep — check this"}
      className={
        label
          ? "ml-1 rounded bg-primary/10 px-1 font-mono text-[10px] font-normal text-primary"
          : "ml-1 rounded bg-amber-500/15 px-1 font-mono text-[10px] font-normal text-amber-700 dark:text-amber-300"
      }
    >
      {id}
    </span>
  )
}

function AnswerCard({
  response,
  evidence,
}: {
  response: QuestionAnalysis
  evidence: Map<string, string>
}) {
  const regenerate = useInterviewSessionStore((s) => s.regenerate)
  const parsed = splitAnswer(response.suggestedAnswer)
  const { headline, points, script } = parsed
  const assumed = isAssumedStory(parsed, response.kind)
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
              {headline && (
                <p className="mb-1 text-base font-bold leading-snug">
                  {headline}
                </p>
              )}
              {assumed && (
                <p className="mb-1 text-xs text-violet-700 dark:text-violet-300">
                  ✎ Ví dụ giả định — không có trong prep, chỉnh nếu chưa đúng
                </p>
              )}
              {points.length > 0 && (
                <ul className="mb-2 space-y-0.5">
                  {points.map((point, i) => (
                    <li key={i} className="text-sm font-semibold leading-snug">
                      • {point.text}
                      {point.tags.map((tag) => (
                        <EvidenceChip
                          key={tag}
                          id={tag}
                          label={evidence.get(tag)}
                        />
                      ))}
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

          {response.issues && response.issues.length > 0 && (
            <ul className="mt-2 space-y-0.5 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
              {response.issues.map((issue, i) => (
                <li key={i}>⚠ Check: {issue.detail}</li>
              ))}
            </ul>
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
  const evidence = useEvidenceLabels()

  const analyzedResponses = messages
    .map((m) => m.questionAnalysis)
    .filter((analysis) => analysis !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {analyzedResponses.map((response) => (
          <AnswerCard
            key={response.id}
            response={response}
            evidence={evidence}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

/** The newest answer card alone (desktop compact overlay). */
export function LatestAnswer() {
  const messages = useInterviewSessionStore((s) => s.messages)
  const evidence = useEvidenceLabels()
  const latest = messages
    .map((m) => m.questionAnalysis)
    .filter((analysis) => analysis !== null)
    .at(-1)
  if (!latest) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Waiting for the interviewer&apos;s first question…
      </p>
    )
  }
  return <AnswerCard response={latest} evidence={evidence} />
}
