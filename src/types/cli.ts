import type { LyConfig, SupportedLang } from '../types'

export interface CliOptions {
  lang?: SupportedLang
  force?: boolean
  skipPrompt?: boolean
  workflows?: string
  installDir?: string
}

export type { LyConfig, SupportedLang }
