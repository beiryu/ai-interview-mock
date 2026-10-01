"use client"

import {
  EMPTY_PERSONAL,
  PERSONAL_LABELS,
  STORY_THEMES,
  type Personal,
  type ProfilePrep,
} from "@/lib/prep/schema"
import { useProfilePrep } from "@/hooks/api/prep/usePrep"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

/**
 * Review and edit the profile prep (from all non-JD documents): what the
 * live coach may say about the candidate. Edited items are locked and
 * survive regeneration; personal answers are only ever the candidate's.
 */
export function ProfilePrepEditor() {
  const { data, generate, save } = useProfilePrep()
  const { draft, dirty, update, reset } = useDraft<ProfilePrep>(
    data?.content ?? null
  )

  const onSave = () => {
    if (!draft) return
    save.mutate(draft, {
      onSuccess: () => reset(),
      onError: () => toast({ title: "Could not save", variant: "destructive" }),
    })
  }

  return (
    <div className="space-y-8">
      <PrepStatusBar
        status={data?.status ?? "missing"}
        updatedAt={data?.updatedAt ?? null}
        error={data?.error ?? null}
        blocked={data?.blocked ?? null}
        onGenerate={() => generate.mutate()}
        generating={generate.isPending}
        dirty={dirty}
        onSave={onSave}
        saving={save.isPending}
      />

      {!draft ? (
        <p className="text-sm text-muted-foreground">
          Upload your CV / portfolio / notes under Documents, then click
          Prepare. A strong model extracts your projects, writes STAR stories
          from them and lists what you should not claim — you review it here.
        </p>
      ) : (
        <>
          <Section
            title="Personal answers"
            description="Only you know these. Blank fields make the coach leave a [fill in] instead of guessing."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {(Object.keys(PERSONAL_LABELS) as (keyof Personal)[]).map(
                (key) => (
                  <TextField
                    key={key}
                    label={PERSONAL_LABELS[key]}
                    multiline
                    value={(draft.personal ?? EMPTY_PERSONAL)[key]}
                    onChange={(value) =>
                      update((d) => ({
                        ...d,
                        personal: { ...d.personal, [key]: value },
                      }))
                    }
                  />
                )
              )}
            </div>
          </Section>

          <Section
            title="Facts"
            description="Your projects and roles. Answers cite them as P1, P2… — keep numbers exact."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {draft.facts.map((fact, i) => {
                const set = (patch: Partial<typeof fact>) =>
                  update((d) => ({ ...d, facts: patchAt(d.facts, i, patch) }))
                return (
                  <ItemCard
                    key={fact.id}
                    id={fact.id}
                    locked={fact.locked}
                    title={fact.title}
                    onRemove={() =>
                      update((d) => ({
                        ...d,
                        facts: d.facts.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <TextField
                      label="Title"
                      value={fact.title}
                      onChange={(title) => set({ title })}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <TextField
                        label="Organization"
                        value={fact.organization ?? ""}
                        onChange={(v) => set({ organization: v || null })}
                      />
                      <TextField
                        label="Period"
                        value={fact.period ?? ""}
                        onChange={(v) => set({ period: v || null })}
                      />
                      <TextField
                        label="Role"
                        value={fact.role ?? ""}
                        onChange={(v) => set({ role: v || null })}
                      />
                    </div>
                    <ListField
                      label="Stack"
                      value={fact.stack}
                      onChange={(stack) => set({ stack })}
                    />
                    <LinesField
                      label="Highlights (one per line)"
                      value={fact.highlights}
                      onChange={(highlights) => set({ highlights })}
                    />
                  </ItemCard>
                )
              })}
            </div>
            <AddButton
              label="Add fact"
              onClick={() =>
                update((d) => ({
                  ...d,
                  facts: [
                    ...d.facts,
                    {
                      id: nextId("P", d.facts),
                      title: "",
                      organization: null,
                      period: null,
                      role: null,
                      stack: [],
                      highlights: [],
                      locked: true,
                    },
                  ],
                }))
              }
            />
          </Section>

          <Section
            title="Stories (STAR)"
            description="Behavioral answers use only these. Fix anything that didn't happen that way — the coach will tell it as written."
          >
            <div className="grid gap-3 lg:grid-cols-2">
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
                    title={story.title}
                    onRemove={() =>
                      update((d) => ({
                        ...d,
                        stories: d.stories.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <div className="grid grid-cols-[1fr_9rem] gap-2">
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
                      (part) => (
                        <TextField
                          key={part}
                          label={part[0].toUpperCase() + part.slice(1)}
                          multiline
                          value={story[part]}
                          onChange={(value) => set({ [part]: value })}
                        />
                      )
                    )}
                    <ListField
                      label="From facts"
                      value={story.factIds}
                      onChange={(factIds) => set({ factIds })}
                      placeholder="P1, P3"
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
                      factIds: [],
                      locked: true,
                    },
                  ],
                }))
              }
            />
          </Section>

          <Section
            title="Never claim"
            description="Skills you don't have. The coach answers honestly about these and bridges to what you did use."
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
