"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { User } from "@/lib/generated/prisma/client"
import { useForm } from "react-hook-form"

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
  user: Pick<
    User,
    "id" | "name" | "email" | "phone" | "image" | "emailVerified"
  >
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
      email: user?.email || "",
      phone: user?.phone || "",
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
            Update your personal information and profile details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4">
            <UserAvatar
              user={{ name: user.name, image: user.image }}
              className="size-20"
            />
            <div className="space-y-2">
              <Button variant="outline" size="sm" disabled>
                Change avatar
              </Button>
              <p className="text-sm text-muted-foreground">
                JPG, GIF or PNG. 1MB max.
              </p>
            </div>
          </div>

          {/* Name Field */}
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              className="max-w-md"
              {...register("name")}
            />
            {errors?.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email Field */}
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="max-w-md"
              {...register("email")}
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
            {errors?.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Phone Field */}
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              className="max-w-md"
              {...register("phone")}
            />
            {errors?.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
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
