import { useQuery } from "@tanstack/react-query"

import type { User } from "@/lib/generated/prisma/client"

const getUser = async (userId: string): Promise<User | null> => {
  const response = await fetch(`/api/users/${userId}`, { method: "GET" })

  return response.json()
}

export function useGetUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
