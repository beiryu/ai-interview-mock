import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { InterviewSessionSummary } from "@/lib/validations/interview-session"
import type {
  CreateJobRequest,
  Job,
  UpdateJobRequest,
} from "@/lib/validations/job"

export type JobWithSessions = Job & { sessions: InterviewSessionSummary[] }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) {
    // Validation errors come back as a list of zod issues
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body) ? body[0]?.message : null
    throw new Error(message ?? `Request failed (${response.status})`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export function useGetJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => request<Job[]>("/api/jobs"),
  })
}

export function useGetJob(id: string) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => request<JobWithSessions>(`/api/jobs/${id}`),
    enabled: !!id,
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateJobRequest) =>
      request<Job>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateJobRequest & { id: string }) =>
      request<Job>(`/api/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_job, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      // The JD or title feed the CV and prep (they may now be out of date)
      queryClient.invalidateQueries({ queryKey: ["cv", id] })
      queryClient.invalidateQueries({ queryKey: ["prep", "job", id] })
    },
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request<void>(`/api/jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  })
}
