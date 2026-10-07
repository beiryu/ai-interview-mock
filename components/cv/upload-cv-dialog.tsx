"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"

import type { CvSource } from "@/lib/validations/job"
import { useUploadCv } from "@/hooks/api/cv/useCvs"
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
import { toast } from "@/components/ui/use-toast"

import { CvSourcePicker } from "./cv-source-picker"

/** Upload one of your CVs (a job can then start from it). */
export function UploadCvDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [source, setSource] = React.useState<CvSource | null>(null)
  const upload = useUploadCv()

  const submit = () =>
    source?.type === "upload" &&
    upload.mutate(
      { title: source.title, rawText: source.rawText },
      {
        onSuccess: ({ id }) => {
          setOpen(false)
          router.push(`/dashboard/cvs/${id}`)
        },
        onError: (error: Error) =>
          toast({
            title: "Couldn't upload the CV",
            description: error.message,
            variant: "destructive",
          }),
      }
    )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="size-4" />
          Upload CV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Upload a CV</DialogTitle>
          <DialogDescription>
            Your real CV, as you wrote it. Jobs refine it for their description;
            it is read into sections in about 20 seconds.
          </DialogDescription>
        </DialogHeader>
        <CvSourcePicker
          uploadOnly
          onChange={setSource}
          disabled={upload.isPending}
        />
        <DialogFooter>
          <Button
            disabled={source?.type !== "upload" || upload.isPending}
            onClick={submit}
          >
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
