import { INTERVIEW_DEFAULTS } from "@/config/defaults/interview"
import { OPENAI_DEFAULTS } from "@/config/defaults/openai"
import { STT_DEFAULTS } from "@/config/defaults/stt"
import {
  CURRENT_SCHEMA_VERSION,
  UserConfigSchema,
  configMigrations,
} from "@/config/schemas/user-config.schema"
import { db } from "@/lib/db"

export interface ResolvedConfig {
  openai: {
    chat: {
      model: string
      temperature: number
      maxTokens: number
    }
    classify: {
      model: string
      maxTokens: number
      temperature: number
      timeoutMs: number
    }
    agent: { answerCoachModel: string; maxTokens: number }
  }
  stt: {
    model: string
    languageHints: string[]
    endpointMaxDelayMs: number
    endpointSensitivity: number
    endpointLatencyLevel: number
    keepAliveIntervalMs: number
  }
  interview: {
    pauseMs: number
    completeCommitMs: number
    turnMaxSilenceMs: number
    candidateBargeInMs: number
    amendWindowMs: number
  }
}

function buildBaseConfig(): ResolvedConfig {
  return {
    openai: {
      chat: { ...OPENAI_DEFAULTS.chat },
      classify: { ...OPENAI_DEFAULTS.classify },
      agent: { ...OPENAI_DEFAULTS.agent },
    },
    stt: { ...STT_DEFAULTS, languageHints: [...STT_DEFAULTS.languageHints] },
    interview: { ...INTERVIEW_DEFAULTS },
  }
}

async function migrateAndParse(raw: unknown, schemaVersion: number) {
  let data = raw
  for (let v = schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    data = configMigrations[v]?.(data) ?? data
  }
  return UserConfigSchema.safeParse(data)
}

export class ConfigService {
  static async forUser(userId: string): Promise<ResolvedConfig> {
    const base = buildBaseConfig()

    let row: Awaited<ReturnType<typeof db.userConfig.findUnique>> | null = null
    try {
      row = await db.userConfig.findUnique({ where: { userId } })
    } catch {
      // DB unavailable — return operator defaults
      return base
    }

    // First-time user: no row yet
    if (!row) return base

    // Migrate if needed
    const parseResult = await migrateAndParse(row, row.schemaVersion)

    if (!parseResult.success) {
      // Last resort: reset to all-null and return defaults
      console.warn(
        "[ConfigService] Failed to parse UserConfig — resetting to defaults",
        {
          userId,
          schemaVersion: row.schemaVersion,
          errors: parseResult.error.issues,
        }
      )
      try {
        await db.userConfig.update({
          where: { userId },
          data: {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            endpointMaxDelayMs: null,
            endpointSensitivity: null,
            turnMaxSilenceMs: null,
          },
        })
      } catch {
        /* ignore secondary failure */
      }
      return base
    }

    const userConfig = parseResult.data

    // Write back migrated version if version changed
    if (row.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      try {
        await db.userConfig.update({
          where: { userId },
          data: { schemaVersion: CURRENT_SCHEMA_VERSION },
        })
      } catch {
        /* non-fatal */
      }
    }

    // Merge user overrides onto base (right-side wins, undefined/null falls back to default)
    if (userConfig.endpointMaxDelayMs != null)
      base.stt.endpointMaxDelayMs = userConfig.endpointMaxDelayMs
    if (userConfig.endpointSensitivity != null)
      base.stt.endpointSensitivity = userConfig.endpointSensitivity
    if (userConfig.turnMaxSilenceMs != null)
      base.interview.turnMaxSilenceMs = userConfig.turnMaxSilenceMs

    return base
  }

  /** Returns operator defaults only — use when no user context is available. */
  static getDefaults(): ResolvedConfig {
    return buildBaseConfig()
  }
}
