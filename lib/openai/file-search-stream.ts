import type {
  FileSearchTool,
  ResponseCompletedEvent,
  ResponseOutputTextAnnotationAddedEvent,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses"

import { DOCUMENT_CHAT } from "@/config/defaults/ai"
import openai from "@/lib/openai"

import { buildFileSearchFilter } from "./vector-store-service"

export interface FileSearchSource {
  documentId: string
  documentTitle: string
  quote: string
  fileId: string
}

export interface FileSearchChunk {
  content: string | null
  sources: FileSearchSource[] | null
  responseId?: string
}

const DOMAIN_INTERVIEW_CONTEXT = `Assume all questions are in the context of software engineering and technical interviews. When a term has multiple meanings, always interpret and answer from a software/CS perspective first. If the intent is still unclear, ask one short clarifying question rather than listing unrelated definitions. When explaining a concept, include a short code example whenever it aids understanding.`

const INSTRUCTIONS_DOCUMENT_CHAT_WITH_RAG = `You are a concise, accurate assistant for technical interview preparation.
${DOMAIN_INTERVIEW_CONTEXT}
Use file_search results (the user's uploaded documents — CV, job descriptions, notes, etc.) as the primary source. Cite or paraphrase what the documents actually say; if something is not in the documents, say so clearly instead of inventing experience or facts.
Explain concepts, compare topics, suggest how to phrase answers, and help structure responses when asked. Use neutral, professional wording (no role-play as the candidate; do not write answers as "I" or "we" on their behalf unless the user explicitly asks you to draft a first-person answer).
Respond in the same language as the user's message (Vietnamese or English). Keep answers focused and scannable unless the user asks for depth.`

const INSTRUCTIONS_DOCUMENT_CHAT_NO_FILES = `You are a concise, accurate assistant for technical interview preparation.
${DOMAIN_INTERVIEW_CONTEXT}
The user has not selected any documents for this chat, so you must not search, cite, or claim content from their uploaded files. Answer from general knowledge: interview strategy, technical concepts, and how to structure answers.
If they need answers grounded in their CV, JD, or notes, tell them to select those documents in the Document Chat document picker first.
Use neutral, professional wording (no role-play as the candidate; do not write answers as "I" or "we" on their behalf unless the user explicitly asks you to draft a first-person answer).
Respond in the same language as the user's message (Vietnamese or English). Keep answers focused and scannable unless the user asks for depth.`

type ModelConfig = {
  model: string
  temperature: number
  maxOutputTokens: number
}

async function* iterateResponsesStream(
  stream: AsyncIterable<ResponseStreamEvent>,
  fileIdToTitle?: Map<string, { documentId: string; title: string }>
): AsyncGenerator<FileSearchChunk> {
  const sources: FileSearchSource[] = []
  let sourcesYielded = false

  for await (const event of stream) {
    if (event.type === "response.output_text_annotation.added") {
      const annotationEvent =
        event as unknown as ResponseOutputTextAnnotationAddedEvent
      const annotation = annotationEvent.annotation as {
        type?: string
        file_id?: string
        quote?: string
      }
      if (annotation?.type === "file_citation") {
        const fileId: string = annotation.file_id || ""
        const quote: string = annotation.quote || ""
        const meta = fileIdToTitle?.get(fileId)
        sources.push({
          documentId: meta?.documentId || "",
          documentTitle: meta?.title || fileId,
          quote,
          fileId,
        })
      }
    }

    if (event.type === "response.output_text.delta") {
      const deltaEvent = event as ResponseTextDeltaEvent
      if (!sourcesYielded) {
        yield { content: null, sources }
        sourcesYielded = true
      }
      yield { content: deltaEvent.delta, sources: null }
    }

    if (event.type === "response.completed") {
      if (!sourcesYielded) {
        yield { content: null, sources }
        sourcesYielded = true
      }
      const completedEvent = event as unknown as ResponseCompletedEvent
      yield {
        content: null,
        sources: null,
        responseId: completedEvent.response.id,
      }
    }
  }
}

/**
 * Document Chat without file_search: no vector lookup until the user selects documents.
 */
export async function* streamDocumentChatWithoutFileSearch(
  query: string,
  previousResponseId: string | undefined,
  modelConfig?: ModelConfig
): AsyncGenerator<FileSearchChunk> {
  const stream = await openai.responses.create({
    model: modelConfig?.model ?? DOCUMENT_CHAT.model,
    instructions: INSTRUCTIONS_DOCUMENT_CHAT_NO_FILES,
    input: [{ role: "user" as const, content: query }],
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    stream: true,
    temperature: modelConfig?.temperature ?? DOCUMENT_CHAT.temperature,
    max_output_tokens:
      modelConfig?.maxOutputTokens ?? DOCUMENT_CHAT.maxTokens,
  })

  yield* iterateResponsesStream(stream)
}

/**
 * Streams from the Responses API with file_search (requires ≥1 document id to filter the store).
 */
export async function* streamWithFileSearch(
  query: string,
  vectorStoreId: string,
  previousResponseId: string | undefined,
  documentIds: string[],
  fileIdToTitle?: Map<string, { documentId: string; title: string }>,
  modelConfig?: ModelConfig
): AsyncGenerator<FileSearchChunk> {
  if (!documentIds.length) {
    throw new Error(
      "streamWithFileSearch requires at least one selected document id"
    )
  }

  const filter = buildFileSearchFilter(documentIds)

  const fileSearchTool: FileSearchTool = {
    type: "file_search",
    vector_store_ids: [vectorStoreId],
    ...(filter ? { filters: filter as FileSearchTool["filters"] } : {}),
  }

  const stream = await openai.responses.create({
    model: modelConfig?.model ?? DOCUMENT_CHAT.model,
    instructions: INSTRUCTIONS_DOCUMENT_CHAT_WITH_RAG,
    input: [{ role: "user" as const, content: query }],
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    tools: [fileSearchTool],
    stream: true,
    temperature: modelConfig?.temperature ?? DOCUMENT_CHAT.temperature,
    max_output_tokens:
      modelConfig?.maxOutputTokens ?? DOCUMENT_CHAT.maxTokens,
  })

  yield* iterateResponsesStream(stream, fileIdToTitle)
}
