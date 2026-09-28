import { DEEPGRAM_DEFAULTS } from "@/config/defaults/deepgram"
import { INTERVIEW_DEFAULTS } from "@/config/defaults/interview"
import { OPENAI_DEFAULTS } from "@/config/defaults/openai"
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
      presencePenalty: number
      frequencyPenalty: number
    }
    classify: {
      model: string
      maxTokens: number
      temperature: number
      timeoutMs: number
    }
    agent: { answerCoachModel: string }
    cache: { prevResponseTtlSec: number }
  }
  deepgram: {
    model: string
    language: string
    interimResults: boolean
    smartFormat: boolean
    utteranceEndMs: number
    endpointing: number
    keepAliveIntervalMs: number
  }
  interview: {
    silenceThresholdMs: number
    silenceCheckIntervalMs: number
  }
}

function buildBaseConfig(): ResolvedConfig {
  return {
    openai: {
      chat: { ...OPENAI_DEFAULTS.chat },
      classify: { ...OPENAI_DEFAULTS.classify },
      agent: { ...OPENAI_DEFAULTS.agent },
      cache: { ...OPENAI_DEFAULTS.cache },
    },
    deepgram: { ...DEEPGRAM_DEFAULTS },
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
            chatModel: null,
            chatTemperature: null,
            deepgramModel: null,
            deepgramLanguage: null,
            silenceThresholdMs: null,
            utteranceEndMs: null,
            deepgramEndpointing: null,
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
    if (userConfig.chatModel) base.openai.chat.model = userConfig.chatModel
    if (userConfig.chatTemperature != null)
      base.openai.chat.temperature = userConfig.chatTemperature
    if (userConfig.deepgramModel) base.deepgram.model = userConfig.deepgramModel
    if (userConfig.deepgramLanguage)
      base.deepgram.language = userConfig.deepgramLanguage
    if (userConfig.silenceThresholdMs != null)
      base.interview.silenceThresholdMs = userConfig.silenceThresholdMs
    if (userConfig.utteranceEndMs != null)
      base.deepgram.utteranceEndMs = userConfig.utteranceEndMs
    if (userConfig.deepgramEndpointing != null)
      base.deepgram.endpointing = userConfig.deepgramEndpointing

    return base
  }

  /** Returns operator defaults only — use when no user context is available. */
  static getDefaults(): ResolvedConfig {
    return buildBaseConfig()
  }
}
