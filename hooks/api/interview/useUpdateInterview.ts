import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Interview, UpdateInterviewRequest } from "@/lib/validations/interview"

const updateInterview = async (
  payload: UpdateInterviewRequest
): Promise<Interview> => {
  const response = await fetch(`/api/interviews/${payload.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error("Failed to update interview")
  return response.json()
}

export function useUpdateInterview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateInterview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
    },
  })
}
