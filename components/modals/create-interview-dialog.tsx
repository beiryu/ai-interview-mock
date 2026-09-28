"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  CreateInterviewRequest,
  CreateInterviewRequestSchema,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"

export function CreateInterviewDialog() {
  const [open, setOpen] = React.useState(false)

  const router = useRouter()

  const { mutate: createInterview, isPending } = useCreateInterview()

  const form = useForm({
    resolver: zodResolver(CreateInterviewRequestSchema),
    defaultValues: {
      name: "",
      type: "live",
      status: "in-progress",
      priority: "high",
      dueDate: new Date().toISOString(),
      jobTitle: "",
      companyName: "",
    },
  })

  function onSubmit(data: CreateInterviewRequest) {
    createInterview(data, {
      onSuccess: (interview) => {
        setOpen(false)

        router.refresh()
        router.push(`/dashboard/interviews/${interview.id}`)
      },
      onError: (error: any) => {
        if (error.status === 422) {
          return toast({
            title: "Limit of 3 posts reached.",
            description: "Please upgrade to the PRO plan.",
            variant: "destructive",
          })
        }
        return toast({
          title: "Something went wrong.",
          description: "Your post was not created. Please try again.",
          variant: "destructive",
        })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" effect="gooeyRight">
          <Icons.add className="mr-2 size-4" />
          New Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <DialogDescription>
            Give your session a name to get started.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Google SWE round 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button effect="gooeyRight" type="submit" disabled={isPending}>
                {isPending && (
                  <Icons.spinner className="mr-2 size-4 animate-spin" />
                )}
                Start
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
