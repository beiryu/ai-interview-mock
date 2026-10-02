import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Document } from "@/lib/validations/document"

const getDocuments = async (): Promise<Document[]> => {
  const response = await fetch("/api/documents")
  const data = await response.json()
  return data || []
}

export function useGetDocuments() {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const { data, isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
  })

  const filteredDocuments = useMemo(() => {
    if (!data) return []

    return data.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.type.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = typeFilter === "all" || doc.type === typeFilter

      return matchesSearch && matchesType
    })
  }, [data, searchQuery, typeFilter])

  return {
    documents: data || [],
    filteredDocuments: filteredDocuments,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
  }
}
