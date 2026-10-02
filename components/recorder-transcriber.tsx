"use client"

import { useLiveTranscriber } from "@/hooks/use-live-transcriber"

import { RecordButton } from "./record-button"
import { VideoPreview } from "./video-preview"

/** Captures the meeting tab (interviewer side) and transcribes it live. */
export default function RecorderTranscriber({
  contextTerms,
}: {
  contextTerms?: string[]
}) {
  const { active, stream, captureError, start, stop } = useLiveTranscriber(
    "interviewer",
    { contextTerms }
  )

  return (
    <div className="relative w-full">
      {active && stream ? (
        <div className="flex max-h-[min(42vh,320px)] items-center justify-center overflow-hidden p-2">
          <VideoPreview stream={stream} />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <RecordButton micOpen={active} onClick={active ? stop : start} />
          {captureError && (
            <p className="px-4 text-center text-xs text-destructive">
              {captureError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
