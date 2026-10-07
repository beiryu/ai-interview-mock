import * as z from "zod"

export const UserProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(64, "Name must be less than 64 characters"),
})

export type UserProfile = z.infer<typeof UserProfileSchema>
