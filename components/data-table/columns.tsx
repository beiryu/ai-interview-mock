"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Play,
  RefreshCw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { jobName, type Job } from "@/lib/validations/job"
import { useStartJobPrep } from "@/hooks/api/job/useJobs"
import { Button, buttonVariants } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"
import {
  ScheduleDialog,
  formatInterviewTime,
} from "@/components/jobs/schedule-dialog"
import { StatusSelect } from "@/components/jobs/status-select"

import { DataTableColumnHeader } from "./data-table-column-header"
import { DataTableRowActions } from "./data-table-row-actions"

const muted = <span className="text-muted-foreground">—</span>

function cvLabel(cv: Job["cv"]) {
  if (!cv) return "Tailor CV"
  if (cv.status === "pending") return "Writing…"
  if (cv.status === "failed") return "CV failed"
  if (cv.pending > 0) return `${cv.pending} to approve`
  return "CV ready"
}

export const columns: ColumnDef<Job>[] = [
  {
    id: "name",
    accessorFn: (job) => jobName(job),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Job" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/dashboard/jobs/${row.original.id}`}
        className="block max-w-[360px] truncate font-medium underline-offset-4 hover:underline"
      >
        {row.original.company || "Unknown company"}
        <span className="block truncate text-xs font-normal text-muted-foreground">
          {row.original.title || "Untitled role"}
        </span>
      </Link>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <StatusSelect jobId={row.original.id} status={row.original.status} />
    ),
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
  },
  {
    id: "cv",
    header: "CV",
    cell: ({ row }) => {
      const cv = row.original.cv
      return (
        <Link
          href={`/dashboard/jobs/${row.original.id}?tab=cv`}
          title="The CV for this job, built from your documents"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-2",
            cv &&
              (cv.status === "failed" || cv.pending > 0) &&
              "border-amber-500/60 text-amber-700 dark:text-amber-300"
          )}
        >
          <FileText className="size-4" />
          {cvLabel(cv)}
        </Link>
      )
    },
    enableSorting: false,
  },
  {
    id: "prep",
    header: "Prep",
    cell: ({ row }) => <PrepCell job={row.original} />,
    enableSorting: false,
  },
  {
    accessorKey: "scheduledAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Interview" />
    ),
    cell: ({ row }) => {
      const job = row.original
      return job.scheduledAt ? (
        <ScheduleDialog
          job={job}
          trigger={
            <button className="text-sm underline-offset-4 hover:underline">
              {formatInterviewTime(job.scheduledAt)}
            </button>
          }
        />
      ) : (
        <ScheduleDialog
          job={job}
          trigger={
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <CalendarClock className="size-3.5" />
              Schedule
            </Button>
          }
        />
      )
    },
    sortingFn: "datetime",
  },
  {
    id: "sessions",
    accessorFn: (job) => job._count?.sessions ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sessions" />
    ),
    cell: ({ row }) => {
      const count = row.original._count?.sessions ?? 0
      if (count === 0) return muted
      return (
        <Link
          href={`/dashboard/jobs/${row.original.id}?tab=sessions`}
          className="underline-offset-4 hover:underline"
        >
          {count}
        </Link>
      )
    },
  },
  {
    id: "launch",
    cell: ({ row }) => (
      <Link
        href={`/dashboard/jobs/${row.original.id}/live`}
        title="Open the live copilot for this interview"
        className={cn(
          buttonVariants({
            variant: row.original.scheduledAt ? "secondary" : "ghost",
            size: "sm",
          }),
          "gap-2"
        )}
      >
        <Play className="size-4" />
        Launch
      </Link>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    enableHiding: false,
  },
]

/**
 * The job's prep at a glance, styled like the CV column: Prep ready opens
 * it; Out of date (the JD or the CV changed) and Failed rerun it in place;
 * Prepare starts it.
 */
function PrepCell({ job }: { job: Job }) {
  const start = useStartJobPrep()
  const status = start.isPending ? "pending" : job.prep ?? "missing"
  const outline = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "gap-2"
  )
  const attention = "border-amber-500/60 text-amber-700 dark:text-amber-300"

  if (!job.cv) return muted
  if (status === "ready") {
    return (
      <Link
        href={`/dashboard/jobs/${job.id}?tab=prep`}
        title="Open the prep for this interview"
        className={outline}
      >
        <ClipboardList className="size-4" />
        Prep ready
      </Link>
    )
  }
  if (status === "pending") {
    return (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <Icons.spinner className="size-4 animate-spin" />
        Preparing…
      </Button>
    )
  }
  return (
    <Button
      variant="outline"
      size="sm"
      title={
        status === "stale"
          ? "The job description or the CV changed: regenerate the prep"
          : status === "failed"
          ? "Try again"
          : "Prepare for this interview"
      }
      className={cn("gap-2", status !== "missing" && attention)}
      onClick={() =>
        start.mutate(job.id, {
          onError: (error: Error) =>
            toast({
              title: "Couldn't start the prep",
              description: error.message,
              variant: "destructive",
            }),
        })
      }
    >
      {status === "missing" ? (
        <ClipboardList className="size-4" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      {status === "stale"
        ? "Out of date"
        : status === "failed"
        ? "Prep failed"
        : "Prepare"}
    </Button>
  )
}
