import { useMutation, useQueryClient } from "@tanstack/react-query"

import { UpdateInterviewSessionRequest } from "@/lib/validations/interview-session"

type UpdatePayload = UpdateInterviewSessionRequest & { id: string }

export const updateInterviewSession = async ({
  id,
  ...payload
}: UpdatePayload) => {
  const response = await fetch(`/api/interview-sessions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error("Failed to save session")
  return response.json()
}

const useUpdateInterviewSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateInterviewSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
    },
  })
}

export default useUpdateInterviewSession
