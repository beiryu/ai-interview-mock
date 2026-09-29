import { useCallback, useEffect, useRef, useState } from "react"

interface UseMicrophoneReturn {
  micOpen: boolean
  microphone: MediaRecorder | null
  userMedia: MediaStream | null
  toggleMicrophone: () => Promise<void>
}

/**
 * Captures the candidate's own microphone. Deliberately does not touch the
 * shared microphoneStatus, which reflects the meeting-tab capture.
 */
export function useMicrophoneOnly(
  onDataAvailable: (data: BlobEvent) => void
): UseMicrophoneReturn {
  const [micOpen, setMicOpen] = useState(false)
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null)
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null)
  const mediaRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    mediaRef.current?.getTracks().forEach((track) => track.stop())
    mediaRef.current = null
    setMicrophone((recorder) => {
      if (recorder?.state !== "inactive") recorder?.stop()
      return null
    })
    setUserMedia(null)
    setMicOpen(false)
  }, [])

  // Turn the mic off if the playground unmounts
  useEffect(() => stop, [stop])

  const toggleMicrophone = useCallback(async () => {
    if (microphone && userMedia) {
      stop()
      return
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRef.current = media

      const mic = new MediaRecorder(media)
      mic.onstart = () => setMicOpen(true)
      mic.ondataavailable = onDataAvailable
      mic.start(500)

      setUserMedia(media)
      setMicrophone(mic)
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }, [microphone, userMedia, onDataAvailable, stop])

  return {
    micOpen,
    microphone,
    userMedia,
    toggleMicrophone,
  }
}
