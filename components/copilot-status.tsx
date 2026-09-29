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

/** What the copilot is doing right now + the "Answer now" override. */
export function CopilotStatus() {
  const status = useInterviewSessionStore((s) => s.status)
  const skipReason = useInterviewSessionStore((s) => s.skipReason)
  const answerNow = useInterviewSessionStore((s) => s.answerNow)

  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", DOT[status])} />
      <span className="text-xs text-muted-foreground">
        {LABEL[status]}
        {status === "skipped" && skipReason && ` · ${skipReason}`}
      </span>
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
    </div>
  )
}
