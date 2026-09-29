"use client"

import { Mic, MicOff } from "lucide-react"

import { useLiveTranscriber } from "@/hooks/use-live-transcriber"

import { Button } from "./ui/button"

/** Captures the candidate's microphone and transcribes it live. */
export default function MicOnlyRecorder({
  contextTerms,
}: {
  contextTerms?: string[]
}) {
  const { active, start, stop } = useLiveTranscriber("candidate", {
    contextTerms,
  })

  return (
    <Button
      variant={active ? "default" : "ghost"}
      size="icon"
      onClick={active ? stop : start}
      title={active ? "Stop my microphone" : "Start my microphone"}
    >
      {active ? <Mic className="size-4" /> : <MicOff className="size-4" />}
    </Button>
  )
}
