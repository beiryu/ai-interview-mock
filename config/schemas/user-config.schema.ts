import { z } from "zod"

import { TURN_PACES } from "@/config/defaults/turn-pace"

export const CURRENT_SCHEMA_VERSION = 1

// V1 — initial schema. Never delete historical versions; migrations depend on them.
export const UserConfigSchemaV1 = z.object({
  schemaVersion: z.literal(1).default(1),

  // Turn-taking pace preset (config/defaults/turn-pace.ts)
  turnPace: z.enum(TURN_PACES).optional().nullable(),
})

// Current schema alias — update this alias when adding V2+
export const UserConfigSchema = UserConfigSchemaV1
export type UserConfig = z.infer<typeof UserConfigSchema>

// Migration map: version N → transform data to version N+1 shape
export const configMigrations: Record<number, (data: unknown) => unknown> = {
  // example: 1: (data) => ({ ...(data as object), schemaVersion: 2, newField: "default" }),
}
