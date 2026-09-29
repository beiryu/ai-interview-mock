"use client"

import { useState } from "react"
import { Check, Settings2 } from "lucide-react"

import {
  TURN_PACES,
  TURN_PACE_PRESETS,
  type TurnPace,
} from "@/config/defaults/turn-pace"
import { useConfig } from "@/lib/config/config.hooks"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function InterviewSettingsSheet() {
  const { config, updateConfig } = useConfig()
  const [saving, setSaving] = useState<TurnPace | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(pace: TurnPace) {
    if (pace === config.turnPace) return
    setSaving(pace)
    setError(null)
    try {
      await updateConfig({ turnPace: pace })
    } catch {
      setError("Could not save. Try again.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="Answer pace"
        >
          <Settings2 className="size-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">Answer pace</SheetTitle>
        </SheetHeader>

        <div className="space-y-2 px-4 py-5">
          <p className="pb-2 text-xs text-muted-foreground">
            How long to wait before treating the interviewer&apos;s question as
            finished. Vietnamese and English are recognized automatically.
          </p>

          {TURN_PACES.map((pace) => {
            const preset = TURN_PACE_PRESETS[pace]
            const selected = pace === config.turnPace
            return (
              <button
                key={pace}
                type="button"
                onClick={() => choose(pace)}
                disabled={saving !== null}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent disabled:opacity-60",
                  selected && "border-primary bg-accent"
                )}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{preset.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {preset.description}
                  </div>
                  <div className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">
                    complete question after {preset.interview.completeCommitMs}
                    ms · at most {preset.interview.turnMaxSilenceMs / 1000}s
                  </div>
                </div>
                {selected && <Check className="mt-0.5 text-primary" />}
              </button>
            )
          })}

          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="pt-2 text-[11px] text-muted-foreground">
            Takes effect immediately; the speech model&apos;s part applies the
            next time you share the tab.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
