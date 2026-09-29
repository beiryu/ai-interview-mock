import { useQuery } from "@tanstack/react-query"

import type { Interview } from "@/lib/validations/interview"
import type { InterviewSessionSummary } from "@/lib/validations/interview-session"

export type InterviewWithSessions = Interview & {
  sessions: InterviewSessionSummary[]
}

const getInterview = async (id: string): Promise<InterviewWithSessions> => {
  const response = await fetch(`/api/interviews/${id}`)
  if (!response.ok) throw new Error("Failed to load interview")
  return response.json()
}

export function useGetInterview(id: string) {
  return useQuery({
    queryKey: ["interviews", id],
    queryFn: () => getInterview(id),
    enabled: !!id,
  })
}
