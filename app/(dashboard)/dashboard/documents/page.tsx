import { Metadata } from "next"

import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog"
import { DocumentsListV2 } from "@/components/documents/documents-list-v2"
import { DashboardHeader } from "@/components/header"
import { DashboardShell } from "@/components/shell"

export const metadata: Metadata = {
  title: "Documents",
  description:
    "Your CV, portfolio and notes: what the CVs and the coach are built from. Job descriptions live on Jobs.",
}

export default async function DocumentsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Documents"
        text="Your CV, portfolio and notes: what the CVs and the coach are built from. Job descriptions live on Jobs."
      >
        <DocumentUploadDialog />
      </DashboardHeader>
      <DocumentsListV2 />
    </DashboardShell>
  )
}
