"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import { DocumentType } from "@/lib/generated/prisma/enums"
import {
  CreateDocumentRequest,
  CreateDocumentRequestSchema,
  DOCUMENT_TYPE_OPTIONS,
  MAX_DOCUMENT_CHARS,
} from "@/lib/validations/document"
import useUploadDocument, {
  useExtractDocument,
} from "@/hooks/api/document/useUploadDocument"
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"

const ACCEPT = ".pdf,.docx,.txt,.md"

// A PDF that yields almost no text is probably a scan without a text layer
const MIN_EXTRACTED_CHARS = 200

/** Pre-select a type from the file name; the user can still change it. */
function guessType(fileName: string): DocumentType | undefined {
  const name = fileName.toLowerCase()
  if (/(^|[^a-z])(cv|resume)([^a-z]|$)/.test(name)) return DocumentType.RESUME
  if (/(^|[^a-z])(jd|job)([^a-z]|$)/.test(name)) {
    return DocumentType.JOB_DESCRIPTION
  }
  return undefined
}

export function DocumentUploadDialog() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [uploadMethod, setUploadMethod] = useState<"text" | "file">("text")

  const form = useForm({
    resolver: zodResolver(CreateDocumentRequestSchema),
    defaultValues: {
      title: "",
      type: undefined,
      content: "",
    },
  })

  const resetForm = () => {
    form.reset({
      title: "",
      type: undefined,
      content: "",
    })
    setUploadMethod("text")
    setFileName(null)
    extract.reset()
  }

  const { mutate: uploadDocument, isPending } = useUploadDocument()
  const extract = useExtractDocument()
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const content = useWatch({ control: form.control, name: "content" })

  const onSubmit = (data: CreateDocumentRequest) => {
    uploadDocument(data, {
      onSuccess: () => {
        setIsOpen(false)
        resetForm()
        toast({
          title: "Document saved",
          description:
            data.type === DocumentType.JOB_DESCRIPTION
              ? "Pick it on an interview to use it in that interview's prep."
              : "Re-run Profile prep so the coach uses it.",
        })
        router.refresh()
      },
      onError: (error: Error) => {
        toast({
          title: "Couldn't save the document",
          description:
            error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        })
      },
    })
  }

  const readFile = (file: File) => {
    setFileName(file.name)
    extract.mutate(file, {
      onSuccess: ({ title, content }) => {
        form.setValue("content", content, { shouldValidate: true })
        if (!form.getValues("title")) form.setValue("title", title)
        const type = guessType(file.name)
        if (type && !form.getValues("type")) form.setValue("type", type)
      },
      onError: (error: Error) => {
        toast({
          title: "Couldn't read the file",
          description: error.message,
          variant: "destructive",
        })
      },
    })
  }

  const busy = isPending || extract.isPending
  const tooLittleText =
    fileName?.toLowerCase().endsWith(".pdf") &&
    extract.isSuccess &&
    (content?.length ?? 0) < MIN_EXTRACTED_CHARS

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Icons.add className="size-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Your documents feed the profile prep and the answer coach. Job
            descriptions are used per interview.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={busy}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-row gap-1 cursor-pointer">
                            <div className="font-medium">{type.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {type.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter document title"
                      {...field}
                      disabled={busy}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive title for your document (e.g., Software
                    Engineer Resume, Google SWE Job Description)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Content</FormLabel>
              <Tabs
                value={uploadMethod}
                onValueChange={(value) =>
                  setUploadMethod(value as "text" | "file")
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" disabled={busy}>
                    Paste Text
                  </TabsTrigger>
                  <TabsTrigger value="file" disabled={busy}>
                    Upload File
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Paste your document content here..."
                            className="min-h-[200px]"
                            {...field}
                            disabled={busy}
                          />
                        </FormControl>
                        <FormDescription>
                          Copy and paste the text content of your document.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="file" className="space-y-4">
                  <label
                    htmlFor="file-upload"
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragging(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file && !busy) readFile(file)
                    }}
                    className={`block cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                      dragging ? "border-primary bg-primary/5" : "border-input"
                    } ${busy ? "pointer-events-none opacity-60" : ""}`}
                  >
                    {extract.isPending ? (
                      <Icons.spinner className="mx-auto size-10 animate-spin text-muted-foreground" />
                    ) : (
                      <Icons.post className="mx-auto size-10 text-muted-foreground" />
                    )}
                    <span className="mt-3 block text-sm font-medium">
                      {extract.isPending
                        ? `Reading ${fileName}…`
                        : fileName ?? "Click or drop a file"}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      PDF, DOCX, TXT or MD up to 10 MB
                    </span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept={ACCEPT}
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readFile(file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                  {tooLittleText && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      This PDF has almost no text (probably a scan) — paste the
                      text instead.
                    </p>
                  )}
                  {content && (
                    <div>
                      <div className="flex items-baseline justify-between">
                        <FormLabel>Text to save (you can edit it)</FormLabel>
                        <span className="text-xs text-muted-foreground">
                          {content.length.toLocaleString()} /{" "}
                          {MAX_DOCUMENT_CHARS.toLocaleString()} chars
                        </span>
                      </div>
                      <Textarea
                        value={content}
                        onChange={(e) =>
                          form.setValue("content", e.target.value, {
                            shouldValidate: true,
                          })
                        }
                        className="mt-2 min-h-[160px]"
                        disabled={busy}
                      />
                      <FormMessage>
                        {form.formState.errors.content?.message}
                      </FormMessage>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {isPending && (
                  <Icons.spinner className="mr-2 size-4 animate-spin" />
                )}
                {isPending ? "Saving…" : "Save document"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
