import { z } from "zod"

export const CURRENT_SCHEMA_VERSION = 1

const CHAT_MODELS = [
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4.1",
] as const

/** Prisma nullable columns use `null`; Zod `.optional()` only allows `undefined`. */
function nullableEnum<const T extends readonly string[]>(
  allowed: T,
  val: unknown
): T[number] | null | undefined {
  if (val === undefined) return undefined
  if (val === null || val === "") return null
  if (typeof val === "string" && (allowed as readonly string[]).includes(val)) {
    return val as T[number]
  }
  return null
}

// V1 — initial schema. Never delete historical versions; migrations depend on them.
export const UserConfigSchemaV1 = z.object({
  schemaVersion: z.literal(1).default(1),

  // OpenAI
  chatModel: z.preprocess(
    (val) => nullableEnum(CHAT_MODELS, val),
    z.enum(CHAT_MODELS).optional().nullable()
  ),
  chatTemperature: z.number().min(0).max(1).optional().nullable(),

  // Speech-to-text (Soniox)
  endpointMaxDelayMs: z.number().int().min(500).max(3000).optional().nullable(),
  endpointSensitivity: z.number().min(-1).max(1).optional().nullable(),

  // Turn taking
  turnMaxSilenceMs: z.number().int().min(1000).max(5000).optional().nullable(),
})

// Current schema alias — update this alias when adding V2+
export const UserConfigSchema = UserConfigSchemaV1
export type UserConfig = z.infer<typeof UserConfigSchema>

// Migration map: version N → transform data to version N+1 shape
export const configMigrations: Record<number, (data: unknown) => unknown> = {
  // example: 1: (data) => ({ ...(data as object), schemaVersion: 2, newField: "default" }),
}
