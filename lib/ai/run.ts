import { Output, generateText, streamText, type ModelMessage } from "ai"
import type { z } from "zod"

import { AI_TASKS, type AiTask, type AiTaskName } from "@/config/defaults/ai"

import { languageModel, providerOptions } from "./models"

/**
 * How every task calls a model: config lookup, gateway options, deadlines
 * and error logging in one place, so judge/coach/… only own their prompts.
 */

interface RunInput {
  instructions: string
  /** One-shot input; streaming tasks may pass `messages` instead */
  prompt?: string
  messages?: ModelMessage[]
  abortSignal?: AbortSignal
  /** Gateway id to use instead of the task's model (evals) */
  model?: string
}

/** Streaming text (coach, chat). Errors are logged, not thrown. */
export function runStream(name: AiTaskName, input: RunInput) {
  const task: AiTask = AI_TASKS[name]
  const model = input.model ?? task.model
  return streamText({
    model: languageModel(model),
    instructions: input.instructions,
    ...(input.messages
      ? { messages: input.messages }
      : { prompt: input.prompt ?? "" }),
    maxOutputTokens: task.maxTokens,
    temperature: task.temperature,
    reasoning: task.reasoning,
    abortSignal: input.abortSignal,
    providerOptions: providerOptions(name, model),
    onError: ({ error }) => {
      if (!input.abortSignal?.aborted) console.error(`AI ${name} error:`, error)
    },
  })
}

/**
 * A schema-checked object (judge, ledger, prep, grader). Throws on timeout,
 * abort, provider error or an object that doesn't match the schema.
 */
export async function runObject<T>(
  name: AiTaskName,
  schema: z.ZodType<T>,
  input: RunInput & { maxRetries?: number }
) {
  const task: AiTask = AI_TASKS[name]
  const model = input.model ?? task.model
  const result = await generateText({
    model: languageModel(model),
    instructions: input.instructions,
    prompt: input.prompt ?? "",
    output: Output.object({ schema }),
    maxOutputTokens: task.maxTokens,
    temperature: task.temperature,
    reasoning: task.reasoning,
    maxRetries: input.maxRetries ?? 0,
    abortSignal: AbortSignal.any([
      ...(input.abortSignal ? [input.abortSignal] : []),
      ...(task.timeoutMs ? [AbortSignal.timeout(task.timeoutMs)] : []),
    ]),
    providerOptions: providerOptions(name, model),
  })
  return {
    output: result.output as T,
    model: result.response.modelId,
    usage: result.usage,
  }
}
