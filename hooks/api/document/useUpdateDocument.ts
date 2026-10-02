import { useMutation, useQueryClient } from "@tanstack/react-query"

import { UpdateDocumentRequest } from "@/lib/validations/document"

const updateDocument = async (
  id: string,
  data: UpdateDocumentRequest
): Promise<any> => {
  const response = await fetch(`/api/documents/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? "Failed to update the document")
  }

  return response.json()
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentRequest }) =>
      updateDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      queryClient.invalidateQueries({ queryKey: ["prep"] })
    },
  })
}
