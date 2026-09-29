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
