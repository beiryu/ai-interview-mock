/**
 * Reads an uploaded plain-text file in the browser before it is sent to
 * /api/documents (stored as text; the prep pack and coach read it).
 */

import { toast } from "@/components/ui/use-toast"

export interface FileUploadResult {
  title?: string
  content?: string
  error?: string
}

/**
 * Handle file upload and basic content extraction
 */
export const handleFileUpload = async (
  file: File,
  onSuccess: (result: FileUploadResult) => void,
  onError: (message: string) => void
): Promise<void> => {
  // Validate file size (10MB max)
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  if (file.size > MAX_FILE_SIZE) {
    toast({
      title: "File too large",
      description: "Please upload a file smaller than 10MB",
      variant: "destructive",
    })
    onError("File size exceeds maximum allowed (10MB)")
    return
  }

  // Only plain text is supported
  const allowedTypes = ["text/plain"]

  if (!allowedTypes.includes(file.type)) {
    toast({
      title: "Invalid file type",
      description: "Please upload a plain text (.txt) file",
      variant: "destructive",
    })
    onError("Invalid file type - only plain text files are supported")
    return
  }

  try {
    // Extract title from filename
    let title = file.name.split(".").slice(0, -1).join(".")
    if (!title) title = file.name

    const content = await file.text()
    onSuccess({
      title,
      content,
    })
  } catch (error) {
    console.error("File upload error:", error)

    toast({
      title: "Could not read the file",
      description: "The text file could not be read. Please try again.",
      variant: "destructive",
    })

    onError(error instanceof Error ? error.message : "File processing failed")
  }
}
