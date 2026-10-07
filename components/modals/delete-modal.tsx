"use client"

import { jobName, type Job } from "@/lib/validations/job"
import { useDeleteJob } from "@/hooks/api/job/useJobs"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type DeleteProps = {
  job: Job
  isOpen: boolean
  showActionToggle: (open: boolean) => void
}

export default function DeleteDialog({
  job,
  isOpen,
  showActionToggle,
}: DeleteProps) {
  const { mutate: deleteJob } = useDeleteJob()

  return (
    <AlertDialog open={isOpen} onOpenChange={showActionToggle}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this job?</AlertDialogTitle>
          <AlertDialogDescription>
            <b>{jobName(job)}</b> with its CV, prep and saved sessions will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              showActionToggle(false)
              deleteJob(job.id)
            }}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
