"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CalendarClock, ExternalLink, Play } from "lucide-react"

import {
  ANSWER_LABELS,
  AnswersSchema,
  type AnswerField,
} from "@/lib/prep/schema"
import { cn } from "@/lib/utils"
import type { UpdateJobRequest } from "@/lib/validations/job"
import { useJobCv } from "@/hooks/api/cv/useCvs"
import {
  useGetJob,
  useUpdateJob,
  type JobWithSessions,
} from "@/hooks/api/job/useJobs"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { JobCvTab } from "@/components/cv/job-cv-tab"
import { Section, TextField } from "@/components/prep/fields"
import { JobPrepPanel } from "@/components/prep/interview-prep-sheet"

import { ScheduleDialog, formatInterviewTime } from "./schedule-dialog"
import { SessionsPanel } from "./sessions-panel"
import { StatusSelect } from "./status-select"

// In the order you work on a job: its description, the CV you send, the
// prep once invited, the sessions after the interview
const TABS = ["jd", "cv", "prep", "sessions"] as const
type Tab = (typeof TABS)[number]

/**
 * One job: the CV you send for it, the prep for its interview, its
 * description, and the sessions once you've interviewed. The tab lives in
 * the URL (?tab=cv) so links can point at it.
 */
export function JobPage({ jobId, tab }: { jobId: string; tab?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: job, isLoading, isError } = useGetJob(jobId)
  const cv = useJobCv(jobId)

  if (isError) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        This job doesn&apos;t exist anymore.{" "}
        <Link href="/dashboard/jobs" className="underline">
          Back to Jobs
        </Link>
      </Card>
    )
  }
  if (isLoading || !job) return <Skeleton className="h-96 w-full" />

  const pending = cv.data?.pending ?? 0
  const current: Tab = TABS.includes(tab as Tab)
    ? (tab as Tab)
    : defaultTab(job)

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate font-heading text-3xl md:text-4xl">
            {job.company || "Unknown company"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {job.title || "Untitled role"}
          </p>
          {job.sourceUrl && (
            <div className="pt-1 text-sm">
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Job posting
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusSelect
            jobId={job.id}
            status={job.status}
            className="h-10 w-[150px]"
          />
          <ScheduleDialog
            job={job}
            trigger={
              <Button variant="outline" className="gap-2">
                <CalendarClock className="size-4" />
                {job.scheduledAt
                  ? formatInterviewTime(job.scheduledAt)
                  : "Schedule interview"}
              </Button>
            }
          />
          <Link
            href={`/dashboard/jobs/${job.id}/live`}
            className={cn(
              buttonVariants({
                variant: job.scheduledAt ? "default" : "secondary",
              }),
              "gap-2"
            )}
          >
            <Play className="size-4" />
            Launch interview
          </Link>
        </div>
      </header>

      <Tabs
        value={current}
        onValueChange={(next) =>
          router.replace(`${pathname}?tab=${next}`, { scroll: false })
        }
      >
        <TabsList>
          <TabsTrigger value="jd">Job description</TabsTrigger>
          <TabsTrigger value="cv">
            CV
            {pending > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                {pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="prep">Prep</TabsTrigger>
          <TabsTrigger value="sessions">
            Sessions
            {job.sessions.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {job.sessions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="jd" className="mt-5">
          <JobDetailsForm job={job} />
        </TabsContent>
        <TabsContent value="cv" className="mt-5">
          <JobCvTab jobId={job.id} />
        </TabsContent>
        <TabsContent value="prep" className="mt-5">
          <JobPrepPanel jobId={job.id} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-5">
          <SessionsPanel job={job} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Opens on what you're working on: the CV until you're invited, then the
 *  prep, then the sessions once it's over. */
function defaultTab(job: JobWithSessions): Tab {
  if (job.status === "INTERVIEWING") return "prep"
  if (
    (job.status === "OFFER" ||
      job.status === "REJECTED" ||
      job.status === "ARCHIVED") &&
    job.sessions.length > 0
  ) {
    return "sessions"
  }
  return "cv"
}

/** The JD, company, title, link and notes; the CV and prep build on them. */
function JobDetailsForm({ job }: { job: JobWithSessions }) {
  const update = useUpdateJob()
  const initial = React.useMemo(
    () => ({
      company: job.company,
      title: job.title,
      sourceUrl: job.sourceUrl ?? "",
      jdText: job.jdText,
      notes: job.notes ?? "",
      answers: AnswersSchema.parse(job.answers ?? {}),
    }),
    [job]
  )
  const [draft, setDraft] = React.useState(initial)
  const [source, setSource] = React.useState(initial)
  // Saved or refetched: take the server's values
  if (initial !== source) {
    setSource(initial)
    setDraft(initial)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const set = (patch: Partial<typeof draft>) =>
    setDraft((d) => ({ ...d, ...patch }))

  const save = () =>
    update.mutate(
      { id: job.id, ...(draft as UpdateJobRequest) },
      {
        onSuccess: () =>
          toast({
            title: "Saved",
            description:
              draft.jdText !== initial.jdText
                ? "The CV and prep are now out of date: Regenerate them when you're ready."
                : undefined,
          }),
        onError: (error: Error) =>
          toast({
            title: "Could not save",
            description: error.message,
            variant: "destructive",
          }),
      }
    )

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {dirty
            ? "Unsaved changes. Changing the JD or notes makes the CV and prep out of date."
            : "The CV and the prep are built from this description and your notes."}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || update.isPending}
            onClick={() => setDraft(initial)}
          >
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!dirty || update.isPending}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section
          title="Job description"
          description="As posted. Requirements, stack and benefits all help the CV and the prep."
        >
          <TextField
            label="Description"
            multiline
            className="[&_textarea]:min-h-[560px]"
            value={draft.jdText}
            onChange={(jdText) => set({ jdText })}
          />
        </Section>

        <div className="space-y-8">
          <Section title="Details">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Company"
                value={draft.company}
                onChange={(company) => set({ company })}
              />
              <TextField
                label="Role"
                value={draft.title}
                onChange={(title) => set({ title })}
              />
            </div>
            <TextField
              label="Link to the posting"
              value={draft.sourceUrl}
              placeholder="https://…"
              onChange={(sourceUrl) => set({ sourceUrl })}
            />
            <TextField
              label="Notes for the coach (who interviews you, the round, what to prepare)"
              multiline
              value={draft.notes}
              onChange={(notes) => set({ notes })}
            />
          </Section>

          <Section
            title="Your answers for this job"
            description="Only you know these. A new job starts with your latest job's answers; blank ones make the coach answer without stating a specific."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(ANSWER_LABELS) as AnswerField[]).map((key) => (
                <TextField
                  key={key}
                  label={ANSWER_LABELS[key]}
                  multiline
                  value={draft.answers[key]}
                  onChange={(value) =>
                    set({ answers: { ...draft.answers, [key]: value } })
                  }
                />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
