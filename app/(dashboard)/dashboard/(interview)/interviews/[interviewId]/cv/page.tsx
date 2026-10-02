import { CvEditor } from "@/components/cv/cv-editor"

export const metadata = {
  title: "Tailored CV",
}

interface Props {
  params: Promise<{ interviewId: string }>
}

export default async function TailoredCvPage(props: Props) {
  const { interviewId } = await props.params

  return <CvEditor interviewId={interviewId} />
}
