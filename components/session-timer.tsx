"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"

export function SessionTimer({
  startedAt,
  className,
}: {
  startedAt: number | null
  className?: string
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  const seconds = startedAt
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0
  // Before the session starts, show 00:00 (not "Not started")
  const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Clock className="size-3.5" />
      <span className="font-mono tabular-nums">{label}</span>
    </div>
  )
}
