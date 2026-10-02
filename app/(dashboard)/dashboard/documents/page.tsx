import { Metadata } from "next"

import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog"
import { DocumentsListV2 } from "@/components/documents/documents-list-v2"
import { DashboardHeader } from "@/components/header"
import { DashboardShell } from "@/components/shell"

export const metadata: Metadata = {
  title: "Documents",
  description: "Manage your interview documents and knowledge base.",
}

export default async function DocumentsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Documents"
        text="Manage your interview documents and knowledge base."
      >
        <DocumentUploadDialog />
      </DashboardHeader>
      <DocumentsListV2 />
    </DashboardShell>
  )
}
