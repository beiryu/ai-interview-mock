"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import type { User } from "@/lib/generated/prisma/client"
import { cn } from "@/lib/utils"
import { UserProfile, UserProfileSchema } from "@/lib/validations/user"
import { useUpdateProfile } from "@/hooks/api/user/useUpdateProfile"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/icons"
import { UserAvatar } from "@/components/user-avatar"

interface UserProfileFormProps extends React.HTMLAttributes<HTMLFormElement> {
  user: Pick<User, "id" | "name" | "email" | "image" | "emailVerified">
}

export function UserProfileForm({
  user,
  className,
  ...props
}: UserProfileFormProps) {
  const { mutate: updateProfile, isPending: isSaving } = useUpdateProfile()
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(UserProfileSchema),
    defaultValues: {
      name: user?.name || "",
    },
  })

  function onSubmit(data: UserProfile) {
    updateProfile({
      userId: user.id,
      ...data,
    })
  }

  return (
    <form
      className={cn(className)}
      onSubmit={handleSubmit(onSubmit)}
      {...props}
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Your display name. Email comes from your sign-in method.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4">
            <UserAvatar
              user={{ name: user.name, image: user.image }}
              className="size-20"
            />
          </div>

          {/* Name Field */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              className="max-w-md"
              {...register("name")}
            />
            {errors?.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email Field */}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className="max-w-md"
              value={user.email}
              readOnly
              disabled
            />
            <div className="flex items-center space-x-2">
              {user.emailVerified ? (
                <>
                  <Icons.check className="size-4 text-green-600" />
                  <span className="text-sm text-green-600">Verified</span>
                </>
              ) : (
                <>
                  <Icons.warning className="size-4 text-yellow-600" />
                  <span className="text-sm text-yellow-600">Not verified</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving} className="w-fit">
            {isSaving && <Icons.spinner className="mr-2 size-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
