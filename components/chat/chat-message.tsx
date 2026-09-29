import { useState } from "react"
import { BookOpen, ChevronDown, Copy, FileText } from "lucide-react"

import { cn } from "@/lib/utils"
import { Source } from "@/hooks/api/chat/useRagChatMessages"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MarkdownMessage } from "@/components/ui/markdown-message"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { toast } from "../ui/use-toast"

interface ChatMessageProps {
  isUser?: boolean
  children?: React.ReactNode
  content?: string
  sources?: Source[]
  isStreaming?: boolean
}

export function ChatMessage({
  isUser,
  children,
  content,
  sources = [],
}: ChatMessageProps) {
  return (
    <article
      className={cn(
        "flex items-start gap-3 text-[15px] leading-relaxed",
        isUser && "justify-end"
      )}
    >
      <div className="flex-1 min-w-0">
        {isUser ? (
          <Card className={cn("px-4 py-2", "bg-primary/10 border-primary/20")}>
            <div className="flex flex-col gap-2.5">
              <p className="sr-only">You said:</p>
              {children}
            </div>
          </Card>
        ) : content ? (
          <div className="space-y-2">
            <p className="sr-only">AI Assistant said:</p>
            <MarkdownMessage content={content} />
          </div>
        ) : (
          <Card className="px-4 py-3 bg-card">
            <div className="flex flex-col gap-2.5">
              <p className="sr-only">AI Assistant said:</p>
              {children}
            </div>
          </Card>
        )}

        {/* Actions and Sources container */}
        {!isUser && (
          <div className="flex flex-row justify-between gap-2 w-full mt-2 mb-4 items-center">
            <MessageActions content={content} />
            {sources && sources.length > 0 && (
              <SourcesDisplay sources={sources} />
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function MessageActions({ content }: { content?: string }) {
  const [hasCopiedText, setHasCopiedText] = useState(false)
  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => setHasCopiedText(true))
  }

  return (
    <div className="flex">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                copyToClipboard(content || "")
                toast({
                  title: "Copied to clipboard",
                  description: "The message has been copied to your clipboard.",
                  variant: "default",
                })
              }}
              disabled={hasCopiedText}
            >
              <Copy className="size-3 mr-1.5" />
              Copy
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start">
            Copy message
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

function SourcesDisplay({ sources }: { sources: Source[] }) {
  // Group sources by document title
  const groupedSources = sources.reduce((acc, source) => {
    const title = source.documentTitle
    if (!acc[title]) {
      acc[title] = []
    }
    acc[title].push(source)
    return acc
  }, {} as Record<string, Source[]>)

  if (Object.keys(groupedSources).length === 0) return null

  return (
    <div className="space-y-1 flex items-center gap-2">
      <div className="flex flex-wrap gap-2">
        {Object.entries(groupedSources).map(([title, documentSources]) => (
          <SourceBadge key={title} title={title} sources={documentSources} />
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <BookOpen className="size-3" />
        <span>Sources ({Object.keys(groupedSources).length})</span>
      </div>
    </div>
  )
}

function SourceBadge({ title, sources }: { title: string; sources: Source[] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "px-2.5 text-xs font-medium transition-all duration-200",
            "bg-background/50 hover:bg-accent/50 border-border/50",
            "text-foreground/80 hover:text-foreground",
            "backdrop-blur-sm",
            sources.length > 1 && "pr-1.5"
          )}
        >
          <span className="truncate max-w-[120px]">{title}</span>
          {sources.length > 1 && (
            <>
              <Badge
                variant="secondary"
                className="ml-1.5 h-4 px-1 text-xs font-medium bg-primary/10 text-primary border-0"
              >
                {sources.length}
              </Badge>
              <ChevronDown className="size-3 ml-1 text-muted-foreground" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 border-border/50 bg-background/95 backdrop-blur-md"
        align="start"
        sideOffset={4}
      >
        <div className="flex items-center px-4 py-3 border-b border-border/50">
          <FileText className="size-3 mr-1.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {sources.length} citation{sources.length > 1 ? "s" : ""} found
          </p>
        </div>
        <div className="p-2 space-y-2">
          {sources.map((source, index) => (
            <Card
              key={source.fileId ?? source.chunkId ?? index}
              className="p-3 bg-muted/30 border-border/30 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Citation {index + 1}
                  </span>
                  {source.score !== undefined && (
                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                      {(source.score * 100).toFixed(0)}% match
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed line-clamp-4">
                  {source.quote ?? source.content}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
