import { z } from "zod"

export const CURRENT_SCHEMA_VERSION = 1

// V1 — initial schema. Never delete historical versions; migrations depend on them.
export const UserConfigSchemaV1 = z.object({
  schemaVersion: z.literal(1).default(1),

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
