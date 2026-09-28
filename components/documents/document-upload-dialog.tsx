"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FileUploadResult, handleFileUpload } from "@/lib/file-upload"
import {
  CreateDocumentRequest,
  CreateDocumentRequestSchema,
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
import { Progress } from "@/components/ui/progress"
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

const documentTypes = [
  {
    value: "RESUME",
    label: "Resume",
    description: "Your professional background and experience",
  },
  {
    value: "JOB_DESCRIPTION",
    label: "Job Description",
    description: "Target position details and requirements",
  },
  {
    value: "PORTFOLIO",
    label: "Portfolio",
    description: "Projects, accomplishments, and work samples",
  },
  {
    value: "COVER_LETTER",
    label: "Cover Letter",
    description: "Personalized cover letter for specific roles",
  },
  {
    value: "NOTES",
    label: "Notes",
    description: "Custom talking points and personal insights",
  },
] as const

type ProcessingStage =
  | "uploading"
  | "processing"
  | "chunking"
  | "embedding"
  | "indexing"
  | "complete"

const processingStages: Record<
  ProcessingStage,
  { label: string; progress: number }
> = {
  uploading: { label: "Uploading document...", progress: 20 },
  processing: { label: "Processing document content...", progress: 40 },
  chunking: { label: "Creating document chunks for RAG...", progress: 60 },
  embedding: { label: "Generating embeddings...", progress: 80 },
  indexing: { label: "Indexing in vector store...", progress: 90 },
  complete: { label: "Document ready for RAG queries!", progress: 100 },
}

export function DocumentUploadDialog() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [uploadMethod, setUploadMethod] = useState<"text" | "file">("text")
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

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
    setProcessingStage(null)
    setUploadProgress(0)
    setUploadMethod("text")
  }

  const simulateProcessingStages = async () => {
    const stages: ProcessingStage[] = [
      "uploading",
      "processing",
      "chunking",
      "embedding",
      "indexing",
      "complete",
    ]

    for (const stage of stages) {
      setProcessingStage(stage)
      setUploadProgress(processingStages[stage].progress)
      // Add small delays to simulate processing steps
      if (stage !== "complete") {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }

  const { mutate: uploadDocument, isPending } = useUploadDocument()

  const onSubmit = async (data: CreateDocumentRequest) => {
    setProcessingStage("uploading")

    try {
      // Start processing animation
      const processingPromise = simulateProcessingStages()

      uploadDocument(data, {
        onSuccess: () => {
          setIsOpen(false)
          resetForm()
          toast({
            title: "Document processed successfully",
            description: `Your ${documentTypes
              .find((t) => t.value === data.type)
              ?.label.toLowerCase()} has been processed and indexed for queries.`,
          })
          router.refresh()
        },
        onError: (error: any) => {
          setProcessingStage(null)
          setUploadProgress(0)

          toast({
            title: "Upload failed",
            description:
              error instanceof Error
                ? error.message
                : "Something went wrong. Please try again.",
            variant: "destructive",
          })
        },
      })

      // Wait for processing animation to complete
      await processingPromise
    } catch (error) {
      console.error("Error uploading document:", error)
    }
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
        <Button variant="default" effect="gooeyRight">
          <Icons.add className="mr-2 size-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a new document to your knowledge base for enhanced search and
            question answering capabilities.
          </DialogDescription>
        </DialogHeader>

        {processingStage && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center space-x-3">
              <Icons.spinner className="size-4 animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {processingStages[processingStage].label}
                </p>
                <Progress value={uploadProgress} className="mt-2" />
              </div>
            </div>
          </div>
        )}

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
                      {documentTypes.map((type) => (
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
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Icons.post className="mx-auto size-12 text-gray-400" />
                    <div className="mt-4">
                      <label
                        htmlFor="file-upload"
                        className={`cursor-pointer ${
                          isPending ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Click to upload a file
                        </span>
                        <span className="mt-1 block text-sm text-gray-500">
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
                  {form.watch("content") && (
                    <div className="mt-4">
                      <FormLabel>Extracted Content Preview</FormLabel>
                      <Textarea
                        value={form.watch("content")}
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
                {isPending ? "Processing document..." : "Upload Document"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
