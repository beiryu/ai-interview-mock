import { create } from "zustand"

/** Document Chat state: which documents the chat searches, active session. */
interface ChatDocumentStore {
  selectedDocuments: string[]
  activeSessionId: string | undefined

  deselectDocument: (documentId: string) => void
  toggleDocument: (documentId: string) => void
  clearDocumentSelection: () => void

  setActiveSession: (sessionId: string) => void
  clearActiveSession: () => void
}

export const useChatDocumentStore = create<ChatDocumentStore>()((set) => ({
  selectedDocuments: [],
  activeSessionId: undefined,

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

  setActiveSession: (sessionId: string) => set({ activeSessionId: sessionId }),

  clearActiveSession: () => set({ activeSessionId: undefined }),
}))
