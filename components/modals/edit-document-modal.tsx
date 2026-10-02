"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  DOCUMENT_TYPE_OPTIONS,
  Document,
  UpdateDocumentRequestSchema,
} from "@/lib/validations/document"
import { useUpdateDocument } from "@/hooks/api/document/useUpdateDocument"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"

type EditDocumentProps = {
  document: Document
  onClose?: () => void
}

const EditDocumentFormSchema = UpdateDocumentRequestSchema

export default function EditDocumentDialog({
  document,
  onClose,
}: EditDocumentProps) {
  const { mutate: updateDocument, isPending } = useUpdateDocument()

  const form = useForm({
    resolver: zodResolver(EditDocumentFormSchema),
    defaultValues: {
      title: document.title,
      content: document.content,
      type: document.type,
    },
  })

  function onSubmit(values: z.infer<typeof EditDocumentFormSchema>) {
    // Type matters: job descriptions feed the interview prep, the rest the
    // profile prep
    updateDocument(
      { id: document.id, data: values },
      {
        onSuccess: () => {
          toast({
            title: "Document updated",
            description: "Document details updated successfully",
          })
          onClose?.()
        },
        onError: (error: Error) => {
          return toast({
            title: "Couldn't update the document",
            description: error.message,
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Document</DialogTitle>
        <DialogDescription>
          Update your document details and content below.
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
                  A descriptive title for your document (e.g., Software Engineer
                  Resume, Google SWE Job Description)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Document content..."
                    className="min-h-[200px]"
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormDescription>
                  The full text content of your document.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Icons.spinner className="mr-2 size-4 animate-spin" />
              )}
              {isPending ? "Updating..." : "Update Document"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
