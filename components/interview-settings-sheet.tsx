"use client"

import { useState } from "react"
import { Settings2 } from "lucide-react"

import { useConfig } from "@/lib/config/config.hooks"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const LANGUAGE_OPTIONS = [
  { value: "multi", label: "Auto-detect" },
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
  { value: "en-US", label: "English (US)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
]

export function InterviewSettingsSheet() {
  const { config, updateConfig } = useConfig()
  const [open, setOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  const [language, setLanguage] = useState(config.deepgram.language)
  const [utteranceEndMs, setUtteranceEndMs] = useState(
    config.deepgram.utteranceEndMs
  )
  const [endpointing, setEndpointing] = useState(config.deepgram.endpointing)

  // Reset local state to current config when sheet opens
  function handleOpenChange(value: boolean) {
    if (value) {
      setLanguage(config.deepgram.language)
      setUtteranceEndMs(config.deepgram.utteranceEndMs)
      setEndpointing(config.deepgram.endpointing)
    }
    setOpen(value)
  }

  async function handleApply() {
    setApplying(true)
    try {
      await updateConfig({
        deepgramLanguage: language,
        utteranceEndMs,
        deepgramEndpointing: endpointing,
      })
      setOpen(false)
    } catch (err) {
      console.error("Failed to update transcription settings:", err)
    } finally {
      setApplying(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="Transcription settings"
        >
          <Settings2 className="size-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">Transcription Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 py-5">
          {/* Language */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-xs"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Utterance End Ms */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">End of speech delay</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {utteranceEndMs}ms
              </span>
            </div>
            <input
              type="range"
              min={500}
              max={10000}
              step={100}
              value={utteranceEndMs}
              onChange={(e) => setUtteranceEndMs(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-foreground"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>500ms</span>
              <span>10s</span>
            </div>
          </div>

          {/* Endpointing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Silence threshold</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {endpointing}ms
              </span>
            </div>
            <input
              type="range"
              min={200}
              max={5000}
              step={100}
              value={endpointing}
              onChange={(e) => setEndpointing(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-foreground"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>200ms</span>
              <span>5s</span>
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3">
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? "Reconnecting…" : "Apply & reconnect"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
