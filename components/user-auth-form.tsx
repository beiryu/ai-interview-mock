"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { authClient } from "@/lib/auth-client"
import { parseMagicLink } from "@/lib/desktop/magic-link"
import { cn } from "@/lib/utils"
import { userAuthSchema } from "@/lib/validations/auth"
import { useDesktop } from "@/hooks/use-desktop"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

type FormData = z.infer<typeof userAuthSchema>

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(userAuthSchema),
  })
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const searchParams = useSearchParams()
  const desktop = useDesktop()

  async function onSubmit(data: FormData) {
    setIsLoading(true)

    const { error } = await authClient.signIn.magicLink({
      email: data.email.toLowerCase(),
      callbackURL: searchParams?.get("from") || "/dashboard",
    })

    setIsLoading(false)

    if (error) {
      return toast({
        title: "Something went wrong.",
        description: "Your sign in request failed. Please try again.",
        variant: "destructive",
      })
    }

    return toast({
      title: "Check your email",
      description: "We sent you a login link. Be sure to check your spam too.",
    })
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              {...register("email")}
            />
            {errors?.email && (
              <p className="px-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>
          <button className={cn(buttonVariants())} disabled={isLoading}>
            {isLoading && (
              <Icons.spinner className="mr-2 size-4 animate-spin" />
            )}
            Sign In with Email
          </button>
        </div>
      </form>
      {desktop && <PasteMagicLink />}
    </div>
  )
}

/**
 * Desktop app only: the emailed link opens in the system browser, so the
 * session would land there. Pasting it here signs this window in instead.
 */
function PasteMagicLink() {
  const [link, setLink] = React.useState("")
  const [invalid, setInvalid] = React.useState(false)

  return (
    <form
      className="grid gap-2 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        const url = parseMagicLink(link, window.location.origin)
        if (!url) {
          setInvalid(true)
          return
        }
        window.location.assign(url)
      }}
    >
      <Label htmlFor="magic-link" className="text-xs text-muted-foreground">
        Desktop app: copy the link from the email (don&apos;t open it) and paste
        it here
      </Label>
      <Input
        id="magic-link"
        placeholder="http://localhost:3000/api/auth/magic-link/verify?token=…"
        value={link}
        onChange={(event) => {
          setLink(event.target.value)
          setInvalid(false)
        }}
      />
      {invalid && (
        <p className="px-1 text-xs text-red-600">
          That isn&apos;t a sign-in link for this app.
        </p>
      )}
      <button
        className={cn(buttonVariants({ variant: "outline" }))}
        disabled={!link.trim()}
      >
        Sign in with link
      </button>
    </form>
  )
}
