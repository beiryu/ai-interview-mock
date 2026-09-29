"use client"

import { createContext, useContext, useState } from "react"

import { DEEPGRAM_DEFAULTS } from "@/config/defaults/deepgram"
import { INTERVIEW_DEFAULTS } from "@/config/defaults/interview"
import { OPENAI_DEFAULTS } from "@/config/defaults/openai"
import type { UserConfig } from "@/config/schemas/user-config.schema"
import type { ResolvedConfig } from "@/lib/config/config.service"

interface ConfigContextValue {
  config: ResolvedConfig
  updateConfig: (patch: Partial<UserConfig>) => Promise<void>
}

function buildClientBase(): ResolvedConfig {
  return {
    openai: {
      chat: { ...OPENAI_DEFAULTS.chat },
      classify: { ...OPENAI_DEFAULTS.classify },
      agent: { ...OPENAI_DEFAULTS.agent },
    },
    deepgram: { ...DEEPGRAM_DEFAULTS },
    interview: { ...INTERVIEW_DEFAULTS },
  }
}

function applyUserConfig(
  base: ResolvedConfig,
  userConfig: UserConfig | null
): ResolvedConfig {
  if (!userConfig) return base
  const result = {
    ...base,
    openai: {
      ...base.openai,
      chat: { ...base.openai.chat },
    },
    deepgram: { ...base.deepgram },
    interview: { ...base.interview },
  }
  if (userConfig.chatModel) result.openai.chat.model = userConfig.chatModel
  if (userConfig.chatTemperature != null)
    result.openai.chat.temperature = userConfig.chatTemperature
  if (userConfig.deepgramModel) result.deepgram.model = userConfig.deepgramModel
  if (userConfig.deepgramLanguage)
    result.deepgram.language = userConfig.deepgramLanguage
  if (userConfig.silenceThresholdMs != null)
    result.interview.silenceThresholdMs = userConfig.silenceThresholdMs
  if (userConfig.utteranceEndMs != null)
    result.deepgram.utteranceEndMs = userConfig.utteranceEndMs
  if (userConfig.deepgramEndpointing != null)
    result.deepgram.endpointing = userConfig.deepgramEndpointing
  return result
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

interface ConfigProviderProps {
  children: React.ReactNode
  // Pre-fetched on the server by the dashboard layout — null for unauthenticated pages
  initialConfig: ResolvedConfig | null
}

export function ConfigProvider({
  children,
  initialConfig,
}: ConfigProviderProps) {
  const [resolvedConfig, setResolvedConfig] = useState<ResolvedConfig>(
    initialConfig ?? buildClientBase()
  )
  async function updateConfig(patch: Partial<UserConfig>) {
    const res = await fetch("/api/user/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error("Failed to update config")
    const updated: UserConfig = await res.json()
    setResolvedConfig(applyUserConfig(buildClientBase(), updated))
  }

  return (
    <ConfigContext.Provider value={{ config: resolvedConfig, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfigContext() {
  const ctx = useContext(ConfigContext)
  if (!ctx) {
    // Outside ConfigProvider: return operator defaults
    return {
      config: buildClientBase(),
      updateConfig: async () => {
        throw new Error("ConfigProvider not mounted")
      },
    }
  }
  return ctx
}
