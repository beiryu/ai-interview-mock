import { useInterviewSessionStore } from "@/stores/interview-session.store"

function getMicrophoneStatusDisplay(status: string) {
  switch (status) {
    case "connected":
      return {
        text: "Ready",
        color: "bg-green-500",
      }
    case "connecting":
      return {
        text: "Connecting...",
        color: "bg-yellow-500",
      }
    default:
      return {
        text: "Waiting for connection",
        color: "bg-red-500",
      }
  }
}

export function MicrophoneConnectionStatus() {
  const microphoneStatus = useInterviewSessionStore(
    (state) => state.microphoneStatus
  )

  const statusDisplay = getMicrophoneStatusDisplay(microphoneStatus)

  return (
    <>
      <div className={`flex size-2 rounded-full ${statusDisplay.color}`} />
      <span className="text-sm text-muted-foreground">
        {statusDisplay.text}
      </span>
    </>
  )
}
