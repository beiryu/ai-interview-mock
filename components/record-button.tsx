import { AudioLines, Cable } from "lucide-react"

import { useDesktop } from "@/hooks/use-desktop"

import { Icons } from "./icons"
import { Button } from "./ui/button"

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
  // The desktop app listens to system audio instead of a shared tab
  const desktop = useDesktop()
  return (
    <Button
      variant="outline"
      className="m-4 rounded-full"
      onClick={onClick}
      disabled={disabled}
    >
      {micOpen ? (
        <>
          <Icons.micOff />
          Stop listening
        </>
      ) : desktop ? (
        <>
          <AudioLines />
          Listen to system audio
        </>
      ) : (
        <>
          <Cable />
          Share the meeting tab
        </>
      )}
    </Button>
  )
}
