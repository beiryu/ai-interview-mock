"use client"

import * as React from "react"
import type { User } from "@/lib/generated/prisma/client"
import { formatDistance } from "date-fns"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Icons } from "@/components/icons"

interface AccountOverviewProps {
  user: Pick<
    User,
    "emailVerified" | "createdAt" | "updatedAt"
  >
}

export function AccountOverview({ user }: AccountOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Overview</CardTitle>
        <CardDescription>Your account details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Verification */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Email Verification</span>
          {user.emailVerified ? (
            <Badge
              variant="secondary"
              className="flex items-center space-x-1 text-green-600"
            >
              <Icons.check className="size-3" />
              <span>Verified</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="flex items-center space-x-1 text-yellow-600"
            >
              <Icons.warning className="size-3" />
              <span>Pending</span>
            </Badge>
          )}
        </div>

        <Separator />

        {/* Account Created */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Member Since</span>
          <span className="text-sm text-muted-foreground">
            {formatDistance(new Date(user.createdAt), new Date(), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Last Updated */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Last Updated</span>
          <span className="text-sm text-muted-foreground">
            {formatDistance(new Date(user.updatedAt), new Date(), {
              addSuffix: true,
            })}
          </span>
        </div>

      </CardContent>
    </Card>
  )
}
