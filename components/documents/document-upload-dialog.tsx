"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import { FileUploadResult, handleFileUpload } from "@/lib/file-upload"
import {
  CreateDocumentRequest,
  CreateDocumentRequestSchema,
  DOCUMENT_TYPE_OPTIONS,
} from "@/lib/validations/document"
import useUploadDocument from "@/hooks/api/document/useUploadDocument"
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
  }

  const { mutate: uploadDocument, isPending } = useUploadDocument()

  const content = useWatch({ control: form.control, name: "content" })

  const onSubmit = (data: CreateDocumentRequest) => {
    uploadDocument(data, {
      onSuccess: () => {
        setIsOpen(false)
        resetForm()
        toast({
          title: "Document uploaded",
          description: `Your ${DOCUMENT_TYPE_OPTIONS.find(
            (t) => t.value === data.type
          )?.label.toLowerCase()} is indexed and available to the answer coach.`,
        })
        router.refresh()
      },
      onError: (error: Error) => {
        toast({
          title: "Upload failed",
          description:
            error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        })
      },
    })
  }

  const handleFileUploadEvent = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    await handleFileUpload(
      file,
      (result: FileUploadResult) => {
        if (result.content && result.title) {
          form.setValue("content", result.content)
          form.setValue("title", result.title)
        } else if (result.title) {
          form.setValue("title", result.title)
        }
      },
      (error: string) => {
        // Error handling is done in the utility function
        console.error("File upload error:", error)
      }
    )

    event.target.value = ""
  }

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
                    defaultValue={field.value}
                    disabled={isPending}
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
                      disabled={isPending}
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
                  <TabsTrigger value="text" disabled={isPending}>
                    Paste Text
                  </TabsTrigger>
                  <TabsTrigger value="file" disabled={isPending}>
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
                            disabled={isPending}
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
                  <div className="rounded-lg border-2 border-dashed border-input p-6 text-center">
                    <Icons.post className="mx-auto size-12 text-muted-foreground" />
                    <div className="mt-4">
                      <label
                        htmlFor="file-upload"
                        className={`cursor-pointer ${
                          isPending ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        <span className="mt-2 block text-sm font-medium">
                          Click to upload a file
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Plain text (TXT) files up to 10MB
                        </span>
                      </label>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".txt"
                        onChange={handleFileUploadEvent}
                        disabled={isPending}
                      />
                    </div>
                  </div>
                  {content && (
                    <div className="mt-4">
                      <FormLabel>Extracted Content Preview</FormLabel>
                      <Textarea
                        value={content}
                        onChange={(e) =>
                          form.setValue("content", e.target.value)
                        }
                        className="mt-2 min-h-[100px]"
                        placeholder="File content will appear here..."
                        disabled={isPending}
                      />
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
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Icons.spinner className="mr-2 size-4 animate-spin" />
                )}
                {isPending ? "Uploading & indexing…" : "Upload Document"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
