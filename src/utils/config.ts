import type { ExecutorKind, HostSection, LyConfig, SupportedLang } from '../types'
import type { HostId } from './host-adapters'
import fs from 'fs-extra'
import { join } from 'pathe'
import { parse, stringify } from 'smol-toml'
import { version as packageVersion } from '../../package.json'
import { DEFAULT_HOST, getAdapter, listRegisteredHosts } from './host-adapters'

// ═══════════════════════════════════════════════════════
// 每宿主一个配置文件：<宿主 lyDir>/config.toml；"已安装"由该文件存在判定
// ═══════════════════════════════════════════════════════

/** 配置文件名（位于各宿主的私有目录下） */
export const CONFIG_FILE_NAME = 'config.toml'

/** 读写配置时可注入的路径覆盖（测试用） */
export interface HostConfigLocation {
  /** 宿主私有目录（缺省取适配器默认值） */
  lyDir?: string
}

export function getHostLyDir(host: HostId, location: HostConfigLocation = {}): string {
  return location.lyDir ?? getAdapter(host).defaultPaths().lyDir
}

export function getHostConfigPath(host: HostId, location: HostConfigLocation = {}): string {
  return join(getHostLyDir(host, location), CONFIG_FILE_NAME)
}

export function getHostPromptsDir(host: HostId): string {
  return getAdapter(host).defaultPaths().promptsDir
}

/** @deprecated 使用 getHostPromptsDir(host)；无参形态固定指向默认宿主（codex） */
export function getLyPromptsDir(): string {
  return getHostPromptsDir(DEFAULT_HOST)
}

/** @deprecated 使用 getHostLyDir(host)；无参形态固定指向默认宿主（codex） */
export function getLyDir(): string {
  return getHostLyDir(DEFAULT_HOST)
}

/** @deprecated 使用 getHostConfigPath(host)；无参形态固定指向默认宿主（codex） */
export function getConfigPath(): string {
  return getHostConfigPath(DEFAULT_HOST)
}

/**
 * 已安装宿主：扫描各已注册宿主的配置文件是否存在（不再依赖任何持久化的宿主集合字段）。
 * locations 供测试注入各宿主的 lyDir。
 */
export async function listInstalledHosts(locations: Partial<Record<HostId, HostConfigLocation>> = {}): Promise<HostId[]> {
  const installed: HostId[] = []
  for (const host of listRegisteredHosts()) {
    if (await fs.pathExists(getHostConfigPath(host, locations[host])))
      installed.push(host)
  }
  return installed
}

export async function ensureLyDir(host: HostId = DEFAULT_HOST, location: HostConfigLocation = {}): Promise<void> {
  await fs.ensureDir(getHostLyDir(host, location))
}

/**
 * 解析后的原始配置 → 运行时配置：
 * - 宿主配置节归一为 [host]；[host] 缺失时按适配器声明的历史节名（如 [codexHost]）兼容读取
 * - 历史字段一律丢弃，不进入运行时配置、也不随写入持久化：
 *   各历史节名、installedHosts（"已安装"改由配置文件存在判定）、routing / performance
 */
export function normalizeLyConfig(parsed: Record<string, unknown>, host: HostId): LyConfig {
  const legacySections = getAdapter(host).legacyConfigSections ?? []
  if (parsed.host === undefined) {
    const legacy = legacySections.find(key => parsed[key] !== undefined)
    if (legacy)
      parsed.host = parsed[legacy]
  }
  for (const key of legacySections)
    delete parsed[key]
  delete parsed.installedHosts
  delete parsed.routing
  delete parsed.performance
  return parsed as unknown as LyConfig
}

export async function readLyConfig(host: HostId = DEFAULT_HOST, location: HostConfigLocation = {}): Promise<LyConfig | null> {
  try {
    const file = getHostConfigPath(host, location)
    if (await fs.pathExists(file)) {
      const parsed = parse(await fs.readFile(file, 'utf-8')) as Record<string, unknown>
      return normalizeLyConfig(parsed, host)
    }
  }
  catch {
    // Config doesn't exist or is invalid
  }
  return null
}

export async function writeLyConfig(config: LyConfig, host: HostId = DEFAULT_HOST, location: HostConfigLocation = {}): Promise<void> {
  await ensureLyDir(host, location)
  // 写入前同样归一：调用方即使带着历史字段也不会被写回
  const normalized = normalizeLyConfig({ ...(config as unknown as Record<string, unknown>) }, host)
  await fs.writeFile(getHostConfigPath(host, location), stringify(normalized as any), 'utf-8')
}

export function createDefaultConfig(options: {
  language: SupportedLang
  installedWorkflows: string[]
  /** 目标宿主（决定 paths 取值）；缺省为默认宿主 */
  hostId?: HostId
  host?: HostSection
}): LyConfig {
  const paths = getAdapter(options.hostId ?? DEFAULT_HOST).defaultPaths()
  const config: LyConfig = {
    general: {
      version: packageVersion,
      language: options.language,
      createdAt: new Date().toISOString(),
    },
    workflows: {
      installed: options.installedWorkflows,
    },
    paths: {
      commands: paths.promptsDir,
      prompts: paths.promptsDir,
      backup: join(paths.lyDir, 'backup'),
    },
  }
  const reviewExecutor = sanitizeExecutor(options.host?.reviewExecutor)
  const codingExecutor = sanitizeExecutor(options.host?.codingExecutor)
  const reviewModel = sanitizeReviewModel(options.host?.reviewModel)
  // 模型字段统一仅 trim（sanitizeReviewModel 与 sanitizeModelField 同口径）、空白视为未配置
  // （回退当前会话模型）：不再拼进 shell 命令串，由模板指示 + 宿主能力落实
  const codingModel = sanitizeModelField(options.host?.codingModel)
  const reviewReasoningEffort = sanitizeReasoningEffort(options.host?.reviewReasoningEffort)
  const codingReasoningEffort = sanitizeReasoningEffort(options.host?.codingReasoningEffort)
  // spawnableModels 透传并保全：不改写、不静默丢弃存量值（含格式非法的存量形态由 doctor WARN 暴露），
  // 避免"重装即丢失非法值、下次 doctor 不再告警"掩盖配置问题
  const spawnableModels = options.host?.spawnableModels
  if (
    reviewExecutor
    || codingExecutor
    || reviewModel
    || codingModel
    || reviewReasoningEffort
    || codingReasoningEffort
    || spawnableModels !== undefined
  ) {
    config.host = {
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

export type HostExtras = Pick<
  HostSection,
  'reviewExecutor' | 'codingExecutor' | 'codingModel' | 'reviewReasoningEffort' | 'codingReasoningEffort' | 'spawnableModels'
>

/**
 * 清洗并返回 init/menu 编辑 reviewModel 时需要保留的 codexHost 其余字段。
 * spawnableModels 按原形态透传（含格式非法或显式空数组），避免重写时静默丢失。
 */
export function sanitizeHostExtras(hostSection: LyConfig['host']): HostExtras {
  if (!hostSection)
    return {}

  const reviewExecutor = sanitizeExecutor(hostSection.reviewExecutor)
  const codingExecutor = sanitizeExecutor(hostSection.codingExecutor)
  const codingModel = sanitizeModelField(hostSection.codingModel)
  const reviewReasoningEffort = sanitizeReasoningEffort(hostSection.reviewReasoningEffort)
  const codingReasoningEffort = sanitizeReasoningEffort(hostSection.codingReasoningEffort)

  return {
    ...(reviewExecutor ? { reviewExecutor } : {}),
    ...(codingExecutor ? { codingExecutor } : {}),
    ...(codingModel ? { codingModel } : {}),
    ...(reviewReasoningEffort ? { reviewReasoningEffort } : {}),
    ...(codingReasoningEffort ? { codingReasoningEffort } : {}),
    ...(hostSection.spawnableModels !== undefined ? { spawnableModels: hostSection.spawnableModels } : {}),
  }
}

/** init/menu 写回 codexHost 时的字段覆盖集合；key 存在即视为权威值，undefined 表示清除该字段 */
export interface HostOverride {
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
export function mergeHostConfig(
  existing: LyConfig['host'],
  override: HostOverride = {},
): LyConfig['host'] {
  const has = (key: keyof HostOverride): boolean =>
    Object.prototype.hasOwnProperty.call(override, key)

  const reviewExecutor = sanitizeExecutor(has('reviewExecutor') ? override.reviewExecutor : existing?.reviewExecutor)
  const codingExecutor = sanitizeExecutor(has('codingExecutor') ? override.codingExecutor : existing?.codingExecutor)
  const reviewModel = sanitizeReviewModel(has('reviewModel') ? override.reviewModel : existing?.reviewModel)
  const codingModel = sanitizeModelField(has('codingModel') ? override.codingModel : existing?.codingModel)
  const reviewReasoningEffort = sanitizeReasoningEffort(has('reviewReasoningEffort') ? override.reviewReasoningEffort : existing?.reviewReasoningEffort)
  const codingReasoningEffort = sanitizeReasoningEffort(has('codingReasoningEffort') ? override.codingReasoningEffort : existing?.codingReasoningEffort)

  const merged: HostSection = {
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

/** @deprecated 使用 sanitizeHostExtras */
export const sanitizeCodexHostExtras = sanitizeHostExtras
/** @deprecated 使用 mergeHostConfig */
export const mergeCodexHostConfig = mergeHostConfig
