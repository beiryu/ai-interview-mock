"use client"

import { Monitor, MonitorOff, ScreenShare } from "lucide-react"

import { useLiveTranscriber } from "@/hooks/use-live-transcriber"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { VideoPreview } from "@/components/video-preview"

/**
 * Connect the meeting tab (interviewer audio) from the top header: a status
 * dot + Connect/Disconnect, and a Preview popover of the shared screen.
 * Mounts the single interviewer capture (useLiveTranscriber), so it must be
 * rendered once and kept mounted (it lives in the always-mounted playground).
 */
export function MeetingAudioControl({
  contextTerms,
}: {
  contextTerms?: string[]
}) {
  const { active, stream, captureError, start, stop } = useLiveTranscriber(
    "interviewer",
    { contextTerms }
  )
  return (
    <div className="flex items-center gap-1.5">
      {active && stream && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Preview the shared screen"
            >
              <ScreenShare className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            <VideoPreview stream={stream} />
          </PopoverContent>
        </Popover>
      )}

      <Button
        variant={active ? "ghost" : "outline"}
        size="sm"
        title={captureError ?? (active ? "Stop meeting audio" : "Connect meeting audio")}
        onClick={active ? stop : start}
      >
        {active ? (
          <MonitorOff className="size-4" />
        ) : (
          <Monitor className="size-4" />
        )}
        {active ? "Disconnect" : "Connect"}
      </Button>
    </div>
  )
}
