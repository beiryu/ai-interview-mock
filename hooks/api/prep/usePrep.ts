import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { JobPrep, PrepStatus } from "@/lib/prep/schema"

export interface PrepState<T> {
  status: PrepStatus
  content: T | null
  error: string | null
  updatedAt: string | null
  /** Why it can't be prepared yet (no CV), else null */
  blocked: string | null
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message =
      (typeof body?.error === "string" && body.error) ||
      body?.blocked ||
      `Request failed (${response.status})`
    throw new Error(message)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

/** The job's prep, polled while it is being prepared. */
export function useJobPrep(jobId: string) {
  const queryClient = useQueryClient()
  const key = ["prep", "job", jobId]
  const url = `/api/jobs/${jobId}/prep`
  const query = useQuery({
    queryKey: key,
    queryFn: () => request<PrepState<JobPrep>>(url),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 3000 : false),
  })
  const generate = useMutation({
    mutationFn: () => request(url, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  const save = useMutation({
    mutationFn: (content: JobPrep) =>
      request<PrepState<JobPrep>>(url, {
        method: "PUT",
        body: JSON.stringify(content),
      }),
    onSuccess: (state) => queryClient.setQueryData(key, state),
  })
  return { ...query, generate, save }
}
