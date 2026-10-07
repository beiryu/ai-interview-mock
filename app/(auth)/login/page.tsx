import { Suspense } from "react"
import { Metadata } from "next"

import { Icons } from "@/components/icons"
import { UserAuthForm } from "@/components/user-auth-form"

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your account",
}

export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <Icons.logo className="mx-auto size-6" />
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to continue
          </p>
        </div>
        <Suspense fallback={<div>Loading...</div>}>
          <UserAuthForm />
        </Suspense>
      </div>
    </div>
  )
}
