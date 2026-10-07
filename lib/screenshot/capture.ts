import { getDesktop } from "@/lib/desktop"

/**
 * A screenshot of the screen as a PNG data URL. On desktop the Electron
 * shell grabs the primary display with no picker (the overlay hides itself
 * for the shot); on the web it falls back to getDisplayMedia, which shows
 * the browser's screen-picker and captures one frame.
 *
 * Throws with a readable message when capture is unavailable or denied.
 */
export async function captureScreen(): Promise<string> {
  const desktop = getDesktop()
  if (desktop) {
    const image = await desktop.screenshot()
    if (!image) {
      throw new Error(
        "Couldn't capture the screen. Grant Screen Recording to the app in System Settings → Privacy & Security."
      )
    }
    return image
  }
  return captureViaDisplayMedia()
}

async function captureViaDisplayMedia(): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture isn't supported in this browser.")
  }
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    })
    const track = stream.getVideoTracks()[0]
    if (!track) throw new Error("No screen was shared.")

    // One frame is enough; ImageCapture where available, else a <video>
    const bitmap = await grabFrame(track, stream)
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Couldn't read the captured frame.")
    ctx.drawImage(bitmap, 0, 0)
    if (bitmap instanceof ImageBitmap) bitmap.close()
    return canvas.toDataURL("image/png")
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("Screen capture was cancelled.")
    }
    throw error
  } finally {
    stream?.getTracks().forEach((t) => t.stop())
  }
}

async function grabFrame(
  track: MediaStreamTrack,
  stream: MediaStream
): Promise<CanvasImageSource & { width: number; height: number }> {
  // ImageCapture is the clean path (Chromium); Electron has it too
  const Capture = (
    window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { grabFrame(): Promise<ImageBitmap> } }
  ).ImageCapture
  if (Capture) {
    return new Capture(track).grabFrame()
  }
  // Fallback: paint a <video> once it has a frame
  const video = document.createElement("video")
  video.srcObject = stream
  video.muted = true
  await video.play()
  await new Promise((r) => requestAnimationFrame(r))
  const frame = await createImageBitmap(video)
  video.pause()
  return frame
}
