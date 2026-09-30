import type { InstallResult } from '../types'
import { claudeAdapter } from '../hosts/claude'
import { codexAdapter } from '../hosts/codex'

// ═══════════════════════════════════════════════════════
// HostAdapter — 宿主适配器契约
// 共享安装流程只认本接口与注册表；宿主专属知识（路径、模板渲染、附加产物、卸载清单）
// 全部收敛在各宿主的适配器实现里。
// ═══════════════════════════════════════════════════════

/** 宿主 id */
export type HostId = 'codex' | 'claude'

/** 宿主无关的模板渲染配置（宿主配置节的相关切片） */
export interface HostAdapterConfig {
  /** 审查执行者；未配置等价 'main'，由模板运行时解析 */
  reviewExecutor?: 'main' | 'subagent'
  /** coding 执行者；未配置等价 'main'，由模板运行时解析 */
  codingExecutor?: 'main' | 'subagent'
  /** 审查 subagent 模型；仅在 reviewExecutor === 'subagent' 时生效 */
  reviewModel?: string
  /** coding subagent 模型；仅在 codingExecutor === 'subagent' 时生效 */
  codingModel?: string
  /** 审查 subagent 推理档 */
  reviewReasoningEffort?: string
  /** coding subagent 推理档 */
  codingReasoningEffort?: string
}

/** 宿主产物路径（均可由测试注入） */
export interface HostPaths {
  /** 命令产物目录：安装为 <skillsDir>/<filePrefix><cmd>/SKILL.md */
  skillsDir: string
  /** 本包在该宿主下的私有目录（config.toml 所在） */
  lyDir: string
  /** 角色词目录 */
  promptsDir: string
  /** 子代理定义目录（仅部分宿主使用） */
  agentsDir?: string
}

/** 适配器安装/卸载/校验共用的上下文 */
export interface HostAdapterContext {
  /** 宿主安装根目录（保留统一形态；当前宿主不使用） */
  installDir: string
  force: boolean
  /** npm 包内 templates/ 目录 */
  templateDir: string
  paths: HostPaths
  config: HostAdapterConfig
  result: InstallResult
}

/** 命令模板的源目录与安装目标 */
export interface HostTemplateTarget {
  sourceDir: string
  targetDir: string
  /** 目标目录名前缀（'lyx-' → <targetDir>/lyx-<cmd>/SKILL.md） */
  filePrefix?: string
}

/** 技能扫描根（供 OpenSpec 依赖检查使用） */
export interface HostSkillRoot {
  scope: 'project' | 'global'
  path: string
}

/** 卸载过程的可变汇总（由共享卸载流程创建，宿主钩子追加） */
export interface HostUninstallReport {
  success: boolean
  removedSkills: string[]
  removedLegacyPrompts: string[]
  removedPrompts: boolean
  errors: string[]
}

/** 体检项（doctor 按宿主分组输出） */
export interface HostDoctorCheck {
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
  /** 附在检查列表后的补充提示行 */
  hints?: string[]
}

/** 体检 / 偏差检测的输入：该宿主的产物路径与配置节（配置文件缺失时为 undefined） */
export interface HostInspectContext {
  paths: HostPaths
  config: HostAdapterConfig | undefined
}

export interface HostUninstallOptions {
  legacyCleanupDirs?: { codexDir?: string, homeDir?: string }
}

export interface HostAdapter {
  id: HostId
  /** 默认产物路径 */
  defaultPaths: () => HostPaths
  /** 宿主探测目录：存在即视为用户在用该宿主（安装向导默认勾选依据） */
  detectDir: () => string
  /** 命令调用前缀（展示用：codex = '@'，claude = '/'） */
  commandPrefix: string
  /**
   * 推理档建议清单（仅作交互提示，不做枚举强校验；实际可用档位以宿主 / 模型能力为准）。
   * 清单随宿主能力漂移，因此归属宿主侧——共享层只读取该字段，不做宿主名分支。
   */
  reasoningEffortSuggestions: readonly string[]
  /** 历史版本写入的宿主配置节名（读取时兼容为 [host]，写入时不再保留） */
  legacyConfigSections?: string[]
  /** OpenSpec `--tools` 取值 */
  openspecTool: string
  /** OpenSpec 技能扫描根（项目级在前） */
  openspecSkillRoots: (cwd: string) => HostSkillRoot[]
  /** 命令模板安装目标（源目录 + 目标目录 + 文件名前缀） */
  promptsTarget: (ctx: HostAdapterContext) => HostTemplateTarget
  /** 模板渲染规则（宿主片段注入 + 共享变量处理 + 宿主专属处理）；command 为命令名（如 'review-plan'） */
  renderTemplate: (content: string, ctx: HostAdapterContext, command: string) => string
  /** 卸载清单：该宿主名下的命令产物路径清单（绝对路径） */
  uninstallList: (ctx: HostAdapterContext) => Promise<string[]>
  /** 可选：宿主专属的附加安装步骤（角色词、子代理定义等） */
  installExtras?: (ctx: HostAdapterContext) => Promise<void>
  /** 可选：安装后校验 */
  verify?: (ctx: HostAdapterContext) => Promise<void>
  /** 可选：宿主专属体检项（命令产物、角色词 / 子代理定义、子代理配置） */
  doctorChecks?: (ctx: HostInspectContext) => Promise<HostDoctorCheck[]>
  /** 可选：已安装产物中与当前配置不一致的文件（如子代理定义的模型 / 推理档）；无偏差返回 [] */
  definitionDrift?: (ctx: HostInspectContext) => Promise<string[]>
  /** 可选：update 前需备份的本包产物（绝对路径；缺省 = uninstallList） */
  backupList?: (ctx: HostAdapterContext) => Promise<string[]>
  /** 可选：卸载确认提示中该宿主的完整删除 / 修改范围（缺省由共享层按 skills / agents / lyDir 描述） */
  describeUninstall?: (paths: HostPaths) => string[]
  /** 可选：宿主专属的附加卸载步骤（在删除私有目录之前执行） */
  uninstallExtras?: (ctx: HostAdapterContext, report: HostUninstallReport, options: HostUninstallOptions) => Promise<void>
}

// ═══════════════════════════════════════════════════════
// Registry — 宿主的唯一登记处
// ═══════════════════════════════════════════════════════

/**
 * 登记顺序即默认展示 / 遍历顺序。惰性求值：宿主包与共享层之间存在模块循环
 * （宿主包 → 共享配置读写 → 注册表），在模块求值期直接取值会拿到未初始化的适配器。
 */
function registeredAdapters(): HostAdapter[] {
  return [codexAdapter, claudeAdapter]
}

/** 按 id 索引的注册表（getter 惰性取值，理由同上） */
export const ADAPTERS: Partial<Record<HostId, HostAdapter>> = {
  get codex() { return codexAdapter },
  get claude() { return claudeAdapter },
}

/** 全部已注册宿主（按登记顺序） */
export function listRegisteredHosts(): HostId[] {
  return registeredAdapters().map(adapter => adapter.id)
}

export function isRegisteredHost(value: unknown): value is HostId {
  return typeof value === 'string' && registeredAdapters().some(adapter => adapter.id === value)
}

export function getAdapter(id: HostId): HostAdapter {
  const adapter = ADAPTERS[id]
  if (!adapter)
    throw new Error(`Unknown host: ${id}`)
  return adapter
}

/** 未指定宿主集合且无从推断时的兜底安装集合（保持改造前的单宿主行为） */
export const FALLBACK_HOSTS: HostId[] = ['codex']

/** 历史无参 API（getConfigPath 等）与未指定宿主的配置读写所指向的默认宿主 */
export const DEFAULT_HOST: HostId = FALLBACK_HOSTS[0]
