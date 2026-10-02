"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  InterviewFormSchema,
  type InterviewFormValues,
} from "@/lib/validations/interview"
import useCreateInterview from "@/hooks/api/interview/useCreateInterview"
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
import { Form } from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"
import {
  InterviewFormFields,
  toInterviewRequest,
} from "@/components/interviews/interview-form-fields"

const EMPTY: InterviewFormValues = {
  name: "",
  companyName: "",
  jobTitle: "",
  scheduledAt: "",
  notes: "",
  documentIds: [],
}

export function CreateInterviewDialog() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { mutate: createInterview, isPending } = useCreateInterview()

  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(InterviewFormSchema),
    defaultValues: EMPTY,
  })

  function onSubmit(values: InterviewFormValues) {
    createInterview(toInterviewRequest(values), {
      onSuccess: (interview) => {
        setOpen(false)
        form.reset(EMPTY)
        router.push(`/dashboard/interviews/${interview.id}`)
      },
      onError: () => {
        toast({
          title: "Something went wrong.",
          description: "The interview was not created. Please try again.",
          variant: "destructive",
        })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Icons.add className="mr-2 size-4" />
          New interview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New interview</DialogTitle>
          <DialogDescription>
            Company, role, notes and the documents you pick are what the answer
            coach knows about you.
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
                Create &amp; open
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
