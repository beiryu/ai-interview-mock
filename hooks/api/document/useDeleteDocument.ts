import { useMutation, useQueryClient } from "@tanstack/react-query"

const deleteDocument = async (id: string): Promise<void> => {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error("Failed to delete document")
  }
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    },
  })
}
