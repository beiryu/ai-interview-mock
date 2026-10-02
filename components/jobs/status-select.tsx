"use client"

import { cn } from "@/lib/utils"
import {
  JOB_STATUSES,
  JOB_STATUS_LABEL,
  type JobStatus,
} from "@/lib/validations/job"
import { useUpdateJob } from "@/hooks/api/job/useJobs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

const TONE: Record<JobStatus, string> = {
  SAVED: "text-muted-foreground",
  APPLIED: "text-blue-700 dark:text-blue-300",
  INTERVIEWING: "text-violet-700 dark:text-violet-300",
  OFFER: "text-green-700 dark:text-green-300",
  REJECTED: "text-red-700 dark:text-red-300",
  ARCHIVED: "text-muted-foreground",
}

/** Where an application stands, changed in place. */
export function StatusSelect({
  jobId,
  status,
  className,
}: {
  jobId: string
  status: JobStatus
  className?: string
}) {
  const update = useUpdateJob()
  return (
    <Select
      value={status}
      disabled={update.isPending}
      onValueChange={(value) =>
        update.mutate(
          { id: jobId, status: value as JobStatus },
          {
            onError: () =>
              toast({ title: "Could not update", variant: "destructive" }),
          }
        )
      }
    >
      <SelectTrigger
        className={cn("h-8 w-[140px] text-sm", TONE[status], className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {JOB_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className={TONE[s]}>
            {JOB_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
