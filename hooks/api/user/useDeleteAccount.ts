import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"
import { toast } from "@/components/ui/use-toast"

const deleteAccount = async (userId: string): Promise<void> => {
  const response = await fetch(`/api/users/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response?.ok) {
    throw new Error("Failed to delete account")
  }
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      toast({
        description: "Your account has been deleted successfully.",
      })

      // Clear all cached data
      queryClient.clear()

      // Sign out and redirect
      await authClient.signOut()
      router.push("/")
    },
    onError: (error) => {
      toast({
        title: "Something went wrong.",
        description: "Your account could not be deleted. Please try again.",
        variant: "destructive",
      })
    },
  })
}
