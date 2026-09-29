import { LiveInterviewPlaygroundV2 } from "@/components/live-interview-playground-v2"

interface LiveInterviewDetailPageProps {
  params: Promise<{ interviewId: string }>
}

export default async function LiveInterviewDetailPage(
  props: LiveInterviewDetailPageProps
) {
  const { interviewId } = await props.params

  return <LiveInterviewPlaygroundV2 interviewId={interviewId} />
}
