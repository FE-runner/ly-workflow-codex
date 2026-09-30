import type { LyConfig, SupportedLang } from '../types'

export interface CliOptions {
  lang?: SupportedLang
  force?: boolean
  skipPrompt?: boolean
  initOpenspec?: boolean
  /** 指定宿主（逗号分隔）：非交互时只安装这些宿主，交互时作为默认勾选 */
  host?: string
  workflows?: string
  installDir?: string
}

export type { LyConfig, SupportedLang }
