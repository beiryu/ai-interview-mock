import { useCallback, useEffect, useRef, useState } from "react"

export type CaptureSource = "tab" | "mic"

export interface AudioFrame {
  /** 120 ms of 16 kHz mono pcm_s16le */
  pcm: ArrayBuffer
  /** RMS level of the chunk, 0..1 */
  rms: number
}

interface UseAudioCaptureOptions {
  onFrame: (frame: AudioFrame) => void
  /** The user stopped sharing from the browser UI */
  onEnded?: () => void
}

/**
 * Captures the meeting tab ("tab", via screen share with tab audio) or the
 * microphone ("mic") and turns it into 16 kHz PCM frames with an AudioWorklet.
 * Only audio goes to speech-to-text; for the tab source the full stream
 * (with video) is exposed for the preview.
 */
export function useAudioCapture(
  source: CaptureSource,
  { onFrame, onEnded }: UseAudioCaptureOptions
) {
  const [active, setActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onFrameRef = useRef(onFrame)
  const onEndedRef = useRef(onEnded)
  useEffect(() => {
    onFrameRef.current = onFrame
    onEndedRef.current = onEnded
  }, [onFrame, onEnded])

  const cleanupRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setActive(false)
    setStream(null)
  }, [])

  const start = useCallback(async () => {
    if (cleanupRef.current) return
    setError(null)

    let media: MediaStream
    try {
      media =
        source === "tab"
          ? await navigator.mediaDevices.getDisplayMedia({
              audio: true,
              video: true,
            })
          : await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })
    } catch {
      return false // user cancelled the picker or denied the mic
    }

    const audioTracks = media.getAudioTracks()
    if (audioTracks.length === 0) {
      media.getTracks().forEach((track) => track.stop())
      setError(
        'No tab audio. Pick the meeting tab and enable "Share tab audio".'
      )
      return false
    }

    const context = new AudioContext({ latencyHint: "interactive" })
    await context.audioWorklet.addModule("/worklets/pcm-capture.js")
    const input = context.createMediaStreamSource(new MediaStream(audioTracks))
    const worklet = new AudioWorkletNode(context, "pcm-capture")
    // The worklet must be connected to the graph to be processed; route it
    // into a muted gain so nothing is played back
    const mute = context.createGain()
    mute.gain.value = 0
    input.connect(worklet)
    worklet.connect(mute)
    mute.connect(context.destination)

    worklet.port.onmessage = (event: MessageEvent<AudioFrame>) => {
      onFrameRef.current(event.data)
    }

    const handleEnded = () => {
      stop()
      onEndedRef.current?.()
    }
    // "Stop sharing" in the browser bar ends the video track
    const endedTrack = media.getVideoTracks()[0] ?? audioTracks[0]
    endedTrack.addEventListener("ended", handleEnded)

    cleanupRef.current = () => {
      endedTrack.removeEventListener("ended", handleEnded)
      worklet.port.onmessage = null
      input.disconnect()
      worklet.disconnect()
      void context.close()
      media.getTracks().forEach((track) => track.stop())
    }

    setStream(media)
    setActive(true)
    return true
  }, [source, stop])

  // Release devices if the component unmounts mid-capture
  useEffect(() => stop, [stop])

  return { active, stream, error, start, stop }
}
