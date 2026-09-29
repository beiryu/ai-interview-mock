"use client"

import { Mic, MicOff } from "lucide-react"

import {
  useDeepgramAudioSender,
  useDeepgramConnection,
} from "@/hooks/use-deepgram-connection"
import { useMicrophoneOnly } from "@/hooks/use-microphone-only"

import { Button } from "./ui/button"

/** Captures the candidate's microphone and streams it to Deepgram. */
export default function MicOnlyRecorder() {
  const { connection } = useDeepgramConnection("candidate")
  const handleDataAvailable = useDeepgramAudioSender(connection)

  const { micOpen, toggleMicrophone } = useMicrophoneOnly(handleDataAvailable)

  return (
    <Button
      variant={micOpen ? "default" : "ghost"}
      size="icon"
      onClick={toggleMicrophone}
      title={micOpen ? "Stop my microphone" : "Start my microphone"}
    >
      {micOpen ? <Mic className="size-4" /> : <MicOff className="size-4" />}
    </Button>
  )
}
