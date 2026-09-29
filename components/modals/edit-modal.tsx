"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  InterviewFormSchema,
  type Interview,
  type InterviewFormValues,
} from "@/lib/validations/interview"
import { useUpdateInterview } from "@/hooks/api/interview/useUpdateInterview"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"
import {
  InterviewFormFields,
  toDateTimeLocal,
  toInterviewRequest,
} from "@/components/interviews/interview-form-fields"

type EditProps = {
  interview: Interview
  onDone: () => void
}

export default function EditDialog({ interview, onDone }: EditProps) {
  const { mutate: updateInterview, isPending } = useUpdateInterview()

  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(InterviewFormSchema),
    defaultValues: {
      name: interview.name,
      companyName: interview.companyName ?? "",
      jobTitle: interview.jobTitle ?? "",
      scheduledAt: toDateTimeLocal(interview.scheduledAt),
      notes: interview.notes ?? "",
    },
  })

  function onSubmit(values: InterviewFormValues) {
    updateInterview(
      { id: interview.id, ...toInterviewRequest(values) },
      {
        onSuccess: onDone,
        onError: () => {
          toast({
            title: "Something went wrong.",
            description: "The interview was not updated. Please try again.",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit interview</DialogTitle>
        <DialogDescription>
          Changes apply to the next session you start.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <InterviewFormFields control={form.control} />
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Icons.spinner className="mr-2 size-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
