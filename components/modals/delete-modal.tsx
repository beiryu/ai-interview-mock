"use client"

import { Interview } from "@/lib/validations/interview"
import { useDeleteInterview } from "@/hooks/api/interview/useDeleteInterview"
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
  interview: Interview
  isOpen: boolean
  showActionToggle: (open: boolean) => void
}

export default function DeleteDialog({
  interview,
  isOpen,
  showActionToggle,
}: DeleteProps) {
  const { mutate: deleteInterview } = useDeleteInterview()

  return (
    <AlertDialog open={isOpen} onOpenChange={showActionToggle}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this interview?</AlertDialogTitle>
          <AlertDialogDescription>
            <b>{interview.name}</b> and all of its saved sessions will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              showActionToggle(false)
              deleteInterview(interview.id)
            }}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
