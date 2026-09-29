import { useMutation, useQueryClient } from "@tanstack/react-query"

import { CreateDocumentRequest } from "@/lib/validations/document"

const uploadDocument = async (document: CreateDocumentRequest) => {
  // Create FormData for LangChain documents API
  const formData = new FormData()

  // Add text data
  formData.append("title", document.title)
  formData.append("type", document.type)

  // Create a plain text file from the content
  const textBlob = new Blob([document.content], { type: "text/plain" })
  formData.append(
    "file",
    textBlob,
    `${document.title.replace(/\s+/g, "_")}.txt`
  )

  // Send as multipart/form-data (no Content-Type header needed)
  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to upload document")
  }

  return await response.json()
}

export default function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    },
  })
}
