import { useMutation } from "@tanstack/react-query"

import { CreateInterviewSessionRequest } from "@/lib/validations/interview-session"

type CreatedSession = { id: string; sessionContext: string | null }

const createInterviewSession = async (
  payload: CreateInterviewSessionRequest
): Promise<CreatedSession> => {
  const response = await fetch("/api/interview-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error("Failed to start session")
  return response.json()
}

const useCreateInterviewSession = () => {
  return useMutation({
    mutationFn: createInterviewSession,
  })
}

export default useCreateInterviewSession
