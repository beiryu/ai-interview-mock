"use client"

import * as React from "react"
import { Check, Download, Eraser, Trash2 } from "lucide-react"

import {
  EMPTY_CONTACT,
  pendingStretches,
  type Contact,
  type CvBullet,
  type CvContent,
  type CvExperience,
  type Stretch,
} from "@/lib/cv/schema"
import { cn } from "@/lib/utils"
import type { CvState } from "@/hooks/api/cv/useCvs"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AddButton,
  ItemCard,
  ListField,
  PrepStatusBar,
  Section,
  TextField,
  nextId,
  patchAt,
  useDraft,
} from "@/components/prep/fields"

/**
 * A CV: edit on the left, a PDF-like preview on the right. Wording that goes
 * beyond the source CV (a stretch) has an amber frame until you approve it,
 * fix the wording, or remove the line — the PDF download waits for that. A
 * practice persona downloads marked as fictional.
 */
export function CvEditor({
  state,
  onSave,
  saving,
  onRebuild,
  rebuilding,
  rebuildLabel = "Regenerate",
  emptyText,
  toolbarStart,
  renderRebuild,
}: {
  state: CvState | undefined
  onSave: (content: CvContent, done: () => void) => void
  saving: boolean
  onRebuild: () => void
  rebuilding: boolean
  rebuildLabel?: string
  /** What to say while there is no content yet */
  emptyText: string
  /** Toolbar: where the CV comes from (left) */
  toolbarStart?: React.ReactNode
  /** Replaces the plain rebuild button (e.g. a dialog to choose the source) */
  renderRebuild?: (options: { disabled: boolean }) => React.ReactNode
}) {
  const { draft, dirty, update, reset } = useDraft<CvContent>(
    state?.content ?? null
  )
  const practice = state?.cv?.origin === "GENERATED"
  const sourceLabels = state?.sourceLabels ?? {}
  const pending = draft ? pendingStretches(draft).length : 0

  const save = () => draft && onSave(draft, reset)

  const setExperience = (
    index: number,
    fn: (experience: CvExperience) => CvExperience
  ) =>
    update((d) => ({
      ...d,
      experience: d.experience.map((e, i) => (i === index ? fn(e) : e)),
    }))

  return (
    <div className="grid gap-6">
      <PrepStatusBar
        status={state?.status ?? "missing"}
        updatedAt={state?.updatedAt ?? null}
        error={state?.error ?? null}
        blocked={state?.blocked ?? null}
        onGenerate={onRebuild}
        generating={rebuilding}
        generateLabel={rebuildLabel}
        dirty={dirty}
        onSave={save}
        saving={saving}
        leading={toolbarStart}
        info={
          pending > 0 && (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {pending} stretch{pending > 1 ? "es" : ""} to approve before
              download
            </span>
          )
        }
        hideGenerate={!!renderRebuild}
        actionsBefore={renderRebuild?.({
          disabled: dirty || state?.status === "pending" || rebuilding,
        })}
        actionsAfter={
          state?.cv && (
            <DownloadButton
              cvId={state.cv.id}
              disabled={!draft || dirty || pending > 0}
              reason={
                dirty
                  ? "Save your edits first"
                  : pending > 0
                  ? "Approve, fix or remove the stretches first"
                  : practice
                  ? "Every page is marked as a fictional practice persona"
                  : "Download the CV as a PDF"
              }
            />
          )
        }
      />

      {!draft ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="space-y-8">
            <ContactSection
              contact={draft.contact}
              onChange={(contact) => update((d) => ({ ...d, contact }))}
            />

            <Section
              title="Headline & summary"
              description="Aimed at this role. Keep it to what you can talk about for two minutes."
            >
              <TextField
                label="Headline"
                value={draft.headline}
                onChange={(headline) => update((d) => ({ ...d, headline }))}
              />
              <TextField
                label="Summary"
                multiline
                value={draft.summary}
                onChange={(summary) => update((d) => ({ ...d, summary }))}
              />
              {draft.summaryStretch && (
                <StretchBox
                  stretch={draft.summaryStretch}
                  onChange={(summaryStretch) =>
                    update((d) => ({ ...d, summaryStretch }))
                  }
                />
              )}
            </Section>

            <Section
              title="Skills"
              description={
                state?.cv?.origin === "REFINED"
                  ? "Only skills your CV shows. What the job wants beyond them is listed under Gaps."
                  : undefined
              }
            >
              <div className="space-y-2">
                {draft.skills.map((group, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <TextField
                      label="Group"
                      className="w-40 shrink-0"
                      value={group.group}
                      onChange={(value) =>
                        update((d) => ({
                          ...d,
                          skills: d.skills.map((g, j) =>
                            j === i ? { ...g, group: value } : g
                          ),
                        }))
                      }
                    />
                    <div className="flex-1">
                      <ListField
                        label="Items"
                        value={group.items}
                        onChange={(items) =>
                          update((d) => ({
                            ...d,
                            skills: d.skills.map((g, j) =>
                              j === i ? { ...g, items } : g
                            ),
                          }))
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          skills: d.skills.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <AddButton
                label="Add group"
                onClick={() =>
                  update((d) => ({
                    ...d,
                    skills: [...d.skills, { group: "", items: [] }],
                  }))
                }
              />
            </Section>

            <Section
              title="Experience"
              description={
                state?.cv?.origin === "REFINED"
                  ? "Each line shows the lines of your CV it comes from."
                  : undefined
              }
            >
              <div className="space-y-4">
                {draft.experience.map((exp, i) => (
                  <ItemCard
                    key={exp.id}
                    id={exp.id}
                    title={`${exp.role} · ${exp.company}`}
                    onRemove={() =>
                      update((d) => ({
                        ...d,
                        experience: d.experience.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <div className="grid gap-2 md:grid-cols-3">
                      <TextField
                        label="Company"
                        value={exp.company}
                        onChange={(company) =>
                          setExperience(i, (e) => ({ ...e, company }))
                        }
                      />
                      <TextField
                        label="Role"
                        value={exp.role}
                        onChange={(role) =>
                          setExperience(i, (e) => ({ ...e, role }))
                        }
                      />
                      <TextField
                        label="Period"
                        value={exp.period}
                        onChange={(period) =>
                          setExperience(i, (e) => ({ ...e, period }))
                        }
                      />
                    </div>
                    <div className="space-y-3">
                      {exp.bullets.map((bullet, b) => (
                        <BulletEditor
                          key={bullet.id}
                          bullet={bullet}
                          sourceLabels={
                            state?.cv?.origin === "REFINED"
                              ? sourceLabels
                              : null
                          }
                          onChange={(patch) =>
                            setExperience(i, (e) => ({
                              ...e,
                              bullets: patchAt(e.bullets, b, patch),
                            }))
                          }
                          onRemove={() =>
                            setExperience(i, (e) => ({
                              ...e,
                              bullets: e.bullets.filter((_, j) => j !== b),
                            }))
                          }
                        />
                      ))}
                    </div>
                    <AddButton
                      label="Add line"
                      onClick={() =>
                        update((d) => {
                          const id = nextId(
                            "B",
                            d.experience.flatMap((e) => e.bullets)
                          )
                          return {
                            ...d,
                            experience: d.experience.map((e, j) =>
                              j !== i
                                ? e
                                : {
                                    ...e,
                                    bullets: [
                                      ...e.bullets,
                                      {
                                        id,
                                        text: "",
                                        sourceIds: [],
                                        stretch: null,
                                        locked: true,
                                      },
                                    ],
                                  }
                            ),
                          }
                        })
                      }
                    />
                  </ItemCard>
                ))}
              </div>
            </Section>

            <Section title="Education">
              <div className="space-y-3">
                {draft.education.map((edu, i) => {
                  const set = (patch: Partial<typeof edu>) =>
                    update((d) => ({
                      ...d,
                      education: d.education.map((e, j) =>
                        j === i ? { ...e, ...patch } : e
                      ),
                    }))
                  return (
                    <ItemCard
                      key={i}
                      title={edu.school}
                      onRemove={() =>
                        update((d) => ({
                          ...d,
                          education: d.education.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <div className="grid gap-2 md:grid-cols-3">
                        <TextField
                          label="School"
                          value={edu.school}
                          onChange={(school) => set({ school })}
                        />
                        <TextField
                          label="Degree"
                          value={edu.degree}
                          onChange={(degree) => set({ degree })}
                        />
                        <TextField
                          label="Period"
                          value={edu.period}
                          onChange={(period) => set({ period })}
                        />
                      </div>
                      <TextField
                        label="Note"
                        value={edu.note ?? ""}
                        onChange={(note) => set({ note: note || null })}
                      />
                    </ItemCard>
                  )
                })}
              </div>
            </Section>

            {draft.learning.length > 0 && (
              <Section
                title="Gaps for this job"
                description="What the job asks for that your CV doesn't show. Never printed; the coach answers these honestly."
              >
                <div className="flex flex-wrap gap-1.5">
                  {draft.learning.map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}
          </div>

          <div className="xl:sticky xl:top-4">
            <CvPreview cv={draft} contact={draft.contact} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Name and contact printed at the top of the CV. */
function ContactSection({
  contact,
  onChange,
}: {
  contact: Contact
  onChange: (contact: Contact) => void
}) {
  const value = contact ?? EMPTY_CONTACT
  return (
    <Section
      title="Name & contact"
      description="Printed at the top. Blank name or email falls back to your account."
    >
      <div className="grid gap-2 md:grid-cols-2">
        {(["name", "email", "phone", "location"] as const).map((key) => (
          <TextField
            key={key}
            label={key[0].toUpperCase() + key.slice(1)}
            value={value[key]}
            onChange={(v) => onChange({ ...value, [key]: v })}
          />
        ))}
      </div>
      <ListField
        label="Links (GitHub, LinkedIn, portfolio)"
        value={value.links}
        onChange={(links) => onChange({ ...value, links })}
      />
    </Section>
  )
}

function DownloadButton({
  cvId,
  disabled,
  reason,
}: {
  cvId: string
  disabled: boolean
  reason: string
}) {
  return disabled ? (
    <Button size="sm" disabled title={reason}>
      <Download className="mr-1 size-3.5" />
      Download PDF
    </Button>
  ) : (
    <a
      href={`/api/cvs/${cvId}/pdf`}
      title={reason}
      className={buttonVariants({ size: "sm" })}
    >
      <Download className="mr-1 size-3.5" />
      Download PDF
    </a>
  )
}

function BulletEditor({
  bullet,
  sourceLabels,
  onChange,
  onRemove,
}: {
  bullet: CvBullet
  /** Source bullet texts (a refined CV), or null: no "from" chips */
  sourceLabels: Record<string, string> | null
  onChange: (patch: Partial<CvBullet>) => void
  onRemove: () => void
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-md border p-2",
        bullet.stretch &&
          !bullet.stretch.approved &&
          "border-amber-500/70 bg-amber-500/5"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <TextField
            label={bullet.id}
            multiline
            value={bullet.text}
            onChange={(text) => onChange({ text })}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="mt-5 size-7"
          title="Remove this line"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {sourceLabels && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">From your CV:</span>
          {bullet.sourceIds.length === 0 && (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              no line
            </span>
          )}
          {bullet.sourceIds.map((id) => (
            <Badge
              key={id}
              variant="secondary"
              className="font-mono text-[10px]"
              title={sourceLabels[id] ?? "No longer in your CV"}
            >
              {id}
            </Badge>
          ))}
        </div>
      )}
      {bullet.stretch && (
        <StretchBox
          stretch={bullet.stretch}
          onChange={(stretch) => onChange({ stretch })}
        />
      )}
    </div>
  )
}

/** A stretch: what goes beyond your CV and what to say if asked. */
function StretchBox({
  stretch,
  onChange,
}: {
  stretch: Stretch
  onChange: (stretch: Stretch | null) => void
}) {
  if (stretch.approved) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="size-3.5 text-green-600" />
        <span className="flex-1">
          Stretch approved — if asked: {stretch.defense || "(no answer set)"}
        </span>
        <button
          className="underline"
          onClick={() => onChange({ ...stretch, approved: false })}
        >
          Undo
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-2 rounded-md border border-amber-500/70 bg-amber-500/5 p-2">
      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
        Stretch: {stretch.note}
      </p>
      <TextField
        label="If asked, say"
        multiline
        value={stretch.defense}
        placeholder="One or two honest sentences about what you really did"
        onChange={(defense) => onChange({ ...stretch, defense })}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={!stretch.defense.trim()}
          title={
            stretch.defense.trim()
              ? "Keep this wording on the CV"
              : "Write what you'd say if asked first"
          }
          onClick={() => onChange({ ...stretch, approved: true })}
        >
          <Check className="mr-1 size-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          title="You rewrote the line so it only says what your CV says"
          onClick={() => onChange(null)}
        >
          <Eraser className="mr-1 size-3.5" />
          Wording fixed
        </Button>
      </div>
    </div>
  )
}

/** Close to the PDF (one column, A4 proportions); stretches are marked. */
function CvPreview({
  cv,
  contact,
}: {
  cv: CvContent
  contact: Contact | undefined
}) {
  const line = [contact?.email, contact?.phone, contact?.location]
    .concat(contact?.links ?? [])
    .filter(Boolean)
    .join(" · ")
  const mark = (stretch: Stretch | null) =>
    stretch && !stretch.approved && "bg-amber-200/60 dark:bg-amber-500/30"
  return (
    <div className="aspect-[1/1.414] overflow-auto rounded-md border bg-white p-8 text-[11px] leading-relaxed text-neutral-900 shadow-sm">
      <h2 className="text-lg font-semibold leading-tight">
        {contact?.name || "Your name"}
      </h2>
      <p className="mt-1 text-xs text-neutral-700">{cv.headline}</p>
      {line && <p className="mt-1 text-neutral-600">{line}</p>}

      <PreviewHeading>Summary</PreviewHeading>
      <p className={cn(mark(cv.summaryStretch))}>{cv.summary}</p>

      {cv.skills.length > 0 && (
        <>
          <PreviewHeading>Skills</PreviewHeading>
          {cv.skills.map((g) => (
            <p key={g.group}>
              <span className="font-semibold">{g.group}:</span>{" "}
              {g.items.join(", ")}
            </p>
          ))}
        </>
      )}

      {cv.experience.length > 0 && (
        <>
          <PreviewHeading>Experience</PreviewHeading>
          <div className="space-y-2">
            {cv.experience.map((e) => (
              <div key={e.id}>
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">
                    {e.role} — {e.company}
                  </span>
                  <span className="shrink-0 text-neutral-600">{e.period}</span>
                </div>
                <ul className="list-disc pl-4">
                  {e.bullets.map((b) => (
                    <li key={b.id} className={cn(mark(b.stretch))}>
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {cv.education.length > 0 && (
        <>
          <PreviewHeading>Education</PreviewHeading>
          {cv.education.map((e, i) => (
            <div key={i}>
              <div className="flex justify-between gap-3">
                <span className="font-semibold">
                  {e.degree} — {e.school}
                </span>
                <span className="shrink-0 text-neutral-600">{e.period}</span>
              </div>
              {e.note && <p>{e.note}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function PreviewHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 mt-3 border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider">
      {children}
    </h3>
  )
}
