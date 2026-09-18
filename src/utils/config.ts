import type { ExecutorKind, LyConfig, SupportedLang } from '../types'
import type { HostId } from './host-adapters'
import fs from 'fs-extra'
import { join } from 'pathe'
import { parse, stringify } from 'smol-toml'
import { version as packageVersion } from '../../package.json'
import { CONFIG_FILE, LY_DIR, PROMPTS_DIR } from './package-meta'

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

export async function readLyConfig(): Promise<LyConfig | null> {
  try {
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
  await ensureLyDir()
  const content = stringify(config as any)
  await fs.writeFile(CONFIG_FILE, content, 'utf-8')
}

export function createDefaultConfig(options: {
  language: SupportedLang
  installedWorkflows: string[]
  codexHost?: {
    reviewExecutor?: ExecutorKind
    codingExecutor?: ExecutorKind
    reviewModel?: string
    codingModel?: string
    reviewReasoningEffort?: string
    codingReasoningEffort?: string
    spawnableModels?: string[]
  }
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
  const reviewExecutor = sanitizeExecutor(options.codexHost?.reviewExecutor)
  const codingExecutor = sanitizeExecutor(options.codexHost?.codingExecutor)
  const reviewModel = sanitizeReviewModel(options.codexHost?.reviewModel)
  // 模型字段统一仅 trim（sanitizeReviewModel 与 sanitizeModelField 同口径）、空白视为未配置
  // （回退当前会话模型）：不再拼进 shell 命令串，由模板指示 + 宿主 spawn 能力落实
  const codingModel = sanitizeModelField(options.codexHost?.codingModel)
  const reviewReasoningEffort = sanitizeReasoningEffort(options.codexHost?.reviewReasoningEffort)
  const codingReasoningEffort = sanitizeReasoningEffort(options.codexHost?.codingReasoningEffort)
  // spawnableModels 透传并保全：不改写、不静默丢弃存量值（含格式非法的存量形态由 doctor WARN 暴露），
  // 避免"重装即丢失非法值、下次 doctor 不再告警"掩盖配置问题
  const spawnableModels = options.codexHost?.spawnableModels
  if (
    reviewExecutor
    || codingExecutor
    || reviewModel
    || codingModel
    || reviewReasoningEffort
    || codingReasoningEffort
    || spawnableModels !== undefined
  ) {
    config.codexHost = {
      ...(reviewExecutor ? { reviewExecutor } : {}),
      ...(codingExecutor ? { codingExecutor } : {}),
      ...(reviewModel ? { reviewModel } : {}),
      ...(codingModel ? { codingModel } : {}),
      ...(reviewReasoningEffort ? { reviewReasoningEffort } : {}),
      ...(codingReasoningEffort ? { codingReasoningEffort } : {}),
      ...(spawnableModels !== undefined ? { spawnableModels } : {}),
    }
  }
  return config
}

/**
 * 执行者字段清洗（codexHost.reviewExecutor / codingExecutor）：
 * 非字符串 → undefined；trim 后仅接受 'main' / 'subagent'，其余（含空白、非法取值）视为未配置。
 * 未配置等价 'main'（主 agent 直接执行），由模板运行时按此默认值解析。
 */
export function sanitizeExecutor(value: unknown): ExecutorKind | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim()
  return cleaned === 'main' || cleaned === 'subagent' ? cleaned : undefined
}

/**
 * codex 宿主审查模型（codexHost.reviewModel）清洗：
 * 非字符串 → undefined；仅 trim，空白视为未配置（回退当前会话模型）。
 * 与 codingModel 的 sanitizeModelField 口径一致——模型指定经"模板指示 + 宿主
 * spawn 能力"落实，不再拼进 shell 命令串，无需字符白名单清洗；仅 trim 保真（含 `@` 等
 * 字符的模型 id 原样保留）。
 */
export function sanitizeReviewModel(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim()
  return cleaned === '' ? undefined : cleaned
}

/**
 * 模型字段通用清洗（codexHost.codingModel）：
 * 非字符串 → undefined；先 trim，空白视为未配置（回退当前会话模型）。
 * 不做字符白名单清洗——这些值不再拼进 shell 命令串，由模板指示 + 宿主 spawn 能力落实。
 */
export function sanitizeModelField(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim()
  return cleaned === '' ? undefined : cleaned
}

/**
 * 推理档字段清洗（codexHost 两个 *ReasoningEffort）：
 * 非字符串 → undefined；仅 trim，空白视为未配置（不传 reasoning_effort）。
 * 不做枚举白名单校验——合法档位由宿主/上游实际能力决定。
 */
export function sanitizeReasoningEffort(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim()
  return cleaned === '' ? undefined : cleaned
}

export type CodexHostExtras = Pick<
  NonNullable<LyConfig['codexHost']>,
  'reviewExecutor' | 'codingExecutor' | 'codingModel' | 'reviewReasoningEffort' | 'codingReasoningEffort' | 'spawnableModels'
>

/**
 * 清洗并返回 init/menu 编辑 reviewModel 时需要保留的 codexHost 其余字段。
 * spawnableModels 按原形态透传（含格式非法或显式空数组），避免重写时静默丢失。
 */
export function sanitizeCodexHostExtras(codexHost: LyConfig['codexHost']): CodexHostExtras {
  if (!codexHost)
    return {}

  const reviewExecutor = sanitizeExecutor(codexHost.reviewExecutor)
  const codingExecutor = sanitizeExecutor(codexHost.codingExecutor)
  const codingModel = sanitizeModelField(codexHost.codingModel)
  const reviewReasoningEffort = sanitizeReasoningEffort(codexHost.reviewReasoningEffort)
  const codingReasoningEffort = sanitizeReasoningEffort(codexHost.codingReasoningEffort)

  return {
    ...(reviewExecutor ? { reviewExecutor } : {}),
    ...(codingExecutor ? { codingExecutor } : {}),
    ...(codingModel ? { codingModel } : {}),
    ...(reviewReasoningEffort ? { reviewReasoningEffort } : {}),
    ...(codingReasoningEffort ? { codingReasoningEffort } : {}),
    ...(codexHost.spawnableModels !== undefined ? { spawnableModels: codexHost.spawnableModels } : {}),
  }
}

/** init/menu 写回 codexHost 时的字段覆盖集合；key 存在即视为权威值，undefined 表示清除该字段 */
export interface CodexHostOverride {
  reviewExecutor?: ExecutorKind
  codingExecutor?: ExecutorKind
  reviewModel?: string
  codingModel?: string
  reviewReasoningEffort?: string
  codingReasoningEffort?: string
}

/**
 * 合并既有 codexHost 与本次采集结果：
 * - override 中存在的 key 为权威值，undefined 表示省略/清除该字段；
 * - override 中不存在的 key 保留既有值（供 menu 只编辑 review 字段时保留 coding）；
 * - spawnableModels 始终按既有原形态透传，不做清洗或丢弃。
 */
export function mergeCodexHostConfig(
  existing: LyConfig['codexHost'],
  override: CodexHostOverride = {},
): LyConfig['codexHost'] {
  const has = (key: keyof CodexHostOverride): boolean =>
    Object.prototype.hasOwnProperty.call(override, key)

  const reviewExecutor = sanitizeExecutor(has('reviewExecutor') ? override.reviewExecutor : existing?.reviewExecutor)
  const codingExecutor = sanitizeExecutor(has('codingExecutor') ? override.codingExecutor : existing?.codingExecutor)
  const reviewModel = sanitizeReviewModel(has('reviewModel') ? override.reviewModel : existing?.reviewModel)
  const codingModel = sanitizeModelField(has('codingModel') ? override.codingModel : existing?.codingModel)
  const reviewReasoningEffort = sanitizeReasoningEffort(has('reviewReasoningEffort') ? override.reviewReasoningEffort : existing?.reviewReasoningEffort)
  const codingReasoningEffort = sanitizeReasoningEffort(has('codingReasoningEffort') ? override.codingReasoningEffort : existing?.codingReasoningEffort)

  const merged: NonNullable<LyConfig['codexHost']> = {
    ...(reviewExecutor ? { reviewExecutor } : {}),
    ...(codingExecutor ? { codingExecutor } : {}),
    ...(reviewModel ? { reviewModel } : {}),
    ...(codingModel ? { codingModel } : {}),
    ...(reviewReasoningEffort ? { reviewReasoningEffort } : {}),
    ...(codingReasoningEffort ? { codingReasoningEffort } : {}),
    ...(existing?.spawnableModels !== undefined ? { spawnableModels: existing.spawnableModels } : {}),
  }

  return Object.keys(merged).length > 0 ? merged : undefined
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
