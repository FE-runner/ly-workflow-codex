import type { LyConfig, SupportedLang } from '../types'
import type { HostId } from './host-adapters'
import { homedir } from 'node:os'
import fs from 'fs-extra'
import { join } from 'pathe'
import { parse, stringify } from 'smol-toml'
import { version as packageVersion } from '../../package.json'
import { CONFIG_FILE, LY_DIR, PROMPTS_DIR } from './package-meta'

// 配置目录统一到 ~/.ly/（v0.1.0 起；旧 ~/.claude/.ly/ 由 migrateLegacyConfig 迁移）
export const LY_PROMPTS_DIR = PROMPTS_DIR

export function getLyPromptsDir(): string {
  return LY_PROMPTS_DIR
}

export function getLyDir(): string {
  return LY_DIR
}

export function getConfigPath(): string {
  return CONFIG_FILE
}

/**
 * 内置默认 spawn 可用模型清单（当前环境实证值）：声明 Codex 宿主显式 spawn 子代理可用的模型，
 * `[codexHost] spawnableModels` 未配置、空白或清洗后为空时回退此清单。可用列表随环境漂移，
 * 用户可按实测维护 `spawnableModels` 覆盖（doctor/init 以"用户配置或内置默认"为唯一候选/校验来源）。
 */
export const SPAWNABLE_MODELS_DEFAULT = [
  'gpt-6-astra',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
] as const

// ── installedHosts（兼容旧配置：持久化已安装宿主集合）──
// codex 单宿主下恒为 ['codex']，此处保留清洗逻辑以兼容旧配置读取。

export function isValidInstalledHost(value: unknown): value is HostId {
  return value === 'codex' || value === 'claude'
}

/** 清洗 installedHosts：过滤非法值 + 去重；空集返回 [] */
export function sanitizeInstalledHosts(value: unknown): HostId[] {
  const arr = Array.isArray(value) ? value : []
  return [...new Set(arr.filter(isValidInstalledHost))]
}

export async function ensureLyDir(): Promise<void> {
  await fs.ensureDir(LY_DIR)
}

/**
 * 共存检测：传入 home（默认真实 homedir），判断 ~/.claude/ 下是否仍存在活跃的
 * ly-workflow（原多宿主包）产物。共存时迁移会搬走他方在用配置/角色词，必须跳过。
 * 判定依据：
 * - ~/.claude/commands/ly 命令目录仍存在
 * - ~/.claude/.ly/config.toml 内容带 claude 宿主特征（installedHosts 含 claude / 路径含 .claude）
 */
export async function hasCoexistingLegacyLyProducts(home = homedir()): Promise<boolean> {
  try {
    if (await fs.pathExists(join(home, '.claude', 'commands', 'ly')))
      return true
    const legacyConfig = join(home, '.claude', '.ly', 'config.toml')
    if (await fs.pathExists(legacyConfig)) {
      const content = await fs.readFile(legacyConfig, 'utf-8')
      return /installedHosts\s*=.*claude/i.test(content) || content.includes('.claude')
    }
  }
  catch {
    // 检测失败按无共存处理；迁移仍走保守路径（不覆盖新位置已有配置）
  }
  return false
}

/**
 * 旧配置迁移：检测 ~/.claude/.ly/config.toml 存在则整体搬到 ~/.ly/config.toml（保留原值）。
 * 新位置已有配置时不覆盖；共存场景（~/.claude/ 下仍有活跃 ly-workflow 产物）绝不搬走；
 * 失败不抛出（返回 false，调用方报告但不阻断主流程）。
 */
export async function migrateLegacyConfig(): Promise<boolean> {
  const legacyConfig = join(homedir(), '.claude', '.ly', 'config.toml')
  try {
    if (!(await fs.pathExists(legacyConfig)))
      return false
    if (await fs.pathExists(CONFIG_FILE))
      return false
    if (await hasCoexistingLegacyLyProducts()) {
      console.warn('[lycx] 检测到 ~/.claude/.ly/ 仍被 ly-workflow 使用（共存场景），跳过配置迁移，保留他方在用配置')
      return false
    }
    await fs.ensureDir(LY_DIR)
    await fs.move(legacyConfig, CONFIG_FILE, { overwrite: false })
    return true
  }
  catch {
    return false
  }
}

export async function readLyConfig(): Promise<LyConfig | null> {
  try {
    await migrateLegacyConfig()
    if (await fs.pathExists(CONFIG_FILE)) {
      const content = await fs.readFile(CONFIG_FILE, 'utf-8')
      const parsed = parse(content) as Record<string, unknown>
      // 旧版字段安全忽略：routing/performance 等已废弃字段不进入运行时配置，也不随写入持久化
      delete parsed.routing
      delete parsed.performance
      return parsed as unknown as LyConfig
    }
  }
  catch {
    // Config doesn't exist or is invalid
  }
  return null
}

export async function writeLyConfig(config: LyConfig): Promise<void> {
  await migrateLegacyConfig()
  await ensureLyDir()
  const content = stringify(config as any)
  await fs.writeFile(CONFIG_FILE, content, 'utf-8')
}

export function createDefaultConfig(options: {
  language: SupportedLang
  installedWorkflows: string[]
  codexHost?: { reviewModel?: string, reviewModelB?: string, codingModel?: string, spawnableModels?: string[] }
  /** 已安装宿主集合（兼容旧配置；codex 单宿主缺省 ['codex']） */
  installedHosts?: HostId[]
}): LyConfig {
  const config: LyConfig = {
    general: {
      version: packageVersion,
      language: options.language,
      createdAt: new Date().toISOString(),
    },
    workflows: {
      installed: options.installedWorkflows,
    },
    installedHosts: sanitizeInstalledHosts(options.installedHosts).length > 0
      ? sanitizeInstalledHosts(options.installedHosts)
      : ['codex'],
    paths: {
      commands: PROMPTS_DIR,
      prompts: LY_PROMPTS_DIR,
      backup: join(LY_DIR, 'backup'),
    },
  }
  const reviewModel = sanitizeReviewModel(options.codexHost?.reviewModel)
  // 三个模型字段统一仅 trim（sanitizeReviewModel 与 sanitizeModelField 同口径）、空白视为未配置
  // （回退当前会话模型）：不再拼进 shell 命令串，由模板指示 + 宿主 spawn 能力落实
  const reviewModelB = sanitizeModelField(options.codexHost?.reviewModelB)
  const codingModel = sanitizeModelField(options.codexHost?.codingModel)
  // spawnableModels 透传并保全：不改写、不静默丢弃存量值（含格式非法的存量形态由 doctor WARN 暴露），
  // 避免"重装即丢失非法值、下次 doctor 不再告警"掩盖配置问题
  const spawnableModels = options.codexHost?.spawnableModels
  if (reviewModel || reviewModelB || codingModel || spawnableModels !== undefined) {
    config.codexHost = {
      ...(reviewModel ? { reviewModel } : {}),
      ...(reviewModelB ? { reviewModelB } : {}),
      ...(codingModel ? { codingModel } : {}),
      ...(spawnableModels !== undefined ? { spawnableModels } : {}),
    }
  }
  return config
}

/**
 * codex 宿主审查模型（codexHost.reviewModel）清洗：
 * 非字符串 → undefined；仅 trim，空白视为未配置（回退当前会话模型）。
 * 与 reviewModelB/codingModel 的 sanitizeModelField 口径一致——模型指定经"模板指示 + 宿主
 * spawn 能力"落实，不再拼进 shell 命令串，无需字符白名单清洗；同时保证与 spawnableModels
 * 生效清单按原文比对时不发生清洗前后值错位（如清单内含 `@` 等字符的模型 id）。
 */
export function sanitizeReviewModel(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim()
  return cleaned === '' ? undefined : cleaned
}

/**
 * 模型字段通用清洗（codexHost.reviewModelB / codingModel）：
 * 非字符串 → undefined；先 trim，空白视为未配置（回退当前会话模型）。
 * 不做字符白名单清洗——这些值不再拼进 shell 命令串，由模板指示 + 宿主 spawn 能力落实。
 */
export function sanitizeModelField(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim()
  return cleaned === '' ? undefined : cleaned
}

/** spawnableModels 清洗结果的形态判定（doctor 与 init 共用，避免两处口径漂移） */
export type SpawnableModelsState = 'unset' | 'ok' | 'empty' | 'invalid'

export interface SpawnableModelsSanitizeResult {
  /** 'ok' = 显式合法非空数组；'unset' = 未配置；'empty' = 显式数组但清洗后为空；'invalid' = 显式存在但格式非法 */
  state: SpawnableModelsState
  /** state==='ok' 时为清洗后模型名列表（trim、去重、过滤非字符串）；其余为空数组 */
  models: string[]
}

/**
 * spawnableModels 清洗：统一产出"未配置 / 合法非空 / 清洗后为空 / 格式非法"四态判定入口。
 * - 未配置（undefined/null）→ 'unset'
 * - 显式存在但非数组（如字符串）→ 'invalid'（doctor 对该形态输出 WARN）
 * - 显式数组但清洗后为空（含显式 []）→ 'empty'（doctor 对该形态输出 WARN；回退语义同未配置）
 * - 清洗后非空 → 'ok'（仅保留非空字符串、逐项 trim、去重）
 */
export function sanitizeSpawnableModels(value: unknown): SpawnableModelsSanitizeResult {
  if (value === undefined || value === null)
    return { state: 'unset', models: [] }
  if (!Array.isArray(value))
    return { state: 'invalid', models: [] }

  const models: string[] = []
  for (const item of value) {
    if (typeof item !== 'string')
      continue
    const trimmed = item.trim()
    if (trimmed !== '' && !models.includes(trimmed))
      models.push(trimmed)
  }
  if (models.length === 0)
    return { state: 'empty', models: [] }
  return { state: 'ok', models }
}

/**
 * 生效清单解析：`[codexHost] spawnableModels` 清洗后合法非空用之；
 * 未配置 / 格式非法 / 清洗后为空均回退内置默认 SPAWNABLE_MODELS_DEFAULT。
 */
export function resolveSpawnableModels(codexHost?: { spawnableModels?: unknown }): string[] {
  const result = sanitizeSpawnableModels(codexHost?.spawnableModels)
  return result.state === 'ok' ? result.models : [...SPAWNABLE_MODELS_DEFAULT]
}

/**
 * 子代理模型"生效清单"解析（doctor 校验 / init 与 menu 候选的统一来源）：
 * - 基准 = `[codexHost] spawnableModels` 清洗后合法非空清单；未配置 / 格式非法 / 清洗后为空
 *   回退内置默认 SPAWNABLE_MODELS_DEFAULT（与 resolveSpawnableModels 一致）。
 * - 已配置的 reviewModel/reviewModelB/codingModel 非空值（含向导自定义输入）SHALL 始终并入：
 *   用户显式指定的模型（无论来自清单选择还是自定义输入）视为合法，不被基准清单误判——
 *   审查 agent A/B 与 coding agent 统一口径，用户已配置的模型按配置列出。
 * - codex 当前主模型（~/.codex/config.toml 顶层 model，可检测时）仅在未显式配置
 *   spawnableModels（宽松路径）时并入；用户显式维护清单（严格路径）时不并入，
 *   "留空字段继承主模型"由 doctor 交叉校验 WARN 提示。
 * 返回去重后的模型名数组（保序：基准在前，并入在后）。
 */
export function resolveEffectiveModelList(
  codexHost?: {
    reviewModel?: unknown
    reviewModelB?: unknown
    codingModel?: unknown
    spawnableModels?: unknown
  },
  opts?: { currentModel?: string },
): string[] {
  const spawn = sanitizeSpawnableModels(codexHost?.spawnableModels)
  const base = spawn.state === 'ok' ? spawn.models : [...SPAWNABLE_MODELS_DEFAULT]
  const extras: string[] = []
  for (const value of [codexHost?.reviewModel, codexHost?.reviewModelB, codexHost?.codingModel]) {
    const model = sanitizeModelField(value)
    if (model)
      extras.push(model)
  }
  if (spawn.state !== 'ok') {
    const current = opts?.currentModel?.trim()
    if (current)
      extras.push(current)
  }
  return [...new Set([...base, ...extras])]
}
