"use client"

import { useInterviewSessionStore } from "@/stores/interview-session.store"
import { Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const LABEL = {
  idle: "Listening",
  listening: "Listening",
  waiting: "Waiting for the rest…",
  answering: "Answering",
  skipped: "Skipped",
} as const

const DOT = {
  idle: "bg-muted-foreground/40",
  listening: "bg-green-500 animate-pulse",
  waiting: "bg-yellow-500 animate-pulse",
  answering: "bg-primary",
  skipped: "bg-muted-foreground/40",
} as const

/** What the copilot is doing right now: a dot and a label. */
export function CopilotStatusLabel({ className }: { className?: string }) {
  const status = useInterviewSessionStore((s) => s.status)
  const skipReason = useInterviewSessionStore((s) => s.skipReason)

  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", DOT[status])} />
      <span className="truncate text-sm text-muted-foreground">
        {LABEL[status]}
        {status === "skipped" && skipReason && ` · ${skipReason}`}
      </span>
    </span>
  )
}

/** What the copilot is doing right now + the "Answer now" override. */
export function CopilotStatus() {
  const answerNow = useInterviewSessionStore((s) => s.answerNow)

  return (
    <div className="flex items-center gap-2">
      <CopilotStatusLabel />
      <Button
        variant="outline"
        size="sm"
        className="h-6 gap-1 px-2 text-xs"
        onClick={answerNow}
        title="Answer what was said so far, or redo the last answer (Alt+Enter)"
      >
        <Zap className="size-3" />
        Answer now
      </Button>
      <AutoAnswerToggle className="ml-1" />
    </div>
  )
}

/**
 * Auto answer on/off. Off: the copilot only listens and transcribes;
 * Answer now (⌘⇧Enter) answers what the interviewer said.
 */
export function AutoAnswerToggle({ className }: { className?: string }) {
  const on = useInterviewSessionStore((s) => s.autoAnswer)
  const setAutoAnswer = useInterviewSessionStore((s) => s.setAutoAnswer)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={
        on
          ? "Auto answer is on: every question gets an answer"
          : "Auto answer is off: press Answer to get one"
      }
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
      onClick={() => setAutoAnswer(!on)}
    >
      Auto Answer
      <span
        className={cn(
          "flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
          on ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "size-3 rounded-full bg-background shadow-sm transition-transform",
            on && "translate-x-3"
          )}
        />
      </span>
    </button>
  )
}
