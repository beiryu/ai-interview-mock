import { Cable } from "lucide-react"

import { cn } from "@/lib/utils"

import { Icons } from "./icons"
import { HoverBorderGradient } from "./ui/hover-border-gradient"

interface RecordButtonProps {
  micOpen: boolean
  onClick: () => void
  disabled?: boolean
}

export function RecordButton({
  micOpen,
  onClick,
  disabled,
}: RecordButtonProps) {
  return (
    <HoverBorderGradient
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      containerClassName={cn(
        "rounded-full m-4",
        disabled && "cursor-not-allowed opacity-50"
      )}
      as="button"
      className="dark:bg-black bg-white text-black dark:text-white "
    >
      <div className="flex items-center">
        {micOpen ? (
          <>
            <Icons.micOff className="size-4 -translate-x-0.5 mr-2" />
            Stop listening
          </>
        ) : (
          <>
            <Cable className="size-4 -translate-x-0.5 mr-2" />
            <span className="text-sm font-medium">Share the meeting tab</span>
          </>
        )}
      </div>
    </HoverBorderGradient>
  )
}
