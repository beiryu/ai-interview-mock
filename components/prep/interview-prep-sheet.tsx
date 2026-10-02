"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"

import type { InterviewPrep, PrepStatus } from "@/lib/prep/schema"
import { cn } from "@/lib/utils"
import {
  useJobPrep,
  useProfilePrep,
  useTailoredCv,
} from "@/hooks/api/prep/usePrep"
import { Button, buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "@/components/ui/use-toast"

import {
  AddButton,
  ItemCard,
  LinesField,
  ListField,
  PrepStatusBar,
  Section,
  TextField,
  nextId,
  patchAt,
  useDraft,
} from "./fields"

const BUTTON_LABEL: Record<PrepStatus, string> = {
  missing: "Prepare",
  pending: "Preparing…",
  ready: "Prep ready",
  stale: "Prep out of date",
  failed: "Prep failed",
}

/** Prepares the job prep the first time it is shown, without a click. */
function useAutoPrep(prep: ReturnType<typeof useJobPrep>) {
  const autoStarted = React.useRef(false)
  React.useEffect(() => {
    if (
      prep.data?.status === "missing" &&
      !prep.data.blocked &&
      !autoStarted.current
    ) {
      autoStarted.current = true
      prep.generate.mutate()
    }
  }, [prep.data?.status, prep.data?.blocked, prep.generate])
}

/** The prep as a side sheet, for a quick look during the live interview. */
export function InterviewPrepSheet({ jobId }: { jobId: string }) {
  const prep = useJobPrep(jobId)
  const status = prep.data?.status ?? "missing"
  useAutoPrep(prep)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 gap-1 px-2 text-xs",
            (status === "stale" || status === "failed") &&
              "text-amber-600 dark:text-amber-400"
          )}
          title="What the coach knows for this interview"
        >
          <ClipboardList className="size-3" />
          {BUTTON_LABEL[status]}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-5 py-3">
          <SheetTitle className="text-sm">Interview prep</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <div className="p-5">
            <JobPrepPanel jobId={jobId} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The job's prep: the JD ↔ evidence map and likely questions, built from
 * the profile prep, this job's description and the CV sent for it.
 */
export function JobPrepPanel({ jobId }: { jobId: string }) {
  const prep = useJobPrep(jobId)
  const profile = useProfilePrep()
  useAutoPrep(prep)

  return (
    <div className="space-y-6">
      <SourcesRow jobId={jobId} profileStatus={profile.data?.status} />
      <CvRow jobId={jobId} />
      <InterviewPrepEditor prep={prep} />
    </div>
  )
}

function SourcesRow({
  jobId,
  profileStatus,
}: {
  jobId: string
  profileStatus?: PrepStatus
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <span>
        Profile prep:{" "}
        <Link href="/dashboard/profile" className="font-medium underline">
          {profileStatus
            ? BUTTON_LABEL[profileStatus].replace("Prep ", "")
            : "…"}
        </Link>
      </span>
      <Link
        href={`/dashboard/jobs/${jobId}?tab=jd`}
        className="font-medium underline"
      >
        Job description & notes
      </Link>
      <span className="text-muted-foreground">
        Requirements come from this job&apos;s description.
      </span>
    </div>
  )
}

const CV_LABEL: Record<PrepStatus, string> = {
  missing: "not made yet",
  pending: "writing…",
  ready: "ready",
  stale: "out of date",
  failed: "failed",
}

/** The CV sent for this job: the prep and the coach build on it. */
function CvRow({ jobId }: { jobId: string }) {
  const { data } = useTailoredCv(jobId)
  const pending = data?.pending ?? 0
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <span>Tailored CV: {data ? CV_LABEL[data.status] : "…"}</span>
      <Link
        href={`/dashboard/jobs/${jobId}?tab=cv`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-6 px-2 text-xs"
        )}
      >
        Open CV
      </Link>
      {pending > 0 && (
        <span className="text-amber-700 dark:text-amber-300">
          {pending} stretch{pending > 1 ? "es" : ""} to approve
        </span>
      )}
      <span className="text-muted-foreground">
        The coach stays consistent with what this CV says.
      </span>
    </div>
  )
}

function InterviewPrepEditor({
  prep,
}: {
  prep: ReturnType<typeof useJobPrep>
}) {
  const { data, generate, save } = prep
  const { draft, dirty, update, reset } = useDraft<InterviewPrep>(
    data?.content ?? null
  )

  return (
    <div className="space-y-6">
      <PrepStatusBar
        status={data?.status ?? "missing"}
        updatedAt={data?.updatedAt ?? null}
        error={data?.error ?? null}
        blocked={data?.blocked ?? null}
        onGenerate={() => generate.mutate()}
        generating={generate.isPending}
        dirty={dirty}
        onSave={() =>
          draft &&
          save.mutate(draft, {
            onSuccess: () => reset(),
            onError: () =>
              toast({ title: "Could not save", variant: "destructive" }),
          })
        }
        saving={save.isPending}
      />

      {draft && (
        <>
          <Section
            title="Angle"
            description="Why you fit this role — the coach leans on it for motivation questions."
          >
            <TextField
              label="Angle"
              multiline
              value={draft.angle}
              onChange={(angle) => update((d) => ({ ...d, angle }))}
            />
          </Section>

          <Section
            title="Requirements → your evidence"
            description="Evidence cites your facts/stories (P*, S*). Gaps get an honest bridge."
          >
            <div className="space-y-3">
              {draft.requirements.map((req, i) => {
                const set = (patch: Partial<typeof req>) =>
                  update((d) => ({
                    ...d,
                    requirements: patchAt(d.requirements, i, patch),
                  }))
                return (
                  <ItemCard
                    key={req.id}
                    id={req.id}
                    locked={req.locked}
                    title={req.text}
                    onRemove={() =>
                      update((d) => ({
                        ...d,
                        requirements: d.requirements.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <TextField
                      label="Requirement"
                      value={req.text}
                      onChange={(text) => set({ text })}
                    />
                    <ListField
                      label="Evidence"
                      value={req.evidence}
                      onChange={(evidence) => set({ evidence })}
                      placeholder="P2, S1"
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <TextField
                        label="Gap"
                        multiline
                        value={req.gap ?? ""}
                        onChange={(v) => set({ gap: v || null })}
                      />
                      <TextField
                        label="Bridge"
                        multiline
                        value={req.bridge ?? ""}
                        onChange={(v) => set({ bridge: v || null })}
                      />
                    </div>
                  </ItemCard>
                )
              })}
            </div>
            <AddButton
              label="Add requirement"
              onClick={() =>
                update((d) => ({
                  ...d,
                  requirements: [
                    ...d.requirements,
                    {
                      id: nextId("R", d.requirements),
                      text: "",
                      evidence: [],
                      gap: null,
                      bridge: null,
                      locked: true,
                    },
                  ],
                }))
              }
            />
          </Section>

          <Section
            title="Likely questions"
            description="Prepared points the coach can reuse live."
          >
            <div className="space-y-3">
              {draft.likelyQuestions.map((q, i) => {
                const set = (patch: Partial<typeof q>) =>
                  update((d) => ({
                    ...d,
                    likelyQuestions: patchAt(d.likelyQuestions, i, patch),
                  }))
                return (
                  <ItemCard
                    key={i}
                    locked={q.locked}
                    title={q.question}
                    onRemove={() =>
                      update((d) => ({
                        ...d,
                        likelyQuestions: d.likelyQuestions.filter(
                          (_, j) => j !== i
                        ),
                      }))
                    }
                  >
                    <TextField
                      label="Question"
                      value={q.question}
                      onChange={(question) => set({ question })}
                    />
                    <LinesField
                      label="Points"
                      value={q.points}
                      onChange={(points) => set({ points })}
                    />
                    <ListField
                      label="Refs"
                      value={q.refs}
                      onChange={(refs) => set({ refs })}
                    />
                  </ItemCard>
                )
              })}
            </div>
            <AddButton
              label="Add question"
              onClick={() =>
                update((d) => ({
                  ...d,
                  likelyQuestions: [
                    ...d.likelyQuestions,
                    { question: "", points: [], refs: [], locked: true },
                  ],
                }))
              }
            />
          </Section>
        </>
      )}
    </div>
  )
}
