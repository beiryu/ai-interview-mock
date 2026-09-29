"use client"

import {
  useDeepgramAudioSender,
  useDeepgramConnection,
} from "@/hooks/use-deepgram-connection"
import { useMicrophone } from "@/hooks/use-microphone"

import { RecordButton } from "./record-button"
import { VideoPreview } from "./video-preview"

/** Captures the meeting tab (interviewer side) and streams it to Deepgram. */
export default function RecorderTranscriber() {
  const { connection, status } = useDeepgramConnection("interviewer")
  const handleDataAvailable = useDeepgramAudioSender(connection)

  const { micOpen, userMedia, toggleMicrophone } =
    useMicrophone(handleDataAvailable)

  return (
    <div className="relative w-full">
      {micOpen && userMedia ? (
        <div className="flex max-h-[min(42vh,320px)] items-center justify-center overflow-hidden p-2">
          <VideoPreview stream={userMedia} />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <RecordButton
            micOpen={micOpen}
            onClick={toggleMicrophone}
            disabled={status !== "ready"}
          />
        </div>
      )}
    </div>
  )
}
