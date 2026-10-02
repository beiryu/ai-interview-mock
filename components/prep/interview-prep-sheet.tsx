"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"

import type { InterviewPrep, PrepStatus } from "@/lib/prep/schema"
import { cn } from "@/lib/utils"
import type { InterviewWithSessions } from "@/hooks/api/interview/useGetInterview"
import {
  useInterviewPrep,
  useProfilePrep,
  useTailoredCv,
} from "@/hooks/api/prep/usePrep"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "@/components/ui/use-toast"
import EditDialog from "@/components/modals/edit-modal"

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

/**
 * The interview's prep: which documents it uses, the JD ↔ evidence map and
 * likely questions (from the profile prep + this job description).
 * Prepares itself the first time the interview is opened.
 */
export function InterviewPrepSheet({
  interview,
}: {
  interview: InterviewWithSessions
}) {
  const prep = useInterviewPrep(interview.id)
  const profile = useProfilePrep()
  const status = prep.data?.status ?? "missing"

  // First visit: prepare without waiting for a click
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
          <div className="space-y-6 p-5">
            <SourcesRow
              interview={interview}
              profileStatus={profile.data?.status}
            />
            <CvRow interviewId={interview.id} />
            <InterviewPrepEditor prep={prep} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function SourcesRow({
  interview,
  profileStatus,
}: {
  interview: InterviewWithSessions
  profileStatus?: PrepStatus
}) {
  const [open, setOpen] = React.useState(false)
  const count = interview.documentIds.length
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="underline">
            {count === 0
              ? "No documents picked"
              : `${count} document${count > 1 ? "s" : ""}`}{" "}
            · role & notes
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[520px]">
          <EditDialog interview={interview} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <span className="text-muted-foreground">
        Pick this job&apos;s description so requirements map to your evidence.
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
function CvRow({ interviewId }: { interviewId: string }) {
  const { data } = useTailoredCv(interviewId)
  const pending = data?.pending ?? 0
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <span>
        Tailored CV:{" "}
        <Link
          href={`/dashboard/interviews/${interviewId}/cv`}
          className="font-medium underline"
        >
          {data ? CV_LABEL[data.status] : "…"}
        </Link>
      </span>
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
  prep: ReturnType<typeof useInterviewPrep>
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
