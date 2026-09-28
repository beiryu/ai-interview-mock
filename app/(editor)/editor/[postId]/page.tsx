import { notFound, redirect } from "next/navigation"

import { db } from "@/lib/db"
import type { Post, User } from "@/lib/generated/prisma/client"
import { getCurrentUser } from "@/lib/session"
import { Editor } from "@/components/editor"

async function getPostForUser(postId: Post["id"], userId: User["id"]) {
  return await db.post.findFirst({
    where: {
      id: postId,
    },
  })
}

interface EditorPageProps {
  params: Promise<{ postId: string }>
}

export default async function EditorPage(props: EditorPageProps) {
  const params = await props.params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const post = await getPostForUser(params.postId, user.id)

  if (!post) {
    notFound()
  }

  return (
    <Editor
      post={{
        id: post.id,
        title: post.title,
        content: post.content,
        published: post.published,
      }}
    />
  )
}
