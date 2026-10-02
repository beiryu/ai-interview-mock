"use client"

import { Maximize2 } from "lucide-react"

import { getDesktop } from "@/lib/desktop"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CopilotStatus } from "@/components/copilot-status"
import { LatestAnswer } from "@/components/live-interview-responses"

/**
 * Desktop compact mode: the window shrinks to a small always-on-top panel
 * (desktop/main.ts) that shows only the status and the latest answer. The
 * full playground stays mounted underneath so listening never stops.
 */
export function CompactOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <CopilotStatus />
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          title="Back to the full window (⌘⇧O)"
          onClick={() => void getDesktop()?.setCompact(false)}
        >
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2 text-base">
          <LatestAnswer />
        </div>
      </ScrollArea>
    </div>
  )
}
