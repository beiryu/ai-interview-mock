/**
 * Minimal Soniox real-time client (stt-rt-v5) over a raw WebSocket.
 *
 * Framework-free so it runs in the browser and in Node 22 (global WebSocket),
 * which lets scripts/stt-smoke.mts exercise it without a microphone.
 *
 * Protocol: https://soniox.com/docs/stt/api-reference/websocket-api
 */

const SONIOX_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket"
const END_TOKEN = "<end>"
const FIN_TOKEN = "<fin>"
const MAX_PENDING_BYTES = 16000 * 2 * 5 // ~5 s of 16 kHz s16 audio

export type SttLanguage = string // ISO 639-1, e.g. "vi", "en"

export interface SonioxStreamConfig {
  model: string
  languageHints: SttLanguage[]
  endpointMaxDelayMs: number
  endpointSensitivity: number
  endpointLatencyLevel: number
  keepAliveIntervalMs: number
  /** Domain terms (company, role, tech words) to improve recognition */
  contextTerms?: string[]
  contextText?: string
  clientReferenceId?: string
}

export interface SttUpdate {
  /** Text finalized by this message (append once) */
  finalChunk: string
  /** Current non-final tail (replace on every update) */
  partial: string
  /** Characters of finalized text per language in this message */
  languageChars: Record<SttLanguage, number>
}

export type SttStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"

export interface SonioxStreamHandlers {
  onUpdate?: (update: SttUpdate) => void
  /** Soniox semantic endpoint (`<end>`): the speaker likely finished */
  onEndpoint?: () => void
  onStatus?: (status: SttStatus) => void
  onError?: (error: Error) => void
}

interface SonioxToken {
  text: string
  is_final: boolean
  language?: string
}

interface SonioxMessage {
  tokens?: SonioxToken[]
  finished?: boolean
  error_code?: number
  error_type?: string
  error_message?: string
}

export class SonioxStream {
  private ws: WebSocket | null = null
  private status: SttStatus = "idle"
  private closedByUser = false
  private pending: ArrayBuffer[] = []
  private pendingBytes = 0
  private lastSendAt = 0
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempt = 0

  constructor(
    private readonly getApiKey: () => Promise<string>,
    private readonly config: SonioxStreamConfig,
    private readonly handlers: SonioxStreamHandlers = {}
  ) {}

  async start() {
    this.closedByUser = false
    await this.connect()
  }

  /** Send one chunk of 16 kHz mono pcm_s16le audio. */
  send(pcm: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcm)
      this.lastSendAt = Date.now()
      return
    }
    // Buffer briefly while (re)connecting; drop the oldest beyond ~5 s
    this.pending.push(pcm)
    this.pendingBytes += pcm.byteLength
    while (this.pendingBytes > MAX_PENDING_BYTES && this.pending.length) {
      this.pendingBytes -= this.pending.shift()!.byteLength
    }
  }

  /** Ask the server to finalize everything heard so far (returns `<fin>`). */
  finalize() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "finalize" }))
    }
  }

  /** Graceful stop: flush remaining audio, then close. */
  stop() {
    this.closedByUser = true
    this.clearKeepAlive()
    const ws = this.ws
    this.ws = null
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(new ArrayBuffer(0)) // end-of-audio signal
      setTimeout(() => ws.close(), 1500)
    } else {
      ws?.close()
    }
    this.setStatus("closed")
  }

  private async connect() {
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting")

    let apiKey: string
    try {
      apiKey = await this.getApiKey()
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)))
      return
    }
    if (this.closedByUser) return

    const ws = new WebSocket(SONIOX_WS_URL)
    ws.binaryType = "arraybuffer"
    this.ws = ws

    ws.onopen = () => {
      ws.send(JSON.stringify(this.buildConfigMessage(apiKey)))
      this.reconnectAttempt = 0
      this.setStatus("open")
      for (const chunk of this.pending) ws.send(chunk)
      this.pending = []
      this.pendingBytes = 0
      this.lastSendAt = Date.now()
      this.startKeepAlive()
    }

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return
      this.handleMessage(JSON.parse(event.data) as SonioxMessage)
    }

    ws.onclose = () => {
      this.clearKeepAlive()
      if (this.ws !== ws) return // replaced or stopped
      this.ws = null
      if (this.closedByUser) {
        this.setStatus("closed")
        return
      }
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose follows and handles reconnects
    }
  }

  private handleMessage(message: SonioxMessage) {
    if (message.error_code) {
      const error = new Error(
        `Soniox ${message.error_code} ${message.error_type ?? ""}: ${
          message.error_message ?? ""
        }`.trim()
      )
      // 4xx other than max duration are configuration problems: don't loop
      const retryable =
        message.error_code >= 500 ||
        message.error_type === "max_duration_reached"
      if (!retryable) this.closedByUser = true
      this.handlers.onError?.(error)
      return
    }

    const tokens = message.tokens ?? []
    if (tokens.length === 0) return

    let finalChunk = ""
    let partial = ""
    let sawEndpoint = false
    const languageChars: Record<string, number> = {}

    for (const token of tokens) {
      if (token.text === END_TOKEN) {
        sawEndpoint = true
        continue
      }
      if (token.text === FIN_TOKEN) continue

      if (token.is_final) {
        finalChunk += token.text
        if (token.language) {
          languageChars[token.language] =
            (languageChars[token.language] ?? 0) + token.text.trim().length
        }
      } else {
        partial += token.text
      }
    }

    this.handlers.onUpdate?.({ finalChunk, partial, languageChars })
    if (sawEndpoint) this.handlers.onEndpoint?.()
  }

  private buildConfigMessage(apiKey: string) {
    const { config } = this
    const terms = config.contextTerms?.filter(Boolean) ?? []
    return {
      api_key: apiKey,
      model: config.model,
      audio_format: "pcm_s16le",
      sample_rate: 16000,
      num_channels: 1,
      language_hints: config.languageHints,
      enable_language_identification: true,
      enable_endpoint_detection: true,
      max_endpoint_delay_ms: config.endpointMaxDelayMs,
      endpoint_sensitivity: config.endpointSensitivity,
      endpoint_latency_adjustment_level: config.endpointLatencyLevel,
      ...(terms.length || config.contextText
        ? {
            context: {
              general: [{ key: "domain", value: "job interview" }],
              ...(config.contextText ? { text: config.contextText } : {}),
              ...(terms.length ? { terms } : {}),
            },
          }
        : {}),
      ...(config.clientReferenceId
        ? { client_reference_id: config.clientReferenceId }
        : {}),
    }
  }

  private startKeepAlive() {
    this.clearKeepAlive()
    this.keepAliveTimer = setInterval(() => {
      const idleFor = Date.now() - this.lastSendAt
      if (
        this.ws?.readyState === WebSocket.OPEN &&
        idleFor >= this.config.keepAliveIntervalMs
      ) {
        this.ws.send(JSON.stringify({ type: "keepalive" }))
        this.lastSendAt = Date.now()
      }
    }, this.config.keepAliveIntervalMs)
  }

  private clearKeepAlive() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer)
    this.keepAliveTimer = null
  }

  private scheduleReconnect() {
    const delay = Math.min(5000, 500 * 2 ** this.reconnectAttempt)
    this.reconnectAttempt++
    this.setStatus("reconnecting")
    setTimeout(() => {
      if (!this.closedByUser) void this.connect()
    }, delay)
  }

  private fail(error: Error) {
    this.handlers.onError?.(error)
    // e.g. the server has no SONIOX_API_KEY: retrying won't help
    if ((error as Error & { retryable?: boolean }).retryable === false) {
      this.closedByUser = true
      this.setStatus("closed")
      return
    }
    if (!this.closedByUser) this.scheduleReconnect()
  }

  private setStatus(status: SttStatus) {
    if (this.status === status) return
    this.status = status
    this.handlers.onStatus?.(status)
  }
}
