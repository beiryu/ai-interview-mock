import { useMutation, useQueryClient } from "@tanstack/react-query"

import { CreateDocumentRequest } from "@/lib/validations/document"

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  return (body && typeof body.error === "string" && body.error) || fallback
}

const uploadDocument = async (document: CreateDocumentRequest) => {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Failed to save the document"))
  }
  return response.json()
}

export default function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      // Documents feed the prep pack; its "out of date" state is recomputed
      queryClient.invalidateQueries({ queryKey: ["prep"] })
    },
  })
}

/** Turns a PDF/DOCX/TXT/MD file into text on the server (nothing saved). */
export function useExtractDocument() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/documents/extract", {
        method: "POST",
        body: form,
      })
      if (!response.ok) {
        throw new Error(await errorMessage(response, "Couldn't read this file"))
      }
      return (await response.json()) as { title: string; content: string }
    },
  })
}
