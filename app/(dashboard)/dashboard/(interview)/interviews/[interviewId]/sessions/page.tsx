import { InterviewSessions } from "@/components/interviews/interview-sessions"

export const metadata = {
  title: "Past sessions",
}

interface Props {
  params: Promise<{ interviewId: string }>
}

export default async function InterviewSessionsPage(props: Props) {
  const { interviewId } = await props.params

  return <InterviewSessions interviewId={interviewId} />
}
