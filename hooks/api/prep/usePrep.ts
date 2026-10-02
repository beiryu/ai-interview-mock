import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { TailoredCv } from "@/lib/cv/schema"
import type { InterviewPrep, PrepStatus, ProfilePrep } from "@/lib/prep/schema"

export interface PrepState<T> {
  status: PrepStatus
  content: T | null
  error: string | null
  updatedAt: string | null
  /** Why it can't be prepared yet (no documents), else null */
  blocked: string | null
}

export interface CvState extends PrepState<TailoredCv> {
  /** Stretches you haven't approved yet (the PDF waits for them) */
  pending: number
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.blocked ?? `Request failed (${response.status})`)
  }
  return response.json()
}

/** Prep state at `url`, polled while generation is running. */
function usePrepResource<T, S extends PrepState<T> = PrepState<T>>(
  key: string[],
  url: string
) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: key,
    queryFn: () => request<S>(url),
    enabled: !url.includes("/interviews//"),
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 3000 : false),
  })
  const generate = useMutation({
    mutationFn: () => request(url, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  const save = useMutation({
    mutationFn: (content: T) =>
      request<S>(url, {
        method: "PUT",
        body: JSON.stringify(content),
      }),
    onSuccess: (state) => queryClient.setQueryData(key, state),
  })
  return { ...query, generate, save }
}

export function useProfilePrep() {
  return usePrepResource<ProfilePrep>(["prep", "profile"], "/api/prep/profile")
}

export function useInterviewPrep(interviewId: string) {
  return usePrepResource<InterviewPrep>(
    ["prep", "interview", interviewId],
    `/api/interviews/${interviewId}/prep`
  )
}

export function useTailoredCv(interviewId: string) {
  return usePrepResource<TailoredCv, CvState>(
    ["cv", interviewId],
    `/api/interviews/${interviewId}/cv`
  )
}
