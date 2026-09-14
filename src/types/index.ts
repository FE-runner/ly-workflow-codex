import type { HostId } from '../utils/host-adapters'

// 支持的语言
export type SupportedLang = 'zh-CN' | 'en'

// ly-workflow-codex 配置
export interface LyConfig {
  general: {
    version: string
    language: SupportedLang
    createdAt: string
  }
  workflows: {
    installed: string[]
  }
  // 已安装宿主集合（兼容旧配置读取；codex 单宿主下恒为 ['codex']）
  installedHosts?: HostId[]
  paths: {
    commands: string
    prompts: string
    backup: string
  }
  // codex 宿主（单 Agent 模式）专属配置
  codexHost?: {
    // 审查模型：渲染进 codex 版审查命令模板的 `-m` 参数；未配置时回退当前会话模型
    reviewModel?: string
  }
}

// 工作流定义
export interface WorkflowConfig {
  id: string
  name: string
  nameEn: string
  category: string
  commands: string[]
  defaultSelected: boolean
  order: number
  description?: string
  descriptionEn?: string
}

// 初始化选项
export interface InitOptions {
  lang?: SupportedLang
  skipPrompt?: boolean
  force?: boolean
  // 非交互模式参数
  workflows?: string
  installDir?: string
}

// 安装结果
export interface InstallResult {
  success: boolean
  installedCommands: string[]
  installedPrompts: string[]
  /** 非 force 安装时因目标已存在而跳过的命令（修复"假成功"计数，供共存提示） */
  skippedCommands?: string[]
  errors: string[]
  configPath: string
}

// Re-export CLI types
export * from './cli'
