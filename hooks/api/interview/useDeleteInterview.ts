import { useMutation, useQueryClient } from "@tanstack/react-query"

const deleteInterview = async (id: string): Promise<void> => {
  const response = await fetch(`/api/interviews/${id}`, {
    method: "DELETE",
  })
  if (!response.ok) throw new Error("Failed to delete interview")
}

export function useDeleteInterview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteInterview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
    },
  })
}
