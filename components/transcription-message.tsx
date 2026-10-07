type TranscriptionMessageType = "buffer" | "interim" | "final" | "speaking"

interface TranscriptionMessageProps {
  timestamp?: string
  text?: string
  type: TranscriptionMessageType
  role?: "interviewer" | "candidate"
  /** Detected language ("vi", "en", …) */
  language?: string | null
}

export function TranscriptionMessage({
  timestamp,
  text,
  type,
  role,
  language,
}: TranscriptionMessageProps) {
  const isCandidate = role === "candidate"
  const speaker = (
    <span className="px-1 text-xs text-muted-foreground">
      {isCandidate ? "Me" : "Interviewer"}
      {language && (
        <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] font-medium uppercase">
          {language}
        </span>
      )}
    </span>
  )

  if (type === "speaking") {
    return (
      <div
        className={`flex flex-col gap-1 py-1 animate-fade-in ${
          isCandidate ? "items-end" : "items-start"
        }`}
      >
        {speaker}
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isCandidate
              ? "bg-primary/15 rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          }`}
        >
          {text ? (
            <p className="text-sm text-foreground leading-relaxed">
              {text}
              <span className="inline-block w-[2px] h-[1em] ml-[2px] bg-foreground/50 align-middle animate-pulse" />
            </p>
          ) : (
            <div className="flex items-center gap-[5px] h-4">
              <span
                className="size-2 rounded-full bg-foreground/40 animate-bounce"
                style={{ animationDelay: "-0.3s" }}
              />
              <span
                className="size-2 rounded-full bg-foreground/40 animate-bounce"
                style={{ animationDelay: "-0.15s" }}
              />
              <span className="size-2 rounded-full bg-foreground/40 animate-bounce" />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (type === "final") {
    return (
      <div
        className={`flex flex-col gap-1 py-1 animate-fade-in ${
          isCandidate ? "items-end" : "items-start"
        }`}
      >
        {speaker}
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
            isCandidate
              ? "bg-primary/15 text-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          {text}
        </div>
        <span className="text-xs text-muted-foreground/60 px-1">
          {timestamp}
        </span>
      </div>
    )
  }

  return null
}
