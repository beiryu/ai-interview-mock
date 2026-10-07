"use client"

import * as React from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"

import { CV_ORIGIN_LABEL } from "@/lib/cv/schema"
import type { CvSource } from "@/lib/validations/job"
import { useJobCv } from "@/hooks/api/cv/useCvs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"

import { CvEditor } from "./cv-editor"
import { CvSourcePicker } from "./cv-source-picker"

/**
 * The job's CV tab: where it came from, the editor, and starting over from
 * another source. A job without a CV asks where its CV should come from.
 */
export function JobCvTab({ jobId }: { jobId: string }) {
  const cv = useJobCv(jobId)
  const state = cv.data

  if (!state) return <Skeleton className="h-64 w-full" />

  const start = (source?: CvSource) =>
    cv.start.mutate(source, {
      onError: (error: Error) =>
        toast({
          title: "Couldn't start the CV",
          description: error.message,
          variant: "destructive",
        }),
    })

  if (!state.cv) {
    return (
      <div className="grid max-w-3xl gap-4">
        <p className="text-sm text-muted-foreground">
          This job has no CV yet. Where should it come from?
        </p>
        <SourceForm
          submitLabel="Make the CV"
          busy={cv.start.isPending}
          onSubmit={start}
        />
      </div>
    )
  }

  const origin = state.cv.origin
  return (
    <div className="grid gap-4">
      <CvEditor
        state={state}
        saving={cv.save.isPending}
        onSave={(content, done) =>
          cv.save.mutate(
            { cvId: state.cv!.id, content },
            {
              onSuccess: done,
              onError: () =>
                toast({ title: "Could not save", variant: "destructive" }),
            }
          )
        }
        onRebuild={() => start()}
        rebuilding={cv.start.isPending}
        toolbarStart={
          <span className="text-xs text-muted-foreground">
            {CV_ORIGIN_LABEL[origin]}
            {state.cv.basedOn && (
              <>
                {" from "}
                <Link
                  href={`/dashboard/cvs/${state.cv.basedOn.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {state.cv.basedOn.title}
                </Link>
              </>
            )}{" "}
            ·
          </span>
        }
        renderRebuild={({ disabled }) => (
          <RegenerateDialog
            disabled={disabled}
            busy={cv.start.isPending}
            onSubmit={start}
            initial={
              origin === "GENERATED"
                ? { type: "generate" }
                : state.cv?.basedOn
                ? { type: "cv", cvId: state.cv.basedOn.id }
                : undefined
            }
          />
        )}
        emptyText={
          origin === "GENERATED"
            ? "Writing a practice persona for this job (about 15 seconds)…"
            : "Writing your CV for this job from the CV you chose (about 15 seconds; a new upload is read first)…"
        }
      />
    </div>
  )
}

function SourceForm({
  submitLabel,
  busy,
  onSubmit,
}: {
  submitLabel: string
  busy: boolean
  onSubmit: (source: CvSource) => void
}) {
  const [source, setSource] = React.useState<CvSource | null>(null)
  return (
    <div className="grid gap-4">
      <CvSourcePicker onChange={setSource} disabled={busy} />
      <div className="flex justify-end">
        <Button
          disabled={!source || busy}
          onClick={() => source && onSubmit(source)}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * Regenerate: writes a new CV from the chosen source (the current one by
 * default). Nothing from the current CV carries over.
 */
function RegenerateDialog({
  disabled,
  busy,
  initial,
  onSubmit,
}: {
  disabled: boolean
  busy: boolean
  initial?: { type: "cv"; cvId: string } | { type: "generate" }
  onSubmit: (source: CvSource) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [source, setSource] = React.useState<CvSource | null>(null)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          title={disabled ? "Save your edits first" : undefined}
        >
          <RefreshCw className="mr-1 size-3.5" />
          Regenerate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Regenerate this job&apos;s CV</DialogTitle>
          <DialogDescription>
            A new CV is written from the source below. It replaces the current
            one, including your edits and approved stretches.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <CvSourcePicker
            initial={initial}
            onChange={setSource}
            disabled={busy}
          />
        )}
        <DialogFooter>
          <Button
            disabled={!source || busy}
            onClick={() => {
              if (!source) return
              onSubmit(source)
              setOpen(false)
            }}
          >
            Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
