import { useChatDocumentStore } from "@/stores/chat-document-store"
import type { AgentInputItem } from "@openai/agents"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { InterviewMessage } from "@/types/interview-message"
import { MicrophoneStatus } from "@/types/interview-session"

interface InterviewSessionStore {
  // Transcription states
  microphoneStatus: MicrophoneStatus
  interviewerBuffer: string
  candidateBuffer: string
  interimText: string
  interimRole: "interviewer" | "candidate" | null
  lastSpeakTime: number

  messages: InterviewMessage[]

  // Agent memory
  agentHistory: AgentInputItem[]

  // Session states
  currentSessionId: string | null
  sessionContext: string

  setMicrophoneStatus: (status: MicrophoneStatus) => void
  /** Attach a freshly created DB session (id + context for the coach). */
  startSession: (sessionId: string, sessionContext: string) => void
  /** Clear everything from the previous session (transcript, answers, memory). */
  resetSession: () => void
  processTranscript: (
    transcript: string,
    isFinal: boolean,
    role?: "interviewer" | "candidate"
  ) => void
  flushTranscript: (role: "interviewer" | "candidate") => Promise<void>
  analyzeMessage: (
    messageId: string,
    abortSignal?: AbortSignal
  ) => Promise<void>
}

export const useInterviewSessionStore = create<InterviewSessionStore>()(
  persist(
    (set, get) => ({
      // Transcription states
      microphoneStatus: "disconnected",
      interviewerBuffer: "",
      candidateBuffer: "",
      interimText: "",
      interimRole: null,
      lastSpeakTime: Date.now(),

      messages: [],

      // Agent memory
      agentHistory: [],

      // Session states
      currentSessionId: null,
      sessionContext: "",

      // Actions
      setMicrophoneStatus: (status) => set({ microphoneStatus: status }),

      startSession: (sessionId, sessionContext) =>
        set({ currentSessionId: sessionId, sessionContext }),

      resetSession: () =>
        set({
          currentSessionId: null,
          sessionContext: "",
          messages: [],
          agentHistory: [],
          interviewerBuffer: "",
          candidateBuffer: "",
          interimText: "",
          interimRole: null,
        }),

      flushTranscript: async (role: "interviewer" | "candidate") => {
        const state = get()
        const bufferKey =
          role === "interviewer" ? "interviewerBuffer" : "candidateBuffer"
        const buffer = state[bufferKey].trim()
        if (!buffer) return

        const messageId = Date.now().toString()
        const currentIndex = state.messages.length

        // Append message synchronously so UI updates immediately
        set({
          messages: [
            ...state.messages,
            {
              id: messageId,
              role,
              content: buffer,
              messageType: "other",
              questionAnalysis: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              sessionId: state.currentSessionId ?? "",
            },
          ],
          [bufferKey]: "",
          interimText: "",
          interimRole: null,
        })

        if (role !== "interviewer") return

        // Client-side word count gate — free, no LLM round-trip
        if (buffer.trim().split(/\s+/).length < 4) return

        const context = get()
          .messages.slice(Math.max(0, currentIndex - 3), currentIndex)
          .map((m) => ({ role: m.role, content: m.content }))

        // Start analysis immediately — don't wait for classifier
        const abortController = new AbortController()
        get().analyzeMessage(messageId, abortController.signal)

        try {
          const res = await fetch("/api/assistant/classify-question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: buffer, context }),
          })
          const { isQuestion } = await res.json()

          if (!isQuestion) {
            // Not a question — abort the in-flight analysis and remove the card
            abortController.abort()
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, questionAnalysis: null } : m
              ),
            }))
          }
        } catch {
          // Fail open: analysis already started, just let it run
        }
      },

      processTranscript: (
        transcript: string,
        isFinal: boolean,
        role: "interviewer" | "candidate" = "interviewer"
      ) => {
        const now = Date.now()
        const bufferKey =
          role === "interviewer" ? "interviewerBuffer" : "candidateBuffer"

        if (isFinal) {
          set((state) => ({
            [bufferKey]: (state[bufferKey] + " " + transcript).trim(),
            lastSpeakTime: now,
          }))
        } else {
          set({
            interimText: transcript,
            interimRole: role,
            lastSpeakTime: now,
          })
        }
      },

      analyzeMessage: async (messageId: string, abortSignal?: AbortSignal) => {
        const state = get()
        const message = state.messages.find((m) => m.id === messageId)

        if (!message) return

        // Show card immediately with empty answer
        const initialAnalysis = {
          id: messageId,
          question: message.content,
          suggestedAnswer: "",
          createdAt: new Date(),
          updatedAt: new Date(),
          messageId,
        }
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, questionAnalysis: initialAnalysis } : m
          ),
        }))

        const currentIndex = state.messages.findIndex((m) => m.id === messageId)
        const context = state.messages
          .slice(Math.max(0, currentIndex - 6), currentIndex)
          .map((m) => ({ role: m.role, content: m.content }))

        try {
          const { coachDocuments, fastMode } = useChatDocumentStore.getState()

          const response = await fetch("/api/assistant/question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: message.content,
              agentHistory: get().agentHistory,
              context,
              sessionContext: get().sessionContext,
              selectedDocuments: coachDocuments,
              fastMode,
            }),
            signal: abortSignal,
          })

          const reader = response.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const line of lines) {
              if (!line.trim()) continue
              const event = JSON.parse(line)
              if (event.type === "delta") {
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === messageId && m.questionAnalysis
                      ? {
                          ...m,
                          questionAnalysis: {
                            ...m.questionAnalysis,
                            suggestedAnswer:
                              m.questionAnalysis.suggestedAnswer + event.text,
                          },
                        }
                      : m
                  ),
                }))
              } else if (event.type === "done") {
                set({ agentHistory: event.updatedHistory })
              }
            }
          }
        } catch (error) {
          if (abortSignal?.aborted) return
          console.error("Error streaming answer:", error)
        }
      },
    }),
    {
      name: "interview-agent-history",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ agentHistory: state.agentHistory }),
    }
  )
)
