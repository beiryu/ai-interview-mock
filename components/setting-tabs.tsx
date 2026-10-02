"use client"

import { useGetUser } from "@/hooks/api/user/useGetUser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountOverview } from "@/components/account-overview"
import { UserProfileForm } from "@/components/user-profile-form"

interface SettingTabsProps {
  userId: string
}

export default function SettingTabs({ userId }: SettingTabsProps) {
  const { data: user } = useGetUser(userId)

  if (!user) return null

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-6">
        <UserProfileForm user={user} />
      </TabsContent>

      <TabsContent value="account" className="mt-6">
        <AccountOverview user={user} />
      </TabsContent>
    </Tabs>
  )
}
