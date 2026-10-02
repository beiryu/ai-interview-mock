import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { UserProfileSchema } from "@/lib/validations/user"

const routeContextSchema = z.object({
  params: z.object({
    userId: z.string(),
  }),
})

type RouteContext = {
  params: Promise<z.infer<typeof routeContextSchema>["params"]>
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { userId } = await context.params
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user || userId !== session.user.id) {
      return new Response("Unauthorized", { status: 403 })
    }

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        image: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    // Validate the route context.
    const { params } = routeContextSchema.parse({
      params: await context.params,
    })

    // Ensure user is authentication and has access to this user.
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user || params.userId !== session?.user.id) {
      return new Response(null, { status: 403 })
    }

    // Get the request body and validate it.
    const body = await req.json()
    const payload = UserProfileSchema.parse(body)

    // Update the user.
    await db.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        name: payload.name,
      },
    })

    return new Response(null, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), { status: 422 })
    }

    return new Response(null, { status: 500 })
  }
}
