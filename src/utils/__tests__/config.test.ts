import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultConfig, migrateLegacyConfig, readLyConfig, sanitizeInstalledHosts, sanitizeReviewModel, writeLyConfig } from '../config'

// 模块顶层常量（CONFIG_FILE / LY_DIR 等）在 import 时基于 homedir() 求值，
// 因此 hoisted 阶段就创建固定临时 home，再 mock homedir() 指向它——
// 保证路径常量落在临时目录、迁移/读写测试绝不触碰真实用户目录。
const osMocks = vi.hoisted(() => {
  const { mkdtempSync } = require('node:fs') as typeof import('node:fs')
  const { tmpdir } = require('node:os') as typeof import('node:os')
  const { join } = require('node:path') as typeof import('node:path')
  const home = mkdtempSync(join(tmpdir(), 'ly-config-test-'))
  return { home }
})

vi.mock('node:os', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:os')>()
  return { ...mod, homedir: () => osMocks.home }
})

/** 每个用例前清空临时 home 内可能残留的配置目录 */
beforeEach(() => {
  rmSync(join(osMocks.home, '.ly'), { recursive: true, force: true })
  rmSync(join(osMocks.home, '.claude'), { recursive: true, force: true })
})

afterAll(() => {
  rmSync(osMocks.home, { recursive: true, force: true })
})

describe('createDefaultConfig (codex 单宿主)', () => {
  const baseOptions = {
    language: 'zh-CN' as const,
    installedWorkflows: ['init-project', 'commit'],
  }

  it('sets version from package.json', () => {
    const config = createDefaultConfig(baseOptions)
    expect(config.general.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('sets language correctly', () => {
    const config = createDefaultConfig(baseOptions)
    expect(config.general.language).toBe('zh-CN')
  })

  it('sets createdAt as ISO string', () => {
    const config = createDefaultConfig(baseOptions)
    expect(() => new Date(config.general.createdAt)).not.toThrow()
    expect(new Date(config.general.createdAt).toISOString()).toBe(config.general.createdAt)
  })

  it('stores installed workflows', () => {
    const config = createDefaultConfig(baseOptions)
    expect(config.workflows.installed).toEqual(['init-project', 'commit'])
  })

  it('defaults installedHosts to [codex]', () => {
    const config = createDefaultConfig(baseOptions)
    expect(config.installedHosts).toEqual(['codex'])
  })

  it('persists installedHosts for codex-only installs', () => {
    const config = createDefaultConfig({ ...baseOptions, installedHosts: ['codex'] })
    expect(config.installedHosts).toEqual(['codex'])
  })

  it('accepts legacy dual-host values when reading old configs', () => {
    const config = createDefaultConfig({ ...baseOptions, installedHosts: ['claude', 'codex'] })
    expect(config.installedHosts).toEqual(['claude', 'codex'])
  })

  it('filters invalid hosts out of installedHosts and falls back to [codex]', () => {
    const config = createDefaultConfig({ ...baseOptions, installedHosts: ['gemini', 42] as any })
    expect(config.installedHosts).toEqual(['codex'])
  })

  it('falls back to [codex] when installedHosts is empty', () => {
    const config = createDefaultConfig({ ...baseOptions, installedHosts: [] })
    expect(config.installedHosts).toEqual(['codex'])
  })

  it('points all path constants into the new ~/.ly location', () => {
    const config = createDefaultConfig(baseOptions)
    const normalized = {
      commands: config.paths.commands.replace(/\\/g, '/'),
      prompts: config.paths.prompts.replace(/\\/g, '/'),
      backup: config.paths.backup.replace(/\\/g, '/'),
    }
    expect(normalized.commands).toBe(`${osMocks.home}/.ly/prompts`)
    expect(normalized.prompts).toBe(`${osMocks.home}/.ly/prompts`)
    expect(normalized.backup).toBe(`${osMocks.home}/.ly/backup`)
    expect(normalized.commands).not.toContain('.claude')
  })

  it('has no routing / performance (liteMode) fields', () => {
    const config = createDefaultConfig(baseOptions) as any
    expect(config.routing).toBeUndefined()
    expect(config.performance).toBeUndefined()
  })

  it('omits codexHost when reviewModel not provided', () => {
    const config = createDefaultConfig(baseOptions)
    expect(config.codexHost).toBeUndefined()
  })

  it('stores codexHost.reviewModel when provided', () => {
    const config = createDefaultConfig({ ...baseOptions, codexHost: { reviewModel: 'gpt-5.1-codex' } })
    expect(config.codexHost?.reviewModel).toBe('gpt-5.1-codex')
  })

  it('omits codexHost when reviewModel is blank', () => {
    const config = createDefaultConfig({ ...baseOptions, codexHost: { reviewModel: '  ' } })
    expect(config.codexHost).toBeUndefined()
  })
})

describe('sanitizeInstalledHosts', () => {
  it('filters invalid entries and dedupes', () => {
    expect(sanitizeInstalledHosts(['claude', 'codex', 'claude'])).toEqual(['claude', 'codex'])
    expect(sanitizeInstalledHosts(['gemini', 42, undefined])).toEqual([])
    expect(sanitizeInstalledHosts(undefined)).toEqual([])
  })

  it('keeps codex', () => {
    expect(sanitizeInstalledHosts(['codex'])).toEqual(['codex'])
  })
})

describe('sanitizeReviewModel', () => {
  it('trims valid model names', () => {
    expect(sanitizeReviewModel(' gpt-5.1 ')).toBe('gpt-5.1')
  })

  it('returns undefined for blank/invalid values', () => {
    expect(sanitizeReviewModel('')).toBeUndefined()
    expect(sanitizeReviewModel('   ')).toBeUndefined()
    expect(sanitizeReviewModel(42)).toBeUndefined()
    expect(sanitizeReviewModel(undefined)).toBeUndefined()
  })

  // 白名单 [A-Za-z0-9._:/-]——该值拼进 `codex exec -m` 命令串
  it('keeps whitelist characters (letters/digits/dot/underscore/colon/slash/hyphen)', () => {
    expect(sanitizeReviewModel('gpt-5.1-codex')).toBe('gpt-5.1-codex')
    expect(sanitizeReviewModel('openai/gpt-5.1:high')).toBe('openai/gpt-5.1:high')
    expect(sanitizeReviewModel('qwen3_coder-480b')).toBe('qwen3_coder-480b')
  })

  it('strips characters outside the whitelist', () => {
    expect(sanitizeReviewModel('gpt 5.1')).toBe('gpt5.1')
    expect(sanitizeReviewModel('gpt;rm -rf /')).toBe('gptrm-rf/')
    expect(sanitizeReviewModel('model"x')).toBe('modelx')
  })

  it('returns undefined when only illegal characters remain', () => {
    expect(sanitizeReviewModel('***')).toBeUndefined()
    expect(sanitizeReviewModel(' ; ')).toBeUndefined()
  })
})

describe('legacy config migration (~/.claude/.ly → ~/.ly)', () => {
  it('moves legacy config to ~/.ly/config.toml and preserves its value', async () => {
    const legacyDir = join(osMocks.home, '.claude', '.ly')
    const legacyFile = join(legacyDir, 'config.toml')
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(legacyFile, 'general = { version = "0.0.1", language = "zh-CN" }\n')

    expect(await migrateLegacyConfig()).toBe(true)
    expect(existsSync(legacyFile)).toBe(false)
    expect(existsSync(join(osMocks.home, '.ly', 'config.toml'))).toBe(true)

    const config = await readLyConfig()
    expect(config?.general?.version).toBe('0.0.1')
  })

  it('does not overwrite an existing new-location config', async () => {
    const legacyDir = join(osMocks.home, '.claude', '.ly')
    const legacyFile = join(legacyDir, 'config.toml')
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(legacyFile, 'general = { version = "1.0.0" }\n')
    mkdirSync(join(osMocks.home, '.ly'), { recursive: true })
    writeFileSync(join(osMocks.home, '.ly', 'config.toml'), 'general = { version = "2.0.0" }\n')

    expect(await migrateLegacyConfig()).toBe(false)
    expect(existsSync(legacyFile)).toBe(true)
    const config = await readLyConfig()
    expect(config?.general?.version).toBe('2.0.0')
  })

  it('returns false when the legacy location does not exist', async () => {
    expect(await migrateLegacyConfig()).toBe(false)
    expect(existsSync(join(osMocks.home, '.ly', 'config.toml'))).toBe(false)
  })

  it('skips migration when ~/.claude still hosts active ly-workflow products (commands/ly)', async () => {
    const legacyDir = join(osMocks.home, '.claude', '.ly')
    const legacyFile = join(legacyDir, 'config.toml')
    mkdirSync(join(osMocks.home, '.claude', 'commands', 'ly'), { recursive: true })
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(legacyFile, 'general = { version = "9.9.9", language = "zh-CN" }\n')

    expect(await migrateLegacyConfig()).toBe(false)
    // 他方在用配置不被搬走
    expect(existsSync(legacyFile)).toBe(true)
    expect(existsSync(join(osMocks.home, '.ly', 'config.toml'))).toBe(false)
  })

  it('skips migration when legacy config carries claude-host markers', async () => {
    const legacyDir = join(osMocks.home, '.claude', '.ly')
    const legacyFile = join(legacyDir, 'config.toml')
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(legacyFile, 'general = { version = "8.8.8" }\ninstalledHosts = ["claude", "codex"]\n')

    expect(await migrateLegacyConfig()).toBe(false)
    expect(existsSync(legacyFile)).toBe(true)
  })
})

describe('readLyConfig / writeLyConfig', () => {
  it('writes and reads back config at ~/.ly/config.toml', async () => {
    const config = createDefaultConfig({
      language: 'en',
      installedWorkflows: ['propose'],
      codexHost: { reviewModel: 'gpt-5.1' },
    })
    await writeLyConfig(config)

    expect(existsSync(join(osMocks.home, '.ly', 'config.toml'))).toBe(true)
    const readBack = await readLyConfig()
    expect(readBack?.general?.version).toBe(config.general.version)
    expect(readBack?.general?.language).toBe('en')
    expect(readBack?.workflows?.installed).toEqual(['propose'])
    expect(readBack?.codexHost?.reviewModel).toBe('gpt-5.1')
    expect(readBack?.installedHosts).toEqual(['codex'])
  })

  it('returns null when no config file exists', async () => {
    expect(await readLyConfig()).toBeNull()
  })

  it('ignores legacy routing/performance fields on read and drops them on write', async () => {
    mkdirSync(join(osMocks.home, '.ly'), { recursive: true })
    writeFileSync(join(osMocks.home, '.ly', 'config.toml'), [
      'general = { version = "0.0.3", language = "en" }',
      'workflows = { installed = ["propose"] }',
      '[routing]',
      'reviewer = "codex"',
      '[performance]',
      'liteMode = true',
    ].join('\n'))

    const config = await readLyConfig()
    expect(config?.general?.language).toBe('en')
    expect((config as any).routing).toBeUndefined()
    expect((config as any).performance).toBeUndefined()

    await writeLyConfig(config!)
    const content = readFileSync(join(osMocks.home, '.ly', 'config.toml'), 'utf-8')
    expect(content).not.toContain('[routing]')
    expect(content).not.toContain('liteMode')
  })
})
