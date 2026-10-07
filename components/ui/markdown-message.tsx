import React from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"

import "highlight.js/styles/github-dark.css"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface MarkdownMessageProps {
  content: string
  className?: string
  isStreaming?: boolean
}

/**
 * MarkdownMessage - A component to display AI messages as formatted markdown
 *
 * This component renders AI message content as markdown with:
 * - Syntax highlighting for code blocks
 * - Proper formatting for lists, headings, tables, etc.
 * - Styled to match the application's design system
 * - Streaming support with typing cursor
 */
export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <Card className={cn("px-4 py-3 overflow-hidden min-w-0", className)}>
      <div className="markdown-message prose prose-sm dark:prose-invert max-w-none min-w-0 break-words">
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}
          components={{
            // Style headings
            h1: ({ node, ...props }) => (
              <h1 className="text-xl font-bold mt-6 mb-4" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-lg font-bold mt-5 mb-3" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-md font-bold mt-4 mb-2" {...props} />
            ),

            // Style code blocks
            code: ({ node, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || "")
              // react-markdown v10 has no `inline` prop; fenced blocks carry a language class
              return match ? (
                <div className="not-prose relative">
                  <pre className="rounded bg-muted p-4 overflow-x-auto max-w-full">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              ) : (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              )
            },

            // Style links
            a: ({ node, ...props }) => (
              <a
                className="text-primary underline hover:text-primary/90"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),

            // Style lists
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-5 my-3" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal pl-5 my-3" {...props} />
            ),
            li: ({ node, ...props }) => <li className="my-1" {...props} />,

            // Style tables
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto">
                <table
                  className="border-collapse table-auto w-full my-4"
                  {...props}
                />
              </div>
            ),
            th: ({ node, ...props }) => (
              <th
                className="border border-muted-foreground p-2 font-bold"
                {...props}
              />
            ),
            td: ({ node, ...props }) => (
              <td className="border border-muted-foreground p-2" {...props} />
            ),

            // Style blockquotes
            blockquote: ({ node, ...props }) => (
              <blockquote
                className="border-l-4 border-primary/30 pl-4 italic my-4"
                {...props}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </Card>
  )
}
