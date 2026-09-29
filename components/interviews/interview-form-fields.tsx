"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import type { Control } from "react-hook-form"

import type { InterviewFormValues } from "@/lib/validations/interview"
import { DOCUMENT_TYPE_OPTIONS } from "@/lib/validations/document"
import { cn } from "@/lib/utils"
import { useGetDocuments } from "@/hooks/api/document/useGetDocuments"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** ISO string -> value for <input type="datetime-local"> (local time). */
export function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return ""
  const date = new Date(iso)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

/**
 * Form values -> request body. datetime-local has no timezone, so convert it
 * to ISO in the browser (the server's timezone may differ).
 */
export function toInterviewRequest(values: InterviewFormValues) {
  return {
    ...values,
    scheduledAt: values.scheduledAt
      ? new Date(values.scheduledAt).toISOString()
      : "",
  }
}

export function InterviewFormFields({
  control,
}: {
  control: Control<InterviewFormValues>
}) {
  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g. Acme — technical round" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company</FormLabel>
              <FormControl>
                <Input placeholder="Acme" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <Input placeholder="Senior Backend Engineer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="scheduledAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Scheduled</FormLabel>
            <FormControl>
              <Input type="datetime-local" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Interviewers, format, what to emphasize… (the answer coach sees this)"
                className="min-h-24"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="documentIds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Documents for the coach</FormLabel>
            <DocumentPicker
              value={field.value ?? []}
              onChange={field.onChange}
            />
            <FormDescription>
              Read in full on every answer: pick your CV and this job&apos;s
              description.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

const TYPE_LABEL = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.map((option) => [option.value, option.label])
)

function DocumentPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const { documents, isLoading } = useGetDocuments()

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading documents…</p>
  }
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No documents yet —{" "}
        <Link href="/dashboard/documents" className="underline">
          add your CV and the job description
        </Link>
        .
      </p>
    )
  }

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
      {documents.map((doc) => {
        const selected = value.includes(doc.id)
        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => toggle(doc.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
              selected ? "bg-primary/10" : "hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                selected && "border-primary bg-primary text-primary-foreground"
              )}
            >
              {selected && <Check className="size-3" />}
            </span>
            <span className="flex-1 truncate">{doc.title}</span>
            <span className="text-xs text-muted-foreground">
              {TYPE_LABEL[doc.type] ?? doc.type}
            </span>
          </button>
        )
      })}
    </div>
  )
}
