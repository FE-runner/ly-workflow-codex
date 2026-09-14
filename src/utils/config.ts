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
  codexHost?: { reviewModel?: string }
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
  if (reviewModel) {
    config.codexHost = { reviewModel }
  }
  return config
}

/**
 * codex 宿主审查模型（codexHost.reviewModel）清洗：
 * 非字符串 → undefined；先 trim，再按白名单 [A-Za-z0-9._:/-] 剔除非法字符
 * （该值会拼进 `codex exec -m <model>` 命令串，只允许模型名安全字符）；
 * 剔除后为空 → undefined（渲染时回退当前会话模型，exec 不带 -m）。
 */
export function sanitizeReviewModel(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim().replace(/[^\w.:/-]/g, '')
  return cleaned === '' ? undefined : cleaned
}
