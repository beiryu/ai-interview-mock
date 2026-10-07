"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"
import {
  Camera,
  Check,
  Copy,
  Maximize2,
  Mic,
  MicOff,
  Move,
  RotateCcw,
} from "lucide-react"

import type { QuestionAnalysis } from "@/types/interview-message"
import { isAssumedStory, splitAnswer } from "@/lib/answer/format"
import { getDesktop } from "@/lib/desktop"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AutoAnswerToggle } from "@/components/copilot-status"
import { InterviewChat } from "@/components/interview-chat"
import { SolutionBody } from "@/components/screenshot-solution"
import {
  EvidenceChip,
  SkipButton,
  useEvidenceLabels,
} from "@/components/live-interview-responses"
import { SessionTimer } from "@/components/session-timer"

interface CompactOverlayProps {
  jobId: string
  startedAt: number | null
}

// Words per caption chip
const CHIP_WORDS = 3

/**
 * Desktop compact mode, laid out like a floating copilot (Parakeet-style):
 * the window shrinks and goes clear (desktop/main.ts), leaving floating
 * cards over the meeting:
 *   1. controls — your mic, Auto answer, Answer, Chat, drag handle, full
 *      window
 *   2. the live caption in chips
 *   3. one answer at a time (‹ › to look back), or the chat
 * ⌘⇧C (from any app) opens/closes the chat. While the overlay has focus:
 * ⌘← / ⌘→ page answers, ⌘⌫ clears them. The full playground stays mounted underneath
 * so listening never stops.
 */
/** Active mode button styling (segmented Interview/Screenshot/Chat). */
const MODE_ACTIVE = "border border-dashed border-primary text-primary"

export function CompactOverlay({ jobId, startedAt }: CompactOverlayProps) {
  const messages = useInterviewSessionStore((s) => s.messages)
  const caption = useInterviewSessionStore((s) => s.live.interviewer.text)
  const answerNow = useInterviewSessionStore((s) => s.answerNow)
  const evidence = useEvidenceLabels()

  const [view, setView] = useState<"answers" | "chat" | "solution">("answers")
  // Clear only hides things from the overlay; nothing is deleted
  const [answersClearedAt, setAnswersClearedAt] = useState(0)
  // null = follow the newest answer
  const [index, setIndex] = useState<number | null>(null)

  const answers = messages
    .map((m) => m.questionAnalysis)
    .filter((analysis) => analysis !== null)
    .filter((analysis) => analysis.createdAt.getTime() > answersClearedAt)
  const last = answers.length - 1
  const shown = index === null ? last : Math.min(index, last)
  const answer = answers.at(shown)

  const goTo = (next: number) => {
    if (next < 0 || next > last) return
    setIndex(next === last ? null : next)
  }
  const clearAnswers = () => {
    setAnswersClearedAt(Date.now())
    setIndex(null)
  }

  // Screenshot solutions: same pager model as answers (null = newest)
  const solutions = useInterviewSessionStore((s) => s.screenshotSolutions)
  const clearSolutions = useInterviewSessionStore((s) => s.clearSolutions)
  const [shotIndex, setShotIndex] = useState<number | null>(null)
  const shotLast = solutions.length - 1
  const shotShown = shotIndex === null ? shotLast : Math.min(shotIndex, shotLast)
  const shot = solutions.at(shotShown)
  const goToShot = (next: number) => {
    if (next < 0 || next > shotLast) return
    setShotIndex(next === shotLast ? null : next)
  }
  const clearShots = () => {
    clearSolutions()
    setShotIndex(null)
  }

  const words = caption.trim().split(/\s+/).filter(Boolean)

  // Makes the page clear so only the cards show (app/globals.css)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.compact = ""
    return () => {
      delete root.dataset.compact
    }
  }, [])

  // Tell the store which screenshot Answer now / code-QA targets while the
  // Screenshot view shows one (store.answerNow branches on this)
  const setCodeQaTarget = useInterviewSessionStore((s) => s.setCodeQaTarget)
  const shotId = shot?.id
  useEffect(() => {
    setCodeQaTarget(view === "solution" ? (shotId ?? null) : null)
    return () => setCodeQaTarget(null)
  }, [view, shotId, setCodeQaTarget])

  // Local shortcuts (the overlay has focus); ignored while typing in chat.
  // In the solution view they page/clear screenshots instead of answers.
  const keys = {
    view,
    goTo,
    shown,
    clearAnswers,
    goToShot,
    shotShown,
    clearShots,
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.altKey || event.ctrlKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return
      const solution = keys.view === "solution"
      const prev = () =>
        solution ? keys.goToShot(keys.shotShown - 1) : keys.goTo(keys.shown - 1)
      const next = () =>
        solution ? keys.goToShot(keys.shotShown + 1) : keys.goTo(keys.shown + 1)
      const clear = () => (solution ? keys.clearShots() : keys.clearAnswers())
      if (event.key === "ArrowLeft") prev()
      else if (event.key === "ArrowRight") next()
      else if (event.key === "Backspace" && !event.shiftKey) clear()
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const toFullWindow = () => void getDesktop()?.setCompact(false)

  const capture = useInterviewSessionStore((s) => s.captureSolution)
  // Capture a new shot: show the solution view and jump to it (⌘⇧P / button)
  const captureNew = useCallback(() => {
    setView("solution")
    capture()
    setShotIndex(null)
  }, [capture])

  // The three modes are a toggle group: each button/shortcut selects its
  // view directly. Selecting Chat focuses the window so you can type.
  const selectView = useCallback(
    (next: "answers" | "solution" | "chat") => {
      if (next === "chat") void getDesktop()?.focus()
      setView(next)
    },
    []
  )
  // Global shortcuts (desktop/main.ts): mode selection + capture
  useEffect(
    () =>
      getDesktop()?.onShortcut((action) => {
        if (action === "interview") selectView("answers")
        else if (action === "screenshot") selectView("solution")
        else if (action === "chat") selectView("chat")
        else if (action === "capture") captureNew()
      }),
    [selectView, captureNew]
  )

  return (
    <div className="compact-overlay fixed inset-0 z-50 flex select-none flex-col gap-1 p-1.5 text-[13px] text-foreground">
      {/* 1. Controls — the bar itself drags the window */}
      <Shell className="app-drag mx-2 flex shrink-0 items-center gap-1 rounded-xl p-1">
        <MicButton />
        <AutoAnswerToggle className="app-no-drag h-8 rounded-md border bg-background/90 px-3 text-[13px] text-foreground hover:bg-accent" />
        <Pill
          title="Answer what was said so far (works from any app)"
          className="h-7 border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={answerNow}
        >
          Answer now
          <Kbd className="bg-primary-foreground/20 text-primary-foreground">
            ⌘⇧↵
          </Kbd>
        </Pill>
        <Pill
          title="Interview answers"
          className={cn(view === "answers" && MODE_ACTIVE)}
          onClick={() => selectView("answers")}
        >
          Interview<Kbd>⌘⇧I</Kbd>
        </Pill>
        <Pill
          title="Read what’s on your screen"
          className={cn(view === "solution" && MODE_ACTIVE)}
          onClick={() => selectView("solution")}
        >
          Screenshot<Kbd>⌘⇧S</Kbd>
        </Pill>
        <Pill
          title="Ask the copilot anything"
          className={cn(view === "chat" && MODE_ACTIVE)}
          onClick={() => selectView("chat")}
        >
          Chat<Kbd>⌘⇧C</Kbd>
        </Pill>
        <SessionTimer
          startedAt={startedAt}
          className="ml-auto shrink-0 px-1 text-xs text-muted-foreground [&_svg]:hidden"
        />
        <IconBadge title="Drag to move" className="cursor-grab">
          <Move className="size-4" strokeWidth={1.75} />
        </IconBadge>
        <IconPill title="Back to the full window (⌘⇧O)" onClick={toFullWindow}>
          <Maximize2 className="size-4" strokeWidth={1.75} />
        </IconPill>
      </Shell>

      {/* 2. Live caption */}
      <Shell className="mx-2 flex shrink-0 items-center gap-1 rounded-xl p-1">
        <LiveCaption words={words} />
      </Shell>

      {/* 3. Answer / chat / solution */}
      <Shell className="flex min-h-0 flex-1 flex-col gap-1 rounded-xl p-1">
        {view === "solution" ? (
          <>
            <div className="flex shrink-0 items-center gap-1">
              <Pill
                title="Previous screenshot (⌘←)"
                className="px-1.5"
                disabled={shotShown <= 0}
                onClick={() => goToShot(shotShown - 1)}
              >
                <Kbd>⌘←</Kbd>
              </Pill>
              <Pill
                title="Next screenshot (⌘→)"
                className="px-1.5"
                disabled={shotShown >= shotLast}
                onClick={() => goToShot(shotShown + 1)}
              >
                <Kbd>⌘→</Kbd>
              </Pill>
              {solutions.length > 1 && (
                <span className="px-1 text-xs tabular-nums text-muted-foreground">
                  {shotShown + 1} / {solutions.length}
                </span>
              )}
              <Pill
                title="Capture what’s on your screen (⌘⇧P)"
                className="ml-auto"
                onClick={captureNew}
              >
                <Camera className="size-3.5" strokeWidth={1.75} />
                Capture<Kbd>⌘⇧P</Kbd>
              </Pill>
            </div>
            <div className="min-h-0 flex-1 select-text overflow-hidden rounded-lg border bg-card/50 text-card-foreground">
              <SolutionBody solution={shot} />
            </div>
          </>
        ) : view === "answers" ? (
          <>
            <div className="flex shrink-0 items-center gap-1">
              <Pill
                title="Previous answer (⌘←)"
                className="px-1.5"
                disabled={shown <= 0}
                onClick={() => goTo(shown - 1)}
              >
                <Kbd>⌘←</Kbd>
              </Pill>
              <Pill
                title="Next answer (⌘→)"
                className="px-1.5"
                disabled={shown >= last}
                onClick={() => goTo(shown + 1)}
              >
                <Kbd>⌘→</Kbd>
              </Pill>
              {answers.length > 1 && (
                <span className="px-1 text-xs tabular-nums text-muted-foreground">
                  {shown + 1} / {answers.length}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card/50 text-card-foreground">
              <ScrollArea className="h-full">
                {answer ? (
                  <OverlayAnswer response={answer} evidence={evidence} />
                ) : (
                  <p className="p-5 text-center text-muted-foreground">
                    The answer shows here when the interviewer asks a question.
                  </p>
                )}
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 select-text overflow-hidden rounded-lg border bg-card/50 text-card-foreground">
            <InterviewChat bare />
          </div>
        )}
      </Shell>
    </div>
  )
}

/**
 * The interviewer's words as they arrive: each word fades in from a blur,
 * each new chip pops in, and the strip glides left to keep the newest words
 * in view (app/globals.css has the keyframes; reduced motion turns them off).
 */
// Interviewer-capture status shown when no words have arrived yet, so the
// caption reflects whether the copilot is actually hearing the interviewer
const CAPTURE_LABEL = {
  disconnected: "Not connected",
  connecting: "Connecting…",
  connected: "Listening…",
} as const

function LiveCaption({ words }: { words: string[] }) {
  const micStatus = useInterviewSessionStore((s) => s.microphoneStatus)
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = strip.current
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })
  }, [words.length])

  const chips: string[][] = []
  for (let i = 0; i < words.length; i += CHIP_WORDS)
    chips.push(words.slice(i, i + CHIP_WORDS))

  return (
    // The box keeps its border and corners; inside it, the strip scrolls
    <div className="flex h-8 min-w-0 flex-1 items-center overflow-hidden rounded-md border bg-background/50 pl-2.5 pr-1">
      <div
        ref={strip}
        className="h-full min-w-0 flex-1 overflow-hidden"
      >
        <div
          className={cn(
            "flex h-full w-max min-w-full items-center gap-1 whitespace-nowrap",
            chips.length > 0 ? "justify-end" : "justify-start"
          )}
        >
          {chips.length > 0 ? (
            // Keys are positions in the turn, so only new chips/words animate
            chips.map((chip, c) => (
              <span
                key={c}
                className="caption-chip shrink-0 rounded-sm bg-muted px-2.5 py-0.5 text-foreground"
              >
                {chip.map((word, w) => (
                  <span key={w} className="caption-word">
                    {w > 0 && " "}
                    {word}
                  </span>
                ))}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">
              {CAPTURE_LABEL[micStatus]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Outer translucent grey frame around a row of pills. */
function Shell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border border-sidebar-border bg-sidebar/45 text-sidebar-foreground shadow-xl shadow-black/20",
        className
      )}
      {...props}
    />
  )
}

function Pill({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "app-no-drag flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background/90 px-3 font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-background/90",
        className
      )}
      {...props}
    />
  )
}

function IconPill({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <Pill className={cn("w-8 justify-center px-0", className)} {...props} />
  )
}

/** A pill-shaped icon that isn't a button (drags with its bar). */
function IconBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md border bg-background/90 text-foreground",
        className
      )}
      {...props}
    />
  )
}

function Kbd({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cn(
        "rounded-sm bg-muted px-1.5 py-0.5 font-sans text-[11px] font-normal tracking-wider text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  )
}

/** Your microphone on/off, with a red dot while it records. */
function MicButton() {
  const active = useInterviewSessionStore((s) => s.candidateMicActive)
  const toggle = useInterviewSessionStore((s) => s.toggleCandidateMic)

  return (
    <IconPill
      title={active ? "Stop my microphone" : "Start my microphone"}
      disabled={!toggle}
      className="relative"
      onClick={() => toggle?.()}
    >
      {active ? (
        <Mic className="size-4" strokeWidth={1.75} />
      ) : (
        <MicOff className="size-4 opacity-60" strokeWidth={1.75} />
      )}
      {active && (
        <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 ring-2 ring-background" />
      )}
    </IconPill>
  )
}

/** "💬 Question: …" then "⭐ Answer: headline", the points and the script. */
function OverlayAnswer({
  response,
  evidence,
}: {
  response: QuestionAnalysis
  evidence: Map<string, string>
}) {
  const regenerate = useInterviewSessionStore((s) => s.regenerate)
  const [copied, setCopied] = useState(false)
  const parsed = splitAnswer(response.suggestedAnswer)
  const { headline, points, script } = parsed
  const assumed = isAssumedStory(parsed, response.kind)
  const streaming = response.suggestedAnswer.length === 0

  const copy = () => {
    const text = [headline, ...points.map((point) => `• ${point.text}`), script]
      .filter(Boolean)
      .join("\n")
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="select-text p-3 leading-relaxed">
      <div className="flex items-start gap-3 border-b pb-2.5">
        <p className="flex-1">
          💬 <span className="font-bold">Question:</span> {response.question}
        </p>
        <button
          type="button"
          title="Copy the answer"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={copy}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>

      {response.error ? (
        <p className="pt-3 text-destructive">{response.error}</p>
      ) : (
        <div className="space-y-2.5 pt-2.5">
          <p>
            ⭐ <span className="font-bold">Answer:</span> {headline}
            {streaming && (
              <span className="ml-1 inline-block h-3.5 w-2 animate-pulse rounded-sm bg-muted-foreground/50" />
            )}
          </p>
          {assumed && (
            <p className="text-sm text-violet-700 dark:text-violet-300">
              ✎ Ví dụ giả định — không có trong prep, chỉnh nếu chưa đúng
            </p>
          )}
          {points.length > 0 && (
            <ul className="space-y-1">
              {points.map((point, i) => (
                <li key={i}>
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
          {script && <p>{script}</p>}
        </div>
      )}

      {response.issues && response.issues.length > 0 && (
        <ul className="mt-3 space-y-0.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-sm text-amber-800 dark:text-amber-300">
          {response.issues.map((issue, i) => (
            <li key={i}>⚠ Check: {issue.detail}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2 text-muted-foreground">
        <span>
          Answer ·{" "}
          {response.createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <button
          type="button"
          title="Regenerate"
          className="rounded p-1 hover:bg-accent hover:text-accent-foreground"
          onClick={() => regenerate(response.messageId)}
        >
          <RotateCcw className="size-4" />
        </button>
        <SkipButton messageId={response.messageId} />
      </div>
    </div>
  )
}
