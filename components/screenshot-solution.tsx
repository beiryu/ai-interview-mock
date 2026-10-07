"use client"

import { useState } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"
import {
  ArrowUp,
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react"

import type {
  CodeQaEntry,
  ScreenshotSolution,
} from "@/stores/interview-session.store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MarkdownMessage } from "@/components/ui/markdown-message"

/**
 * One coding-question screenshot solution: the screen was captured, the
 * problem read, and an approach + full code streamed in. The caller passes
 * which solution to show (the store keeps a history for the overlay's pager)
 * and an `onCapture` to take a fresh one.
 */
export function SolutionBody({
  solution,
  className,
}: {
  solution: ScreenshotSolution | undefined
  className?: string
}) {
  const onCapture = useInterviewSessionStore((s) => s.captureSolution)

  if (!solution) {
    return <Empty>Press Capture to read what’s on your screen.</Empty>
  }
  if (solution.capturing) {
    return (
      <Empty>
        <Loader2 className="mb-2 size-5 animate-spin" />
        Capturing the screen…
      </Empty>
    )
  }
  if (solution.error) {
    return (
      <Empty>
        <p className="mb-3 text-destructive">{solution.error}</p>
        <Button size="sm" variant="outline" onClick={onCapture}>
          <RotateCcw className="size-3.5" /> Try again
        </Button>
      </Empty>
    )
  }
  // One loading state: reading the problem, before any text streams in
  if (solution.streaming && !solution.text) {
    return (
      <Empty>
        <Loader2 className="mb-2 size-5 animate-spin" />
        Reading the screen…
      </Empty>
    )
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MarkdownMessage
          content={solution.text}
          className={cn("border-0 bg-transparent shadow-none")}
        />
        {solution.thread.length > 0 && (
          <div className="space-y-3 px-3 pb-2">
            {solution.thread.map((entry) => (
              <CodeQaItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
      {solution.streaming && (
        <div className="flex shrink-0 items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> writing…
        </div>
      )}
      <CodeAskInput solutionId={solution.id} />
    </div>
  )
}

/** One question about the code and its streamed answer. */
function CodeQaItem({ entry }: { entry: CodeQaEntry }) {
  return (
    <div className="border-t pt-2">
      <p className="mb-1 text-sm font-medium">
        <span className="text-muted-foreground">
          {entry.source === "voice" ? "🎤 " : "› "}
        </span>
        {entry.question}
      </p>
      {entry.error ? (
        <p className="text-sm text-destructive">{entry.error}</p>
      ) : entry.streaming && !entry.answer ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <MarkdownMessage
          content={entry.answer}
          className="border-0 bg-transparent p-0 shadow-none"
        />
      )}
    </div>
  )
}

/** One-line box to ask about the captured code (mirrors the chat input). */
function CodeAskInput({ solutionId }: { solutionId: string }) {
  const askAboutCode = useInterviewSessionStore((s) => s.askAboutCode)
  const [input, setInput] = useState("")

  const send = () => {
    const question = input.trim()
    if (!question) return
    askAboutCode({ solutionId, question, source: "typed" })
    setInput("")
  }

  return (
    <form
      className="shrink-0 p-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      <div className="flex h-9 items-center gap-1 rounded-md border bg-background/50 pl-3 pr-1 focus-within:ring-1 focus-within:ring-ring">
        <input
          value={input}
          placeholder="Ask about this screen…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          title="Ask (Enter)"
          className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40"
          disabled={!input.trim()}
        >
          <ArrowUp className="size-3.5" />
        </button>
      </div>
    </form>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}


/** Full-window Screenshot section (right column, bottom half): capture +
 * browse captures + the solution with its Code Q&A thread. */
export function ScreenshotPanel() {
  const solutions = useInterviewSessionStore((s) => s.screenshotSolutions)
  const capture = useInterviewSessionStore((s) => s.captureSolution)
  const [index, setIndex] = useState<number | null>(null)

  const last = solutions.length - 1
  const shown = index === null ? last : Math.min(index, last)
  const shot = solutions.at(shown)
  const goTo = (next: number) => {
    if (next < 0 || next > last) return
    setIndex(next === last ? null : next)
  }
  const captureNew = () => {
    capture()
    setIndex(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Screenshot
        </span>
        {solutions.length > 1 && (
          <div className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <button
              type="button"
              className="rounded p-0.5 hover:bg-accent disabled:opacity-40"
              disabled={shown <= 0}
              onClick={() => goTo(shown - 1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            {shown + 1} / {solutions.length}
            <button
              type="button"
              className="rounded p-0.5 hover:bg-accent disabled:opacity-40"
              disabled={shown >= last}
              onClick={() => goTo(shown + 1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto gap-1.5"
          title="Read what's on your screen (⌘⇧P)"
          onClick={captureNew}
        >
          <Camera className="size-3.5" />
          Capture
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SolutionBody solution={shot} />
      </div>
    </div>
  )
}

/** Full-window trigger: capture + show the latest solution in a dialog. */
export function ScreenshotButton() {
  const capture = useInterviewSessionStore((s) => s.captureSolution)
  const latest = useInterviewSessionStore((s) =>
    s.screenshotSolutions.at(-1)
  )
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs"
        title="Read what’s on your screen (⌘⇧S)"
        onClick={() => {
          setOpen(true)
          capture()
        }}
      >
        <Camera className="size-3" />
        Screenshot
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl gap-2">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          <SolutionBody solution={latest} className="max-h-[66vh]" />
        </DialogContent>
      </Dialog>
    </>
  )
}
