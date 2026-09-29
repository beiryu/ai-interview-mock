// Soniox real-time settings. Parameter names mirror the WebSocket API:
// https://soniox.com/docs/stt/rt/endpoint-detection
export const STT_DEFAULTS = {
  model: "stt-rt-v5",
  // Hints bias recognition; they don't restrict it
  languageHints: ["vi", "en"],
  // Longest Soniox waits before emitting <end> (500–3000)
  endpointMaxDelayMs: 1500,
  // -1..1: higher ends turns sooner, lower tolerates longer pauses
  endpointSensitivity: 0.3,
  // 0–3: how aggressively Soniox trades accuracy for faster endpoints
  endpointLatencyLevel: 2,
  keepAliveIntervalMs: 8000,
}

export type SttDefaults = typeof STT_DEFAULTS
