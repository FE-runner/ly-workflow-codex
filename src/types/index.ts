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
    // 审查 subagent 模型（单审查执行模型）；未配置或空白时回退当前会话模型
    reviewModel?: string
    // 【弃用】双审查时代的审查 agent B 模型——单审查执行模型不再读取使用；
    // 字段保留（存量配置值不被任何路径删除/改写），lycx doctor 输出弃用提示
    reviewModelB?: string
    // coding subagent（实施）模型；未配置或空白时回退当前会话模型
    codingModel?: string
    // 审查 subagent 推理档；非空时随 reviewModel spawn 传入，未配置或空白时不传
    reviewReasoningEffort?: string
    // 【弃用】双审查时代的审查 agent B 推理档——单审查执行模型不再读取使用；
    // 字段保留（存量配置值不被任何路径删除/改写），lycx doctor 输出弃用提示
    reviewReasoningEffortB?: string
    // coding subagent 推理档；非空时随 codingModel spawn 传入，未配置或空白时不传
    codingReasoningEffort?: string
    // 提示参考：本机实测可 spawn 的模型清单（不作候选/校验来源，agent 模型可用性
    // 由环境实际能力决定）；未配置或清洗后为空时提示口径回退 SPAWNABLE_MODELS_DEFAULT
    spawnableModels?: string[]
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
