"use client"

import * as React from "react"
import { FileUp, Files, Sparkles } from "lucide-react"

import { CV_ORIGIN_LABEL } from "@/lib/cv/schema"
import { cn } from "@/lib/utils"
import type { CvSource } from "@/lib/validations/job"
import { useCvs, useExtractFile } from "@/hooks/api/cv/useCvs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"

type Mode = CvSource["type"]

const MIN_CV_CHARS = 200

const MODES: {
  mode: Mode
  icon: typeof FileUp
  title: string
  hint: string
}[] = [
  {
    mode: "upload",
    icon: FileUp,
    title: "Upload a CV",
    hint: "Refined for this job from your CV",
  },
  {
    mode: "cv",
    icon: Files,
    title: "One of my CVs",
    hint: "Refine a CV you already have",
  },
  {
    mode: "generate",
    icon: Sparkles,
    title: "Generate from the JD",
    hint: "A fictional persona, for practice",
  },
]

/**
 * Where a job's CV comes from. Reports a complete source (or null while
 * it's incomplete) through onChange.
 */
export function CvSourcePicker({
  onChange,
  disabled,
  uploadOnly = false,
}: {
  onChange: (source: CvSource | null) => void
  disabled?: boolean
  /** Only the upload form (uploading a CV on its own) */
  uploadOnly?: boolean
}) {
  const { data: cvs } = useCvs()
  const usable = (cvs ?? []).filter((cv) => cv.origin !== "GENERATED")
  const [mode, setMode] = React.useState<Mode>("upload")
  const [title, setTitle] = React.useState("")
  const [rawText, setRawText] = React.useState("")
  const [cvId, setCvId] = React.useState("")
  const extract = useExtractFile()
  const fileInput = React.useRef<HTMLInputElement>(null)

  // Default to your CVs once you have some
  const defaulted = React.useRef(false)
  React.useEffect(() => {
    if (!defaulted.current && !uploadOnly && usable.length > 0) {
      defaulted.current = true
      setMode("cv")
      setCvId(usable.find((cv) => cv.origin === "UPLOADED")?.id ?? usable[0].id)
    }
  }, [usable, uploadOnly])

  React.useEffect(() => {
    if (mode === "generate") onChange({ type: "generate" })
    else if (mode === "cv") onChange(cvId ? { type: "cv", cvId } : null)
    else
      onChange(
        rawText.trim().length >= MIN_CV_CHARS
          ? { type: "upload", title: title.trim() || "My CV", rawText }
          : null
      )
  }, [mode, title, rawText, cvId, onChange])

  const readFile = (file: File) =>
    extract.mutate(file, {
      onSuccess: ({ title: name, content }) => {
        setRawText(content)
        if (!title) setTitle(name)
      },
      onError: (error: Error) =>
        toast({
          title: "Couldn't read the file",
          description: error.message,
          variant: "destructive",
        }),
    })

  const busy = disabled || extract.isPending

  return (
    <div className="grid gap-3">
      <div className={cn("grid gap-2 sm:grid-cols-3", uploadOnly && "hidden")}>
        {MODES.map(({ mode: m, icon: Icon, title: label, hint }) => {
          const unavailable = m === "cv" && usable.length === 0
          return (
            <button
              key={m}
              type="button"
              disabled={busy || unavailable}
              onClick={() => setMode(m)}
              className={cn(
                "grid gap-1 rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                mode === m && "border-primary bg-muted"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4" />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">
                {unavailable ? "No CVs yet" : hint}
              </span>
            </button>
          )
        })}
      </div>

      {mode === "upload" && (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Input
              value={title}
              disabled={busy}
              placeholder="Name it (e.g. CV Frontend 2026)"
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="flex shrink-0 items-center gap-1 rounded-md border px-3 py-2 text-xs hover:bg-muted"
            >
              {extract.isPending ? (
                <Icons.spinner className="size-3.5 animate-spin" />
              ) : (
                <FileUp className="size-3.5" />
              )}
              PDF/DOCX
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) readFile(file)
                e.target.value = ""
              }}
            />
          </div>
          <Textarea
            value={rawText}
            disabled={busy}
            placeholder="…or paste your CV's text"
            className="min-h-[140px] text-sm"
            onChange={(e) => setRawText(e.target.value)}
          />
          {!uploadOnly && (
            <p className="text-xs text-muted-foreground">
              It is saved under CVs, so the next job can start from it.
            </p>
          )}
        </div>
      )}

      {mode === "cv" && usable.length > 0 && (
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Start from</Label>
          <Select value={cvId} onValueChange={setCvId} disabled={busy}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a CV" />
            </SelectTrigger>
            <SelectContent>
              {usable.map((cv) => (
                <SelectItem key={cv.id} value={cv.id}>
                  {cv.title}{" "}
                  <span className="text-muted-foreground">
                    · {CV_ORIGIN_LABEL[cv.origin]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === "generate" && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          A fictional candidate who fits this job, to practise the interview
          with. Its companies and projects are made up, so it can&apos;t be
          downloaded or sent to an employer.
        </p>
      )}
    </div>
  )
}
