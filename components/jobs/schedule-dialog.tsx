"use client"

import * as React from "react"
import { CalendarClock } from "lucide-react"

import type { Job } from "@/lib/validations/job"
import { useUpdateJob } from "@/hooks/api/job/useJobs"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"

/** ISO string -> value for <input type="datetime-local"> (local time). */
function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return ""
  const date = new Date(iso)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function formatInterviewTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/**
 * You were invited: when the interview is, and notes for the coach (who
 * interviews you, which round, what they said to prepare).
 */
export function ScheduleDialog({
  job,
  trigger,
}: {
  job: Pick<Job, "id" | "scheduledAt" | "notes">
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [when, setWhen] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const update = useUpdateJob()

  const onOpenChange = (next: boolean) => {
    if (next) {
      setWhen(toDateTimeLocal(job.scheduledAt))
      setNotes(job.notes ?? "")
    }
    setOpen(next)
  }

  const save = (scheduledAt: string) =>
    update.mutate(
      { id: job.id, scheduledAt, notes },
      {
        onSuccess: () => setOpen(false),
        onError: () =>
          toast({ title: "Could not save", variant: "destructive" }),
      }
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarClock className="size-4" />
            {job.scheduledAt ? "Reschedule" : "Schedule interview"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {job.scheduledAt ? "Interview time" : "Schedule the interview"}
          </DialogTitle>
          <DialogDescription>
            The job moves to Interviewing. On the day, Launch opens the live
            copilot with this job&apos;s CV and prep.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="scheduled-at">Date and time</Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="interview-notes">Notes for the coach</Label>
            <Textarea
              id="interview-notes"
              value={notes}
              placeholder="Who interviews you, which round, what they asked you to prepare…"
              className="min-h-24"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {job.scheduledAt && (
            <Button
              variant="ghost"
              disabled={update.isPending}
              onClick={() => save("")}
            >
              Clear time
            </Button>
          )}
          <Button
            disabled={!when || update.isPending}
            // datetime-local has no timezone: convert in the browser
            onClick={() => save(new Date(when).toISOString())}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
