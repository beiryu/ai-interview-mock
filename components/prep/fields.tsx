"use client"

import * as React from "react"
import { Lock, Plus, RefreshCw, Trash2 } from "lucide-react"

import type { PrepStatus } from "@/lib/prep/schema"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Icons } from "@/components/icons"

/** Small building blocks shared by the profile and interview prep editors. */

const STATUS: Record<PrepStatus, { label: string; className: string }> = {
  missing: {
    label: "Not prepared",
    className: "bg-muted text-muted-foreground",
  },
  pending: {
    label: "Preparing…",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  ready: {
    label: "Ready",
    className: "bg-green-500/15 text-green-700 dark:text-green-300",
  },
  stale: {
    label: "Out of date",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
}

export function PrepStatusBar({
  status,
  updatedAt,
  error,
  blocked,
  onGenerate,
  generating,
  generateLabel,
  dirty,
  onSave,
  saving,
  leading,
  info,
  actionsBefore,
  actionsAfter,
}: {
  status: PrepStatus
  updatedAt: string | null
  error: string | null
  blocked?: string | null
  onGenerate: () => void
  generating: boolean
  /** The rebuild button's label once there is content (default Regenerate) */
  generateLabel?: string
  dirty: boolean
  onSave: () => void
  saving: boolean
  /** Before the status badge (e.g. where a CV comes from) */
  leading?: React.ReactNode
  /** After "updated …" (e.g. stretches to approve) */
  info?: React.ReactNode
  /** Buttons before Regenerate / after Save */
  actionsBefore?: React.ReactNode
  actionsAfter?: React.ReactNode
}) {
  const busy = status === "pending" || generating
  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      <Badge
        variant="outline"
        className={cn("border-0", STATUS[status].className)}
      >
        {busy && <Icons.spinner className="mr-1 size-3 animate-spin" />}
        {STATUS[status].label}
      </Badge>
      {updatedAt && status !== "pending" && (
        <span className="text-xs text-muted-foreground">
          updated{" "}
          {new Date(updatedAt).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      )}
      {status === "failed" && error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
      {blocked && (
        <span className="text-xs text-muted-foreground">{blocked}</span>
      )}
      {info}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actionsBefore}
        <Button
          variant="outline"
          size="sm"
          disabled={busy || dirty || !!blocked}
          title={dirty ? "Save your edits first" : "Edited items (🔒) are kept"}
          onClick={onGenerate}
        >
          <RefreshCw className="mr-1 size-3.5" />
          {status === "missing" ? "Prepare" : generateLabel ?? "Regenerate"}
        </Button>
        <Button size="sm" disabled={!dirty || saving} onClick={onSave}>
          {saving && <Icons.spinner className="mr-1 size-3.5 animate-spin" />}
          Save
        </Button>
        {actionsAfter}
      </div>
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  className?: string
}) {
  const id = React.useId()
  return (
    <div className={cn("grid gap-1", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          className="min-h-16 text-sm"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          className="h-8 text-sm"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

const parseLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
const parseCommas = (text: string) =>
  text
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)

/**
 * Raw text for a string[] field: keeps what the user typed (a trailing
 * comma, a blank line) and only resyncs when the list changes from outside.
 */
function useSyncedText(
  value: string[],
  separator: string,
  parse: (text: string) => string[]
) {
  const [text, setText] = React.useState(value.join(separator))
  const [source, setSource] = React.useState(value)
  if (value !== source) {
    setSource(value)
    if (parse(text).join("\u0000") !== value.join("\u0000")) {
      setText(value.join(separator))
    }
  }
  return { value: text, set: setText }
}

/** A string[] edited as one item per line. */
export function LinesField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}) {
  const text = useSyncedText(value, "\n", parseLines)
  return (
    <TextField
      label={label}
      value={text.value}
      multiline
      placeholder={placeholder}
      onChange={(next) => {
        text.set(next)
        onChange(parseLines(next))
      }}
    />
  )
}

/** A string[] edited as a comma-separated list (stack, ids). */
export function ListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}) {
  const text = useSyncedText(value, ", ", parseCommas)
  return (
    <TextField
      label={label}
      value={text.value}
      placeholder={placeholder}
      onChange={(next) => {
        text.set(next)
        onChange(parseCommas(next))
      }}
    />
  )
}

export function ItemCard({
  id,
  locked,
  title,
  onRemove,
  children,
}: {
  id?: string
  locked?: boolean
  title: string
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        {id && (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {id}
          </Badge>
        )}
        <span className="flex-1 truncate text-sm font-medium">
          {title || "Untitled"}
        </span>
        {locked && (
          <Lock
            className="size-3.5 text-muted-foreground"
            aria-label="Edited — kept on regenerate"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {children}
    </div>
  )
}

export function AddButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Plus className="mr-1 size-3.5" />
      {label}
    </Button>
  )
}

export function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

/** Local editable copy of a prep; edits lock the touched item. */
export function useDraft<T>(content: T | null) {
  const [draft, setDraft] = React.useState<T | null>(content)
  const [source, setSource] = React.useState<T | null>(content)
  const [dirty, setDirty] = React.useState(false)
  // New server content (generation finished, saved) replaces the draft
  // unless the user is mid-edit
  if (content !== source && !dirty) {
    setSource(content)
    setDraft(content)
  }
  const update = (fn: (draft: T) => T) => {
    setDraft((d) => (d ? fn(d) : d))
    setDirty(true)
  }
  return { draft, dirty, update, reset: () => setDirty(false) }
}

/** Replace item `index` with `patch` applied, marking it edited. */
export function patchAt<T extends { locked?: boolean }>(
  list: T[],
  index: number,
  patch: Partial<T>
): T[] {
  return list.map((item, i) =>
    i === index ? { ...item, ...patch, locked: true } : item
  )
}

/** Next free id like "P4" for a manually added item. */
export function nextId(prefix: string, list: { id: string }[]) {
  const max = Math.max(
    0,
    ...list.map((x) => Number(x.id.slice(prefix.length)) || 0)
  )
  return `${prefix}${max + 1}`
}
