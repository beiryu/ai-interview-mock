import { create } from "zustand"

interface ChatDocumentStore {
  // Document chat selection state
  selectedDocuments: string[]

  // Coach document selection state (independent from chat)
  coachDocuments: string[]

  // Fast mode: disables file search for lower latency
  fastMode: boolean

  // Session Management State
  activeSessionId: string | undefined

  // Document chat actions
  deselectDocument: (documentId: string) => void
  toggleDocument: (documentId: string) => void
  clearDocumentSelection: () => void

  // Coach document actions
  toggleCoachDocument: (documentId: string) => void
  clearCoachDocuments: () => void

  // Fast mode actions
  setFastMode: (enabled: boolean) => void

  // Session Management Actions
  setActiveSession: (sessionId: string) => void
  clearActiveSession: () => void
}

export const useChatDocumentStore = create<ChatDocumentStore>()((set) => ({
  // Initial state
  selectedDocuments: [],
  coachDocuments: [],
  fastMode: true,
  activeSessionId: undefined,

  // Document chat actions

  deselectDocument: (documentId: string) =>
    set((state) => ({
      selectedDocuments: state.selectedDocuments.filter(
        (id) => id !== documentId
      ),
    })),

  toggleDocument: (documentId: string) =>
    set((state) => ({
      selectedDocuments: state.selectedDocuments.includes(documentId)
        ? state.selectedDocuments.filter((id) => id !== documentId)
        : [...state.selectedDocuments, documentId],
    })),

  clearDocumentSelection: () => set({ selectedDocuments: [] }),

  // Coach document actions
  toggleCoachDocument: (documentId: string) =>
    set((state) => ({
      coachDocuments: state.coachDocuments.includes(documentId)
        ? state.coachDocuments.filter((id) => id !== documentId)
        : [...state.coachDocuments, documentId],
    })),

  clearCoachDocuments: () => set({ coachDocuments: [] }),

  // Fast mode actions
  setFastMode: (enabled) => set({ fastMode: enabled }),

  // Session Management Actions
  setActiveSession: (sessionId: string) => set({ activeSessionId: sessionId }),

  clearActiveSession: () => set({ activeSessionId: undefined }),
}))
