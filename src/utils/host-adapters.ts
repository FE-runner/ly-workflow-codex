import type { InstallResult } from '../types'
import fs from 'fs-extra'
import { join } from 'pathe'
import { LY_PROMPTS_DIR } from './config'
import { injectConfigVariables } from './installer-template'
import { AGENTS_SKILLS_DIR } from './package-meta'

// ═══════════════════════════════════════════════════════
// HostAdapter — codex 单宿主适配器契约
// 命令模板安装目标、模板渲染、卸载清单收敛为接口，保留统一形态供未来扩展。
// ═══════════════════════════════════════════════════════

/** 宿主 id（兼容旧配置读取；codex 单宿主只安装 codex） */
export type HostId = 'codex' | 'claude'

/** 宿主无关的模板渲染配置（共享 LyConfig 的相关切片） */
export interface HostAdapterConfig {
  /** codex 宿主审查模型（LyConfig.codexHost.reviewModel）；未配置时回退当前会话模型 */
  reviewModel?: string
}

/** 适配器安装/卸载/校验共用的上下文 */
export interface HostAdapterContext {
  /** 宿主安装根目录（保留统一形态；codex 宿主不使用） */
  installDir: string
  force: boolean
  /** npm 包内 templates/ 目录 */
  templateDir: string
  /** 共享角色词位置（~/.ly/prompts/，测试可注入） */
  promptsDir: string
  /** codex skills 安装目录（~/.agents/skills/，测试可注入） */
  codexSkillsDir: string
  config: HostAdapterConfig
  result: InstallResult
}

/** 命令模板的源目录与安装目标 */
export interface HostTemplateTarget {
  sourceDir: string
  targetDir: string
  /** 目标目录名前缀（codex 宿主 = 'lyx-'，安装为 <targetDir>/lyx-<cmd>/SKILL.md） */
  filePrefix?: string
}

export interface HostAdapter {
  id: HostId
  /** 命令模板安装目标（源目录 + 目标目录 + 文件名前缀） */
  promptsTarget: (ctx: HostAdapterContext) => HostTemplateTarget
  /** 模板渲染规则：宿主可追加宿主专属变量处理（在共享 injectConfigVariables 之后） */
  renderTemplate: (content: string, ctx: HostAdapterContext) => string
  /** 卸载清单：该宿主名下的产物路径清单（lyx-* 绝对路径清单） */
  uninstallList: (ctx: HostAdapterContext) => Promise<string[]>
  /** 可选：宿主专属的附加安装步骤（codex 无） */
  installExtras?: (ctx: HostAdapterContext) => Promise<void>
  /** 可选：安装后校验（codex = ROLE_FILE 目标存在性） */
  verify?: (ctx: HostAdapterContext) => Promise<void>
}

// ═══════════════════════════════════════════════════════
// codex 宿主模板渲染
// ═══════════════════════════════════════════════════════

/**
 * codex 宿主模板渲染：共享 injectConfigVariables 之后追加 {{REVIEW_MODEL}} 处理。
 * - 已配置 reviewModel → 全量替换为模型名
 * - 未配置 → 剥离 " -m {{REVIEW_MODEL}}" 参数（回退当前会话模型，exec 不带 -m），
 *   其余 {{REVIEW_MODEL}} 占位（正文引用）渲染为空串
 */
export function renderCodexTemplate(content: string, config: HostAdapterConfig): string {
  let processed = injectConfigVariables(content, config)
  const model = config.reviewModel?.trim() || ''
  if (model) {
    processed = processed.replace(/\{\{REVIEW_MODEL\}\}/g, model)
  }
  else {
    processed = processed.replace(/ -m \{\{REVIEW_MODEL\}\}/g, '')
    processed = processed.replace(/\{\{REVIEW_MODEL\}\}/g, '')
  }
  return processed
}

// ═══════════════════════════════════════════════════════
// codex adapter — 单 Agent 模式（SKILL.md 形态，Codex 官方 skill 机制）
// ═══════════════════════════════════════════════════════

export function getCodexSkillsDir(): string {
  return AGENTS_SKILLS_DIR
}

/** codex 版审查命令模板依赖的共享角色词（ROLE_FILE 绝对路径目标） */
const CODEX_ROLE_FILE_TARGETS = ['reviewer.md', 'plan-reviewer.md']

export const codexAdapter: HostAdapter = {
  id: 'codex',

  promptsTarget: ctx => ({
    sourceDir: join(ctx.templateDir, 'skills-codex'),
    targetDir: ctx.codexSkillsDir,
    filePrefix: 'lyx-',
  }),

  renderTemplate: (content, ctx) => renderCodexTemplate(content, ctx.config),

  uninstallList: async (ctx) => {
    try {
      if (!(await fs.pathExists(ctx.codexSkillsDir)))
        return []
      const entries = await fs.readdir(ctx.codexSkillsDir)
      const dirs: string[] = []
      for (const entry of entries) {
        if (!entry.startsWith('lyx-'))
          continue
        const full = join(ctx.codexSkillsDir, entry)
        if ((await fs.stat(full)).isDirectory())
          dirs.push(full)
      }
      return dirs
    }
    catch {
      return []
    }
  },

  verify: async (ctx) => {
    // codex 版模板 ROLE_FILE 以绝对路径指向中立位置（不建软链）——
    // 共享角色词缺失时审查命令无法工作，报安装错误
    for (const file of CODEX_ROLE_FILE_TARGETS) {
      const target = join(ctx.promptsDir, 'codex', file)
      if (!(await fs.pathExists(target))) {
        ctx.result.errors.push(`codex ROLE_FILE target missing: ${target} (shared prompts not installed)`)
        ctx.result.success = false
      }
    }
  },
}

// ═══════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════

/** 统一注册表（codex 单宿主；保留 Record 形态供未来扩展） */
export const ADAPTERS: Record<'codex', HostAdapter> = {
  codex: codexAdapter,
}

/** 默认共享角色词目录（供 uninstall/迁移等调用方取默认值；测试可注入覆盖） */
export function defaultLyPromptsDir(): string {
  return LY_PROMPTS_DIR
}
