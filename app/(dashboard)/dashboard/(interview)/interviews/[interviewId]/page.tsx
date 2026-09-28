import { cookies } from "next/headers"

import { LiveInterviewPlaygroundV2 } from "@/components/live-interview-playground-v2"

interface LiveInterviewDetailPageProps {
  params: Promise<{
    interviewId: string
  }>
}

export default async function LiveInterviewDetailPage(
  props: LiveInterviewDetailPageProps
) {
  const params = await props.params
  const layout = (await cookies()).get("react-resizable-panels:layout:mail")
  const collapsed = (await cookies()).get("react-resizable-panels:collapsed")

  const defaultLayout = layout ? JSON.parse(layout.value) : undefined
  const defaultCollapsed = collapsed ? JSON.parse(collapsed.value) : undefined

  const { interviewId } = params

  if (!interviewId) {
    return null
  }

  return (
    <div className="flex flex-col gap-12">
      <LiveInterviewPlaygroundV2
        interviewId={interviewId}
        defaultLayout={defaultLayout}
      />
    </div>
  )
}
