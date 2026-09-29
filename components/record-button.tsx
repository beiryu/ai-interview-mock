import { Cable } from "lucide-react"

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
      ) : (
        <>
          <Cable />
          Share the meeting tab
        </>
      )}
    </Button>
  )
}
