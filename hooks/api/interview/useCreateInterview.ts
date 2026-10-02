import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  CreateInterviewRequest,
  Interview,
} from "../../../lib/validations/interview"

const createInterview = async (
  payload: CreateInterviewRequest
): Promise<Interview> => {
  const response = await fetch("/api/interviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error("Failed to create interview")
  return response.json()
}

const useCreateInterview = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createInterview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
    },
  })
}

export default useCreateInterview
