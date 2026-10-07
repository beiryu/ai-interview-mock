"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  restoreAutoAnswer,
  useInterviewSessionStore,
} from "@/stores/interview-session.store"
import { Zap } from "lucide-react"

import { useGetJob } from "@/hooks/api/job/useJobs"
import { useCopilotHotkeys } from "@/hooks/use-copilot-hotkeys"
import { useDesktop } from "@/hooks/use-desktop"
import { useInterviewSessionLifecycle } from "@/hooks/use-interview-session-lifecycle"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CompactOverlay } from "@/components/compact-overlay"
import {
  AutoAnswerToggle,
  CopilotStatusLabel,
} from "@/components/copilot-status"
import { InterviewChat } from "@/components/interview-chat"
import { LiveInterviewResponses } from "@/components/live-interview-responses"
import MicOnlyRecorder from "@/components/mic-only-recorder"
import { MicrophoneConnectionStatus } from "@/components/microphone-connection-status"
import { ScreenshotPanel } from "@/components/screenshot-solution"
import { CvSheet, JdSheet } from "@/components/jobs/cv-jd-drawers"
import RecorderTranscriber from "@/components/recorder-transcriber"
import { SessionTimer } from "@/components/session-timer"
import { TranscriptionDisplay } from "@/components/transcription-display"

interface LiveInterviewPlaygroundV2Props {
  jobId: string
  /** Resume this specific in-progress session (from the history "Resume") */
  sessionId?: string
  defaultLayout?: number[]
}

export function LiveInterviewPlaygroundV2({
  jobId,
  sessionId,
  defaultLayout = [30, 40, 30],
}: LiveInterviewPlaygroundV2Props) {
  const router = useRouter()
  const { data: job } = useGetJob(jobId)
  const { startedAt, checking, starting, start, finish } =
    useInterviewSessionLifecycle(jobId, sessionId)
  const active = startedAt !== null
  const answerNow = useInterviewSessionStore((s) => s.answerNow)
  useCopilotHotkeys()
  useEffect(() => restoreAutoAnswer(), [])

  // Desktop: ⌘⇧O (or the button) shrinks the window to a compact overlay
  const desktop = useDesktop()
  const [compact, setCompact] = useState(false)
  useEffect(() => desktop?.onCompact(setCompact), [desktop])

  const [isEnding, setIsEnding] = useState(false)
  const handleEnd = useCallback(async () => {
    setIsEnding(true)
    void desktop?.setCompact(false)
    const saved = await finish()
    router.push(
      saved
        ? `/dashboard/jobs/${jobId}?tab=sessions`
        : `/dashboard/jobs/${jobId}`
    )
  }, [finish, router, jobId, desktop])


  // Help speech-to-text with names it can't know (company, role)
  const contextTerms = useMemo(
    () =>
      [job?.company, job?.title].filter((term): term is string =>
        Boolean(term)
      ),
    [job?.company, job?.title]
  )

  return (
    <TooltipProvider delayDuration={0}>
      {compact && <CompactOverlay jobId={jobId} startedAt={startedAt} />}
      {/* Hidden, not unmounted, in compact mode: capture keeps running.
          Fixed height (minus the dashboard chrome + desktop title-bar) so the
          panels fill the window regardless of the header's height. */}
      <div
        className={compact ? "hidden" : "flex flex-col"}
        style={
          compact
            ? undefined
            : { height: "calc(100vh - var(--titlebar, 0px) - 112px)" }
        }
      >
        {/* Top header (single row) */}
        <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-t-lg border border-b-0 bg-background px-5 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              {job?.company || "Interview"}
            </h1>
            {job && (
              <>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-1">
                  <CvSheet jobId={job.id} />
                  <JdSheet
                    company={job.company}
                    title={job.title}
                    jdText={job.jdText}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <MicOnlyRecorder contextTerms={contextTerms} />
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <CopilotStatusLabel />
              <Separator orientation="vertical" className="h-4" />
              <span className="flex items-center gap-1.5">
                <MicrophoneConnectionStatus />
              </span>
              <Separator orientation="vertical" className="h-4" />
              <SessionTimer startedAt={startedAt} className="text-sm" />
            </div>
            <Separator orientation="vertical" className="h-5" />
            {desktop && (
              <Button
                variant="outline"
                size="sm"
                title="Small always-on-top overlay (⌘⇧O)"
                onClick={() => void desktop.setCompact(true)}
              >
                Overlay
              </Button>
            )}
            {checking ? null : !active ? (
              <Button
                size="sm"
                title="Start the interview (begins the session and timer)"
                onClick={() => void start()}
                disabled={starting}
              >
                {starting ? "Starting…" : "Start session"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEnd}
                disabled={isEnding}
              >
                {isEnding ? "Saving…" : "End session"}
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup
            direction="horizontal"
            className="size-full items-stretch rounded-b-lg border"
          >
          {/* Left panel: Transcription */}
          <ResizablePanel
            defaultSize={defaultLayout[0]}
            minSize={0}
            className="flex min-h-0 flex-col"
          >
            <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transcription
              </span>
            </div>
            <TranscriptionDisplay />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Center panel: Meeting room (connect + video) 1/3 · AI 2/3 */}
          <ResizablePanel
            defaultSize={defaultLayout[1]}
            minSize={25}
            className="flex min-h-0 flex-col"
          >
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel
                defaultSize={33}
                minSize={0}
                className="flex min-h-0 flex-col"
              >
                <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Meeting room
                  </span>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto border-b bg-muted/30 px-3 py-4">
                  <RecorderTranscriber contextTerms={contextTerms} />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel
                defaultSize={67}
                minSize={0}
                className="flex min-h-0 flex-col"
              >
                <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    AI suggestions
                  </span>
                  <div className="flex items-center gap-2">
                    <AutoAnswerToggle />
                    <Button
                      size="sm"
                      className="gap-1.5"
                      title="Answer what was said so far (⌘⇧↵ / Alt+Enter)"
                      onClick={answerNow}
                    >
                      <Zap className="size-3.5" />
                      Answer now
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <LiveInterviewResponses />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: Chat (top) + Screenshot (bottom) */}
          <ResizablePanel
            defaultSize={defaultLayout[2]}
            minSize={0}
            className="flex min-h-0 flex-col"
          >
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel
                defaultSize={50}
                minSize={0}
                className="flex min-h-0 flex-col"
              >
                <InterviewChat />
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel
                defaultSize={50}
                minSize={0}
                className="flex min-h-0 flex-col"
              >
                <ScreenshotPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  )
}
