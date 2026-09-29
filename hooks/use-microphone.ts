import { useCallback, useEffect, useRef, useState } from "react"
import { useInterviewSessionStore } from "@/stores/interview-session.store"

interface UseMicrophoneReturn {
  micOpen: boolean
  microphone: MediaRecorder | null
  userMedia: MediaStream | null
  toggleMicrophone: () => Promise<void>
}

/** Captures the meeting tab's audio (and video, for the preview) via screen share. */
export function useMicrophone(
  onDataAvailable: (data: BlobEvent) => void
): UseMicrophoneReturn {
  const [micOpen, setMicOpen] = useState(false)
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null)
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null)
  const mediaRef = useRef<MediaStream | null>(null)

  const { setMicrophoneStatus } = useInterviewSessionStore()

  const stop = useCallback(() => {
    // Stopping the tracks ends the browser's "sharing this tab" indicator
    mediaRef.current?.getTracks().forEach((track) => track.stop())
    mediaRef.current = null
    setMicrophone((recorder) => {
      if (recorder?.state !== "inactive") recorder?.stop()
      return null
    })
    setUserMedia(null)
    setMicOpen(false)
    setMicrophoneStatus("disconnected")
  }, [setMicrophoneStatus])

  // Release the capture if the playground unmounts while sharing
  useEffect(() => stop, [stop])

  const toggleMicrophone = useCallback(async () => {
    if (microphone && userMedia) {
      stop()
      return
    }

    try {
      setMicrophoneStatus("connecting")

      const media = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      })
      mediaRef.current = media

      // User clicked the browser's own "Stop sharing" button
      media.getVideoTracks()[0]?.addEventListener("ended", stop)

      const mic = new MediaRecorder(media)
      mic.onstart = () => {
        setMicOpen(true)
        setMicrophoneStatus("connected")
      }
      mic.ondataavailable = onDataAvailable
      mic.start(500)

      setUserMedia(media)
      setMicrophone(mic)
    } catch (error) {
      console.error("Error capturing meeting audio:", error)
      setMicrophoneStatus("disconnected")
    }
  }, [microphone, userMedia, onDataAvailable, setMicrophoneStatus, stop])

  return {
    micOpen,
    microphone,
    userMedia,
    toggleMicrophone,
  }
}
