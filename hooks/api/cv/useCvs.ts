import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { CvContent, CvOrigin } from "@/lib/cv/schema"
import type { PrepStatus } from "@/lib/prep/schema"
import type { CvSource } from "@/lib/validations/job"
import { request } from "@/hooks/api/prep/usePrep"

export interface CvSummary {
  id: string
  title: string
  origin: CvOrigin
  basedOn: { id: string; title: string } | null
  job: { id: string; company: string; title: string } | null
}

export interface CvState {
  status: PrepStatus
  content: CvContent | null
  error: string | null
  updatedAt: string | null
  blocked: string | null
  /** Stretches you haven't approved yet (the PDF waits for them) */
  pending: number
  cv: CvSummary | null
  /** Source bullet id → its text, for a refined CV's "from" chips */
  sourceLabels: Record<string, string>
}

export interface CvListItem extends CvSummary {
  status: string
  headline: string
  pending: number
  updatedAt: string
}

const poll = (status?: string) => (status === "pending" ? 3000 : false)

export function useCvs() {
  return useQuery({
    queryKey: ["cvs"],
    queryFn: () => request<CvListItem[]>("/api/cvs"),
    refetchInterval: (q) =>
      q.state.data?.some((cv) => cv.status === "pending") ? 3000 : false,
  })
}

/** A CV by id: edit it, rebuild it, delete it. */
export function useCv(cvId: string) {
  const queryClient = useQueryClient()
  const key = ["cvs", cvId]
  const url = `/api/cvs/${cvId}`
  const query = useQuery({
    queryKey: key,
    queryFn: () => request<CvState>(url),
    enabled: !!cvId,
    refetchInterval: (q) => poll(q.state.data?.status),
  })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cvs"] })
    queryClient.invalidateQueries({ queryKey: ["jobs"] })
  }
  const save = useMutation({
    mutationFn: (body: { content: CvContent; title?: string }) =>
      request<CvState>(url, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (state) => {
      queryClient.setQueryData(key, state)
      invalidate()
    },
  })
  const rebuild = useMutation({
    mutationFn: () => request(url, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: () => request<void>(url, { method: "DELETE" }),
    onSuccess: invalidate,
  })
  return { ...query, save, rebuild, remove }
}

/** A job's CV: make it from a source, rebuild it, edit it. */
export function useJobCv(jobId: string) {
  const queryClient = useQueryClient()
  const key = ["cv", jobId]
  const url = `/api/jobs/${jobId}/cv`
  const query = useQuery({
    queryKey: key,
    queryFn: () => request<CvState>(url),
    enabled: !!jobId,
    refetchInterval: (q) => poll(q.state.data?.status),
  })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ["cvs"] })
    queryClient.invalidateQueries({ queryKey: ["jobs"] })
    queryClient.invalidateQueries({ queryKey: ["prep", "job", jobId] })
  }
  const start = useMutation({
    mutationFn: (source?: CvSource) =>
      request(url, { method: "POST", body: JSON.stringify({ source }) }),
    onSuccess: invalidate,
  })
  const save = useMutation({
    mutationFn: ({ cvId, content }: { cvId: string; content: CvContent }) =>
      request<CvState>(`/api/cvs/${cvId}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
    onSuccess: invalidate,
  })
  return { ...query, start, save }
}

export function useUploadCv() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; rawText: string }) =>
      request<{ id: string }>("/api/cvs", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cvs"] }),
  })
}

/** Turns a PDF/DOCX/TXT/MD file into text on the server (nothing saved). */
export function useExtractFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/cvs/extract", {
        method: "POST",
        body: form,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? "Couldn't read this file")
      }
      return (await response.json()) as { title: string; content: string }
    },
  })
}
