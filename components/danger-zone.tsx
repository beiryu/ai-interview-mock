"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { cn } from "@/lib/utils"
import { DeleteAccount, DeleteAccountSchema } from "@/lib/validations/user"
import { useDeleteAccount } from "@/hooks/api/user/useDeleteAccount"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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

interface DangerZoneProps {
  userId: string
  className?: string
}

export function DangerZone({ userId, className }: DangerZoneProps) {
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount()
  const {
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(DeleteAccountSchema),
  })

  const confirmText = watch("confirmText")
  const isDeleteEnabled = confirmText === "DELETE"

  function onDeleteAccount() {
    deleteAccount(userId)
  }

  return (
    <Card className={cn("border-destructive", className)}>
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>Irreversible and destructive actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start space-x-3">
            <Icons.warning className="size-5 text-destructive mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-destructive">
                Delete Account
              </h4>
              <p className="text-sm text-muted-foreground">
                Once you delete your account, there is no going back. Please be
                certain. This action will:
              </p>
              <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                <li>Permanently delete your profile and account data</li>
                <li>Remove all your interviews and sessions</li>
                <li>Delete all uploaded documents and resumes</li>
                <li>Cancel any active subscriptions</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-fit">
              <Icons.trash className="mr-2 size-4" />
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                account and remove all your data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form
              onSubmit={handleSubmit(onDeleteAccount)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="confirmText">
                  Type <strong>DELETE</strong> to confirm:
                </Label>
                <Input
                  id="confirmText"
                  placeholder="DELETE"
                  {...register("confirmText")}
                />
                {errors?.confirmText && (
                  <p className="text-sm text-destructive">
                    {errors.confirmText.message}
                  </p>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  type="submit"
                  disabled={!isDeleteEnabled || isDeleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isDeleting && (
                    <Icons.spinner className="mr-2 size-4 animate-spin" />
                  )}
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}
