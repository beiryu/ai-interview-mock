"use client"

import { useState } from "react"
import { format } from "date-fns"
import { MoreHorizontal } from "lucide-react"

import { Document } from "@/lib/validations/document"
import { useGetDocuments } from "@/hooks/api/document/useGetDocuments"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyPlaceholder } from "@/components/empty-placeholder"
import { Icons } from "@/components/icons"
import DeleteDocumentDialog from "@/components/modals/delete-document-modal"
import EditDocumentDialog from "@/components/modals/edit-document-modal"

const documentTypeLabels = {
  RESUME: "Resume",
  JOB_DESCRIPTION: "Job Description",
  PORTFOLIO: "Portfolio",
  COVER_LETTER: "Cover Letter",
  NOTES: "Notes",
  PROJECT_DOCUMENTATION: "Project Docs",
}

const documentTypeColors = {
  RESUME: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  JOB_DESCRIPTION:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PORTFOLIO:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  COVER_LETTER:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  NOTES: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  PROJECT_DOCUMENTATION:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
}

const documentTypeIcons = {
  RESUME: Icons.user,
  JOB_DESCRIPTION: Icons.briefcase,
  PORTFOLIO: Icons.folder,
  COVER_LETTER: Icons.mail,
  NOTES: Icons.fileText,
  PROJECT_DOCUMENTATION: Icons.folder,
}

const getDocumentIcon = (type: string) => {
  const IconComponent =
    documentTypeIcons[type as keyof typeof documentTypeIcons] || Icons.fileText
  return IconComponent
}

export function DocumentsListV2() {
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(
    null
  )

  const {
    documents,
    filteredDocuments,
    isLoading,
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
  } = useGetDocuments()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <EmptyPlaceholder>
        <EmptyPlaceholder.Icon name="post" />
        <EmptyPlaceholder.Title>No documents uploaded</EmptyPlaceholder.Title>
        <EmptyPlaceholder.Description>
          You haven&apos;t uploaded any documents yet. Start by uploading your
          resume or job descriptions to get personalized interview assistance.
        </EmptyPlaceholder.Description>
      </EmptyPlaceholder>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(documentTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredDocuments.length} of {documents.length} document
            {documents.length !== 1 ? "s" : ""} shown
          </p>
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Icons.search className="mx-auto size-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No documents found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((document) => {
            const IconComponent = getDocumentIcon(document.type)
            return (
              <Card
                key={document.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-base">
                        <div className="flex items-center space-x-2 min-w-0">
                          <IconComponent className="size-4 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1 min-w-0">
                            {document.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`shrink-0 ${
                              documentTypeColors[
                                document.type as keyof typeof documentTypeColors
                              ]
                            }`}
                          >
                            {
                              documentTypeLabels[
                                document.type as keyof typeof documentTypeLabels
                              ]
                            }
                          </Badge>
                        </div>
                      </CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="flex items-center p-1 hover:bg-muted/50 rounded cursor-pointer">
                          <MoreHorizontal className="size-4" />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingDocument(document)}
                        >
                          <Icons.edit className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletingDocument(document)}
                          className="text-destructive"
                        >
                          <Icons.trash className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Uploaded</span>
                      <span>
                        {format(new Date(document.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    {document.updatedAt !== document.createdAt && (
                      <div className="flex items-center justify-between">
                        <span>Updated</span>
                        <span>
                          {format(new Date(document.updatedAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingDocument && (
        <Dialog
          open={!!editingDocument}
          onOpenChange={() => setEditingDocument(null)}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <EditDocumentDialog
              document={editingDocument}
              onClose={() => setEditingDocument(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Modal */}
      {deletingDocument && (
        <DeleteDocumentDialog
          document={deletingDocument}
          isOpen={!!deletingDocument}
          showActionToggle={(open) =>
            setDeletingDocument(open ? deletingDocument : null)
          }
        />
      )}
    </div>
  )
}
