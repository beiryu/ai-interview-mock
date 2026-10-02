"use client"

import { Document } from "@/lib/validations/document"
import { useDeleteDocument } from "@/hooks/api/document/useDeleteDocument"
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
import { toast } from "@/components/ui/use-toast"

type DeleteDocumentProps = {
  document: Document
  isOpen: boolean
  showActionToggle: (open: boolean) => void
}

export default function DeleteDocumentDialog({
  document,
  isOpen,
  showActionToggle,
}: DeleteDocumentProps) {
  const { mutate: deleteDocument, isPending } = useDeleteDocument()

  const handleDelete = () => {
    deleteDocument(document.id, {
      onSuccess: () => {
        showActionToggle(false)
        toast({
          title: "Document deleted",
          description: "Document has been successfully deleted",
        })
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete document. Please try again.",
          variant: "destructive",
        })
      },
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={showActionToggle}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. You are about to delete the document{" "}
            <strong>&ldquo;{document.title}&rdquo;</strong>. All associated data
            and chunks will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
