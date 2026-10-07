"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"

import { STORY_THEMES, type JobPrep, type PrepStatus } from "@/lib/prep/schema"
import { cn } from "@/lib/utils"
import { useJobCv } from "@/hooks/api/cv/useCvs"
import { useJobPrep } from "@/hooks/api/prep/usePrep"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
 * The job's prep: the JD ↔ evidence map, stories, likely questions and
 * what not to claim, built from this job's CV and description.
 */
export function JobPrepPanel({ jobId }: { jobId: string }) {
  const prep = useJobPrep(jobId)
  useAutoPrep(prep)

  return (
    <InterviewPrepEditor
      prep={prep}
      leading={<CvSource jobId={jobId} />}
      info={<CvWarning jobId={jobId} />}
    />
  )
}

/** Where the prep comes from: this job's CV (a link to its tab). */
function CvSource({ jobId }: { jobId: string }) {
  return (
    <span className="text-xs text-muted-foreground">
      Built from{" "}
      <Link
        href={`/dashboard/jobs/${jobId}?tab=cv`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        this job&apos;s CV
      </Link>{" "}
      ·
    </span>
  )
}

/** What about the CV needs you first (the prep follows the CV). */
function CvWarning({ jobId }: { jobId: string }) {
  const { data } = useJobCv(jobId)
  if (!data) return null
  const message = !data.cv
    ? "No CV yet: make it in the CV tab"
    : data.status === "pending"
    ? "The CV is being written"
    : data.status === "stale"
    ? "The CV is out of date: regenerate it first"
    : data.status === "failed"
    ? "The CV failed: regenerate it first"
    : data.pending > 0
    ? `${data.pending} CV stretch${data.pending > 1 ? "es" : ""} to approve`
    : null
  return message ? (
    <span className="text-xs text-amber-700 dark:text-amber-300">
      {message}
    </span>
  ) : null
}

function InterviewPrepEditor({
  prep,
  leading,
  info,
}: {
  prep: ReturnType<typeof useJobPrep>
  leading?: React.ReactNode
  info?: React.ReactNode
}) {
  const { data, generate, save } = prep
  const { draft, dirty, update, reset } = useDraft<JobPrep>(
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
        leading={leading}
        info={info}
      />

      {draft && (
        <>
          <Section
            title="Angle & intro"
            description="Why you fit this role and how you introduce yourself — the coach leans on them for motivation questions."
          >
            <TextField
              label="Angle"
              multiline
              value={draft.angle}
              onChange={(angle) => update((d) => ({ ...d, angle }))}
            />
            <TextField
              label="30-second intro"
              multiline
              value={draft.intro}
              onChange={(intro) => update((d) => ({ ...d, intro }))}
            />
          </Section>

          <Section
            title="Requirements → your evidence"
            description="Evidence cites lines of this job's CV (B*). Gaps get an honest bridge."
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

          <Section
            title="Stories (STAR)"
            description="For behavioral questions, from lines of the CV (B*). Edited stories (🔒) are kept when you regenerate."
          >
            <div className="space-y-3">
              {draft.stories.map((story, i) => {
                const set = (patch: Partial<typeof story>) =>
                  update((d) => ({
                    ...d,
                    stories: patchAt(d.stories, i, patch),
                  }))
                return (
                  <ItemCard
                    key={story.id}
                    id={story.id}
                    locked={story.locked}
                    title={`${story.title} · ${story.theme}`}
                    onRemove={() =>
                      update((d) => ({
                        ...d,
                        stories: d.stories.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <div className="grid gap-2 md:grid-cols-[1fr_160px]">
                      <TextField
                        label="Title"
                        value={story.title}
                        onChange={(title) => set({ title })}
                      />
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">
                          Theme
                        </span>
                        <Select
                          value={story.theme}
                          onValueChange={(theme) =>
                            set({ theme: theme as typeof story.theme })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STORY_THEMES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(["situation", "task", "action", "result"] as const).map(
                      (key) => (
                        <TextField
                          key={key}
                          label={key[0].toUpperCase() + key.slice(1)}
                          multiline
                          value={story[key]}
                          onChange={(value) => set({ [key]: value })}
                        />
                      )
                    )}
                    <ListField
                      label="From CV lines"
                      value={story.sourceIds}
                      onChange={(sourceIds) => set({ sourceIds })}
                      placeholder="B3, B7"
                    />
                  </ItemCard>
                )
              })}
            </div>
            <AddButton
              label="Add story"
              onClick={() =>
                update((d) => ({
                  ...d,
                  stories: [
                    ...d.stories,
                    {
                      id: nextId("S", d.stories),
                      theme: "impact",
                      title: "",
                      situation: "",
                      task: "",
                      action: "",
                      result: "",
                      sourceIds: [],
                      locked: true,
                    },
                  ],
                }))
              }
            />
          </Section>

          <Section
            title="Never claim"
            description="Technologies this job may ask about that the CV doesn't show. The coach answers honestly and bridges to what you did use."
          >
            <LinesField
              label="One per line"
              value={draft.doNotClaim}
              onChange={(doNotClaim) => update((d) => ({ ...d, doNotClaim }))}
            />
          </Section>
        </>
      )}
    </div>
  )
}
