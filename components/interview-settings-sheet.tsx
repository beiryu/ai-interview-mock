"use client"

import { useState } from "react"
import { Settings2 } from "lucide-react"

import { useConfig } from "@/lib/config/config.hooks"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface SliderFieldProps {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-foreground"
      />
      <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  )
}

const ms = (value: number) => `${value}ms`

export function InterviewSettingsSheet() {
  const { config, updateConfig } = useConfig()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [maxSilence, setMaxSilence] = useState(
    config.interview.turnMaxSilenceMs
  )
  const [endpointDelay, setEndpointDelay] = useState(
    config.stt.endpointMaxDelayMs
  )
  const [sensitivity, setSensitivity] = useState(config.stt.endpointSensitivity)

  // Reset local state to current config when sheet opens
  function handleOpenChange(value: boolean) {
    if (value) {
      setMaxSilence(config.interview.turnMaxSilenceMs)
      setEndpointDelay(config.stt.endpointMaxDelayMs)
      setSensitivity(config.stt.endpointSensitivity)
    }
    setOpen(value)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateConfig({
        turnMaxSilenceMs: maxSilence,
        endpointMaxDelayMs: endpointDelay,
        endpointSensitivity: sensitivity,
      })
      setOpen(false)
    } catch (err) {
      console.error("Failed to update transcription settings:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="Turn-taking settings"
        >
          <Settings2 className="size-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">Turn-taking</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 py-5">
          <p className="text-xs text-muted-foreground">
            Vietnamese and English are recognized automatically. Increase the
            delays if questions get cut off; decrease them for faster answers.
          </p>

          <SliderField
            label="Max silence before answering"
            hint="Answer after this much interviewer silence even if the question sounds unfinished. Applies immediately."
            value={maxSilence}
            min={1000}
            max={5000}
            step={100}
            format={ms}
            onChange={setMaxSilence}
          />

          <SliderField
            label="End-of-turn max delay"
            hint="Longest the speech model waits before deciding the interviewer finished. Applies to the next capture."
            value={endpointDelay}
            min={500}
            max={3000}
            step={100}
            format={ms}
            onChange={setEndpointDelay}
          />

          <SliderField
            label="End-of-turn sensitivity"
            hint="Higher ends turns sooner; lower tolerates longer thinking pauses. Applies to the next capture."
            value={sensitivity}
            min={-1}
            max={1}
            step={0.1}
            format={(value) => value.toFixed(1)}
            onChange={setSensitivity}
          />
        </div>

        <div className="border-t px-4 py-3">
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
