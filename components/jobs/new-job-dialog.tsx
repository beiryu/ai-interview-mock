"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Upload } from "lucide-react"

import { useExtractDocument } from "@/hooks/api/document/useUploadDocument"
import { useCreateJob } from "@/hooks/api/job/useJobs"
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
import { Icons } from "@/components/icons"

const MIN_JD_CHARS = 50

/**
 * A job starts from its description: paste it (or drop the PDF/DOCX). The
 * company and title are read from it, and the CV for it starts at once.
 */
export function NewJobDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [jdText, setJdText] = React.useState("")
  const [sourceUrl, setSourceUrl] = React.useState("")
  const [company, setCompany] = React.useState("")
  const [title, setTitle] = React.useState("")
  const create = useCreateJob()
  const extract = useExtractDocument()
  const fileInput = React.useRef<HTMLInputElement>(null)

  const reset = () => {
    setJdText("")
    setSourceUrl("")
    setCompany("")
    setTitle("")
    extract.reset()
  }

  const readFile = (file: File) =>
    extract.mutate(file, {
      onSuccess: ({ content }) => setJdText(content),
      onError: (error: Error) =>
        toast({
          title: "Couldn't read the file",
          description: error.message,
          variant: "destructive",
        }),
    })

  const submit = () =>
    create.mutate(
      {
        jdText,
        sourceUrl: sourceUrl.trim() || undefined,
        company: company.trim() || undefined,
        title: title.trim() || undefined,
      },
      {
        onSuccess: (job) => {
          setOpen(false)
          reset()
          router.push(`/dashboard/jobs/${job.id}?tab=cv`)
        },
        onError: (error: Error) =>
          toast({
            title: "Couldn't create the job",
            description: error.message,
            variant: "destructive",
          }),
      }
    )

  const busy = create.isPending || extract.isPending
  const tooShort = jdText.trim().length < MIN_JD_CHARS

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          New job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>New job</DialogTitle>
          <DialogDescription>
            Paste the job description. A CV tailored to it starts right away,
            built only from your documents.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="jd-text">Job description</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {extract.isPending ? (
                  <Icons.spinner className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                From a PDF/DOCX
              </Button>
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
              id="jd-text"
              value={jdText}
              disabled={busy}
              placeholder="Paste the whole posting: requirements, stack, benefits…"
              className="min-h-[240px] text-sm"
              onChange={(e) => setJdText(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="jd-url">Link (optional)</Label>
            <Input
              id="jd-url"
              value={sourceUrl}
              disabled={busy}
              placeholder="https://…"
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="jd-company">Company</Label>
              <Input
                id="jd-company"
                value={company}
                disabled={busy}
                placeholder="Read from the JD if blank"
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="jd-title">Role</Label>
              <Input
                id="jd-title"
                value={title}
                disabled={busy}
                placeholder="Read from the JD if blank"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={busy || tooShort} onClick={submit}>
            {create.isPending && (
              <Icons.spinner className="mr-2 size-4 animate-spin" />
            )}
            Create and tailor CV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
