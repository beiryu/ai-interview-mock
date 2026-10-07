import { useEffect, useRef } from "react"

interface VideoPreviewProps {
  stream: MediaStream | null
}

export function VideoPreview({ stream }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const video = videoRef.current
    let animationFrameId: number

    const drawVideoToCanvas = () => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight

        const ctx = canvasRef.current.getContext("2d")
        if (ctx) {
          ctx.drawImage(
            videoRef.current,
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          )
        }
      }
      animationFrameId = requestAnimationFrame(drawVideoToCanvas)
    }

    if (stream && video) {
      video.srcObject = stream
      video.onloadedmetadata = () => {
        video.play()
        animationFrameId = requestAnimationFrame(drawVideoToCanvas)
      }
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (video) {
        video.srcObject = null
      }
    }
  }, [stream])

  return (
    <div className="w-full flex justify-center">
      {/* Muted video element */}
      <video ref={videoRef} style={{ display: "none" }} muted />
      <canvas
        ref={canvasRef}
        className="rounded border border-border"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  )
}
