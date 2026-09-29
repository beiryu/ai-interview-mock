/**
 * End-to-end smoke test for Soniox + TurnEngine without a microphone.
 *
 * Synthesizes an interviewer track with macOS `say` (Vietnamese "Linh",
 * English "Samantha"), streams it to Soniox in real time as 16 kHz PCM, and
 * feeds the turn engine exactly like the browser does. Prints transcripts,
 * detected languages, <end> endpoints and commits with their latency.
 *
 *   pnpm tsx --env-file=.env scripts/stt-smoke.mts
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { INTERVIEW_DEFAULTS } from "../config/defaults/interview"
import { STT_DEFAULTS } from "../config/defaults/stt"
import { SonioxStream } from "../lib/stt/soniox-stream"
import { TurnEngine } from "../lib/turn/turn-engine"

const RATE = 16000
const CHUNK = 1920 // 120 ms

type Segment =
  | { kind: "speech"; voice: string; text: string; label: string }
  | { kind: "silence"; ms: number }

// Each question should become exactly one committed turn. The English one
// has a 1.2 s thinking pause mid-sentence that must NOT split it.
const SCRIPT: Segment[] = [
  { kind: "silence", ms: 500 },
  {
    kind: "speech",
    voice: "Linh",
    text: "Em hãy giới thiệu về dự án gần nhất mà em đã làm được không",
    label: "VI question",
  },
  { kind: "silence", ms: 2500 },
  {
    kind: "speech",
    voice: "Samantha",
    text: "Tell me about a time when you and",
    label: "EN question, part 1",
  },
  { kind: "silence", ms: 1200 },
  {
    kind: "speech",
    voice: "Samantha",
    text: "your team strongly disagreed on a technical decision?",
    label: "EN question, part 2",
  },
  { kind: "silence", ms: 3000 },
]

function synthesize(voice: string, text: string, dir: string, i: number) {
  const aiff = path.join(dir, `${i}.aiff`)
  const wav = path.join(dir, `${i}.wav`)
  execFileSync("say", ["-v", voice, "-o", aiff, text])
  execFileSync("afconvert", [
    "-f",
    "WAVE",
    "-d",
    `LEI16@${RATE}`,
    "-c",
    "1",
    aiff,
    wav,
  ])
  const data = readFileSync(wav)
  // Find the "data" chunk instead of assuming a 44-byte header
  const offset = data.indexOf("data") + 8
  return new Int16Array(data.buffer.slice(data.byteOffset + offset))
}

function rms(samples: Int16Array) {
  let sum = 0
  for (const s of samples) sum += (s / 32768) ** 2
  return Math.sqrt(sum / samples.length)
}

async function main() {
  const apiKey = process.env.SONIOX_API_KEY
  if (!apiKey) throw new Error("Set SONIOX_API_KEY in .env")

  const dir = mkdtempSync(path.join(tmpdir(), "stt-smoke-"))
  const pieces: { samples: Int16Array; label?: string }[] = SCRIPT.map(
    (segment, i) =>
      segment.kind === "silence"
        ? { samples: new Int16Array((RATE * segment.ms) / 1000) }
        : {
            samples: synthesize(segment.voice, segment.text, dir, i),
            label: segment.label,
          }
  )

  const t0 = Date.now()
  const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`
  let lastSpeechEnd = 0

  // No judge here (it needs the app server): the engine falls back to its
  // text heuristics, i.e. this exercises Soniox timing + local rules only.
  const engine = new TurnEngine(INTERVIEW_DEFAULTS, {
    onFinalizeRequest: () => stream.finalize(),
    onPause: (text) => console.log(`${at()}  ⏸ pause → judge + draft: ${text}`),
    onResume: () => console.log(`${at()}  ▶ resumed, draft dropped`),
    onStatus: (status) => console.log(`${at()}  status: ${status}`),
    onCommit: (turn) =>
      console.log(
        `${at()}  ✅ COMMIT [${turn.reason}, lang=${turn.language}, ` +
          `answerable=${turn.answerable}, <end> lag=${
            turn.endpointLagMs ?? "-"
          }ms, ` +
          `${Date.now() - lastSpeechEnd}ms after speech ended]: ${turn.text}`
      ),
  })

  const stream = new SonioxStream(
    async () => apiKey,
    { ...STT_DEFAULTS, contextTerms: ["rate limiter"] },
    {
      onUpdate: (update) => {
        if (update.finalChunk.trim()) {
          const langs = Object.keys(update.languageChars).join(",")
          console.log(`${at()}  final [${langs}]: ${update.finalChunk.trim()}`)
        }
        engine.onTranscript("interviewer", update, Date.now())
      },
      onEndpoint: ({ lagMs }) => {
        console.log(`${at()}  <end> (lag ${lagMs ?? "-"}ms)`)
        engine.onEndpoint("interviewer", lagMs)
      },
      onStatus: (status) => console.log(`${at()}  socket: ${status}`),
      onError: (error) => console.error(`${at()}  ERROR ${error.message}`),
    }
  )
  await stream.start()

  const ticker = setInterval(() => engine.tick(Date.now()), 100)

  // Stream in real time, 120 ms per chunk
  for (const piece of pieces) {
    if (piece.label) console.log(`${at()}  ▶ speaking: ${piece.label}`)
    for (let i = 0; i < piece.samples.length; i += CHUNK) {
      const chunk = piece.samples.slice(i, i + CHUNK)
      const level = rms(chunk)
      stream.send(chunk.buffer, level >= 0.015)
      engine.onAudioLevel("interviewer", level, Date.now())
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    if (piece.label) lastSpeechEnd = Date.now()
  }

  clearInterval(ticker)
  stream.stop()
  await new Promise((resolve) => setTimeout(resolve, 1500))
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
