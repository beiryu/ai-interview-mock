"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useChatDocumentStore } from "@/stores/chat-document-store"
import { Clock, FileText, Zap } from "lucide-react"

import { useGetInterview } from "@/hooks/api/interview/useGetInterview"
import { useInterviewSessionLifecycle } from "@/hooks/use-interview-session-lifecycle"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import DocumentSelector from "@/components/chat/document-selector"
import StreamingChat from "@/components/chat/streaming-chat"
import { LiveInterviewResponses } from "@/components/live-interview-responses"
import MicOnlyRecorder from "@/components/mic-only-recorder"
import { MicrophoneConnectionStatus } from "@/components/microphone-connection-status"
import RecorderTranscriber from "@/components/recorder-transcriber"
import { TranscriptionDisplay } from "@/components/transcription-display"

interface LiveInterviewPlaygroundV2Props {
  interviewId: string
  defaultLayout?: number[]
}

export function LiveInterviewPlaygroundV2({
  interviewId,
  defaultLayout = [30, 40, 30],
}: LiveInterviewPlaygroundV2Props) {
  const router = useRouter()
  const { data: interview } = useGetInterview(interviewId)
  const { startedAt, finish } = useInterviewSessionLifecycle(interviewId)
  const {
    clearDocumentSelection,
    clearActiveSession,
    coachDocuments,
    toggleCoachDocument,
    clearCoachDocuments,
    fastMode,
    setFastMode,
  } = useChatDocumentStore()

  // Reset RAG chat state when interview changes
  useEffect(() => {
    clearDocumentSelection()
    clearActiveSession()
    clearCoachDocuments()
  }, [
    interviewId,
    clearDocumentSelection,
    clearActiveSession,
    clearCoachDocuments,
  ])

  const [isEnding, setIsEnding] = useState(false)
  const handleEnd = useCallback(async () => {
    setIsEnding(true)
    const saved = await finish()
    router.push(
      saved
        ? `/dashboard/interviews/${interviewId}/sessions`
        : "/dashboard/interviews"
    )
  }, [finish, router, interviewId])

  const subtitle = [interview?.companyName, interview?.jobTitle]
    .filter(Boolean)
    .join(" · ")

  // Help speech-to-text with names it can't know (company, role)
  const contextTerms = useMemo(
    () =>
      [interview?.companyName, interview?.jobTitle].filter(
        (term): term is string => Boolean(term)
      ),
    [interview?.companyName, interview?.jobTitle]
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col">
        {/* Unified top header */}
        <div className="flex h-14 shrink-0 items-center justify-between rounded-t-lg border border-b-0 bg-background px-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight">
                {interview?.name ?? "Interview"}
              </h1>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <Separator orientation="vertical" className="h-4" />
            <SessionTimer startedAt={startedAt} />
          </div>
          <div className="flex items-center gap-2">
            <MicOnlyRecorder contextTerms={contextTerms} />
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEnd}
              disabled={isEnding}
            >
              {isEnding ? "Saving…" : "End session"}
            </Button>
          </div>
        </div>

        <ResizablePanelGroup
          direction="horizontal"
          className="max-h-[calc(100vh-156px)] items-stretch rounded-b-lg border"
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

          {/* Center panel: Connection status + AI Responses */}
          <ResizablePanel
            defaultSize={defaultLayout[1]}
            minSize={25}
            className="flex min-h-0 flex-col"
          >
            <ResizablePanelGroup direction="vertical">
              {/* Meeting room: connect flow + screen preview */}
              <ResizablePanel
                defaultSize={28}
                minSize={0}
                className="flex min-h-0 flex-col"
              >
                <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Meeting room
                  </span>
                  <MicrophoneConnectionStatus />
                </div>
                <div className="min-h-0 flex-1 overflow-auto border-b bg-muted/30 px-3 py-4">
                  <RecorderTranscriber contextTerms={contextTerms} />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* AI Suggestions */}
              <ResizablePanel
                defaultSize={72}
                minSize={0}
                className="flex min-h-0 flex-col"
              >
                <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    AI Suggestions
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={fastMode ? "default" : "outline"}
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => setFastMode(!fastMode)}
                      title={
                        fastMode
                          ? "Fast mode: file search disabled. Click to enable Normal mode."
                          : "Normal mode: file search enabled. Click to enable Fast mode."
                      }
                    >
                      <Zap className="size-3" />
                      {fastMode ? "Fast" : "Normal"}
                    </Button>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Select documents for Answer Coach"
                          disabled={fastMode}
                        >
                          <FileText className="size-3.5" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-80 p-0">
                        <SheetHeader className="px-4 py-3 border-b">
                          <SheetTitle className="text-sm">
                            Coach Documents
                          </SheetTitle>
                        </SheetHeader>
                        <p className="px-4 py-2 text-xs text-muted-foreground">
                          Select documents for the Answer Coach to reference. If
                          none selected, all documents are searched.
                        </p>
                        <DocumentSelector
                          selectedDocuments={coachDocuments}
                          onToggle={toggleCoachDocument}
                        />
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <LiveInterviewResponses />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: Chat */}
          <ResizablePanel
            defaultSize={defaultLayout[2]}
            minSize={0}
            className="flex min-h-0 flex-col"
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <StreamingChat />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  )
}

function SessionTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  const seconds = startedAt
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0
  const label = startedAt
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
        seconds % 60
      ).padStart(2, "0")}`
    : "Not started"

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3.5" />
      <span className="font-mono tabular-nums">{label}</span>
    </div>
  )
}
