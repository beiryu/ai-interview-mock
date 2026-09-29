"use client"

import type { Control } from "react-hook-form"

import type { InterviewFormValues } from "@/lib/validations/interview"
import {
  FormControl,
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
    </>
  )
}
