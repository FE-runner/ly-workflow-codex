import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SPAWNABLE_MODELS_DEFAULT } from '../../hosts/codex/schema'
import { createDefaultConfig, getConfigPath, getHostConfigPath, getHostLyDir, getLyDir, listInstalledHosts, mergeCodexHostConfig, readLyConfig, sanitizeCodexHostExtras, sanitizeModelField, sanitizeReasoningEffort, sanitizeReviewModel, sanitizeSpawnableModels, writeLyConfig } from '../config'

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
  rmSync(join(osMocks.home, '.codex', 'lyx'), { recursive: true, force: true })
  rmSync(join(osMocks.home, '.claude'), { recursive: true, force: true })
})

afterAll(() => {
  rmSync(osMocks.home, { recursive: true, force: true })
})

describe('createDefaultConfig (codex 宿主配置文件)', () => {
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

  it('does not persist an installed-hosts field (installed = config file exists)', () => {
    const config = createDefaultConfig(baseOptions) as any
    expect(config.installedHosts).toBeUndefined()
  })

  it('points all path constants into the new ~/.codex/lyx location', () => {
    const config = createDefaultConfig(baseOptions)
    const normalized = {
      commands: config.paths.commands.replace(/\\/g, '/'),
      prompts: config.paths.prompts.replace(/\\/g, '/'),
      backup: config.paths.backup.replace(/\\/g, '/'),
    }
    expect(normalized.commands).toBe(`${osMocks.home}/.codex/lyx/prompts`)
    expect(normalized.prompts).toBe(`${osMocks.home}/.codex/lyx/prompts`)
    expect(normalized.backup).toBe(`${osMocks.home}/.codex/lyx/backup`)
    expect(normalized.commands).not.toContain('.claude')
  })

  it('has no routing / performance (liteMode) fields', () => {
    const config = createDefaultConfig(baseOptions) as any
    expect(config.routing).toBeUndefined()
    expect(config.performance).toBeUndefined()
  })

  it('omits codexHost when reviewModel not provided', () => {
    const config = createDefaultConfig(baseOptions)
    expect(config.host).toBeUndefined()
  })

  it('stores codexHost.reviewModel when provided', () => {
    const config = createDefaultConfig({ ...baseOptions, host: { reviewModel: 'gpt-5.1-codex' } })
    expect(config.host?.reviewModel).toBe('gpt-5.1-codex')
  })

  it('stores reviewExecutor / codingExecutor and models when provided (direct pass-through)', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: { reviewExecutor: 'subagent', codingExecutor: 'subagent', reviewModel: 'a', codingModel: 'c' },
    })
    expect(config.host?.reviewExecutor).toBe('subagent')
    expect(config.host?.codingExecutor).toBe('subagent')
    expect(config.host?.reviewModel).toBe('a')
    expect(config.host?.codingModel).toBe('c')
  })

  it('stores reviewExecutor alone without requiring models', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: { reviewExecutor: 'subagent' },
    })
    expect(config.host?.reviewExecutor).toBe('subagent')
    expect(config.host?.reviewModel).toBeUndefined()
    expect(config.host?.codingExecutor).toBeUndefined()
  })

  it('treats invalid executor values as unset', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: { reviewExecutor: 'auto' as never },
    })
    expect(config.host?.reviewExecutor).toBeUndefined()
  })

  it('keeps out-of-list existing values as-is (custom pass-through)', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: { reviewModel: 'list-model', codingModel: ' custom ' },
    })
    expect(config.host?.reviewModel).toBe('list-model')
    expect(config.host?.codingModel).toBe('custom')
  })

  it('treats blank model fields as unset (fall back to session model)', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: { reviewModel: 'a', codingModel: '' },
    })
    expect(config.host?.reviewModel).toBe('a')
    expect(config.host?.codingModel).toBeUndefined()
  })

  it('omits codexHost when reviewModel is blank', () => {
    const config = createDefaultConfig({ ...baseOptions, host: { reviewModel: '  ' } })
    expect(config.host).toBeUndefined()
  })

  it('stores both reasoning effort fields when provided', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: {
        reviewExecutor: 'subagent',
        codingExecutor: 'subagent',
        reviewModel: 'glm-5.3-flash',
        codingModel: 'deepseek-v4.1-flash',
        reviewReasoningEffort: 'low',
        codingReasoningEffort: 'max',
      },
    })
    expect(config.host?.reviewReasoningEffort).toBe('low')
    expect(config.host?.codingReasoningEffort).toBe('max')
  })

  it('stores a reasoning effort field even when the corresponding model is blank', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: { reviewReasoningEffort: 'low' },
    })
    expect(config.host).toEqual({ reviewReasoningEffort: 'low' })
  })

  it('trims reasoning effort fields and omits blank values', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: {
        reviewModel: 'glm-5.3-flash',
        reviewReasoningEffort: ' low ',
        codingReasoningEffort: '',
      },
    })
    expect(config.host?.reviewReasoningEffort).toBe('low')
    expect(config.host?.codingReasoningEffort).toBeUndefined()
  })

  it('keeps reasoning effort fields alongside other codexHost fields', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: {
        reviewExecutor: 'subagent',
        reviewModel: 'glm-5.3-flash',
        codingModel: 'deepseek-v4.1-flash',
        reviewReasoningEffort: 'low',
        spawnableModels: ['glm-5.3-flash'],
      },
    })
    expect(config.host).toEqual({
      reviewExecutor: 'subagent',
      reviewModel: 'glm-5.3-flash',
      codingModel: 'deepseek-v4.1-flash',
      reviewReasoningEffort: 'low',
      spawnableModels: ['glm-5.3-flash'],
    })
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

  // 与 sanitizeModelField 同口径：仅 trim、不做字符白名单清洗（不再拼进 shell 命令串，
  // 由模板指示 + 宿主 spawn 能力落实），含 @ 等字符的模型 id 原样保真
  it('preserves characters outside the whitelist (no whitelist cleaning)', () => {
    expect(sanitizeReviewModel('gpt 5.1')).toBe('gpt 5.1')
    expect(sanitizeReviewModel('vendor/model@beta')).toBe('vendor/model@beta')
    expect(sanitizeReviewModel('openai/gpt-5.1:high')).toBe('openai/gpt-5.1:high')
  })
})

describe('sanitizeModelField', () => {
  it('trims valid model names', () => {
    expect(sanitizeModelField(' gpt-5.1 ')).toBe('gpt-5.1')
  })

  it('returns undefined for blank/invalid values', () => {
    expect(sanitizeModelField('')).toBeUndefined()
    expect(sanitizeModelField('   ')).toBeUndefined()
    expect(sanitizeModelField(42)).toBeUndefined()
    expect(sanitizeModelField(undefined)).toBeUndefined()
  })

  it('preserves characters outside the whitelist (no whitelist cleaning)', () => {
    expect(sanitizeModelField('gpt 5.1')).toBe('gpt 5.1')
    expect(sanitizeModelField('vendor/model@beta')).toBe('vendor/model@beta')
  })
})

describe('sanitizeReasoningEffort', () => {
  it('trims non-empty reasoning effort values', () => {
    expect(sanitizeReasoningEffort(' low ')).toBe('low')
    expect(sanitizeReasoningEffort('max')).toBe('max')
  })

  it('returns undefined for blank/invalid values without enum validation', () => {
    expect(sanitizeReasoningEffort('')).toBeUndefined()
    expect(sanitizeReasoningEffort('   ')).toBeUndefined()
    expect(sanitizeReasoningEffort(42)).toBeUndefined()
    expect(sanitizeReasoningEffort(undefined)).toBeUndefined()
    expect(sanitizeReasoningEffort('custom-tier')).toBe('custom-tier')
  })
})

describe('sanitizeCodexHostExtras', () => {
  it('returns executors and other fields except reviewModel with sanitized text values', () => {
    expect(sanitizeCodexHostExtras({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewModel: 'a',
      codingModel: ' c ',
      reviewReasoningEffort: ' low ',
      codingReasoningEffort: ' max ',
      spawnableModels: ['glm-5.3-flash'],
    })).toEqual({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      codingModel: 'c',
      reviewReasoningEffort: 'low',
      codingReasoningEffort: 'max',
      spawnableModels: ['glm-5.3-flash'],
    })
  })

  it('preserves spawnableModels exact shape while dropping blank text fields', () => {
    const spawnableModels = ['', 'glm-5.3-flash'] as unknown as string[]
    expect(sanitizeCodexHostExtras({
      codingModel: '',
      reviewReasoningEffort: ' ',
      codingReasoningEffort: '',
      spawnableModels,
    })).toEqual({ spawnableModels })
  })

  it('round-trips extras through createDefaultConfig', async () => {
    const extras = sanitizeCodexHostExtras({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewModel: 'old',
      codingModel: 'deepseek-v4.1-flash',
      reviewReasoningEffort: 'low',
      codingReasoningEffort: 'max',
      spawnableModels: ['glm-5.3-flash'],
    })
    const config = createDefaultConfig({
      language: 'zh-CN',
      installedWorkflows: ['propose'],
      host: { ...extras, reviewModel: 'glm-5.3-flash' },
    })
    await writeLyConfig(config)

    const readBack = await readLyConfig()
    expect(readBack?.host).toEqual({
      ...extras,
      reviewModel: 'glm-5.3-flash',
    })
  })
})

describe('mergeCodexHostConfig (configure-subagent-reasoning-effort)', () => {
  it('explicit undefined override clears the field while preserving unrelated extras', () => {
    const merged = mergeCodexHostConfig({
      reviewExecutor: 'subagent',
      reviewModel: 'glm-5.3-flash',
      reviewReasoningEffort: 'low',
      codingModel: 'deepseek-v4.1-flash',
      codingReasoningEffort: 'max',
      spawnableModels: ['glm-5.3-flash'],
    }, {
      reviewReasoningEffort: undefined,
    })

    expect(merged).toEqual({
      reviewExecutor: 'subagent',
      reviewModel: 'glm-5.3-flash',
      codingModel: 'deepseek-v4.1-flash',
      codingReasoningEffort: 'max',
      spawnableModels: ['glm-5.3-flash'],
    })
  })

  it('override value replaces the existing reasoning effort', () => {
    const merged = mergeCodexHostConfig(
      { reviewReasoningEffort: 'low' },
      { reviewReasoningEffort: ' high ' },
    )
    expect(merged?.reviewReasoningEffort).toBe('high')
  })

  it('omitted override keys preserve existing fields (menu review-only edit)', () => {
    const merged = mergeCodexHostConfig({
      reviewModel: 'old',
      reviewReasoningEffort: 'low',
      codingExecutor: 'subagent',
      codingModel: 'deepseek-v4.1-flash',
      codingReasoningEffort: 'max',
    }, {
      reviewModel: 'new',
      reviewReasoningEffort: undefined,
    })

    expect(merged).toEqual({
      reviewModel: 'new',
      codingExecutor: 'subagent',
      codingModel: 'deepseek-v4.1-flash',
      codingReasoningEffort: 'max',
    })
  })

  it('clearing the only field returns undefined codexHost', () => {
    expect(mergeCodexHostConfig({ reviewReasoningEffort: 'low' }, { reviewReasoningEffort: undefined })).toBeUndefined()
  })
})

describe('sPAWNABLE_MODELS_DEFAULT / sanitizeSpawnableModels (codex-model-config)', () => {
  it('defines the built-in default as the five OpenAI models', () => {
    expect(SPAWNABLE_MODELS_DEFAULT).toEqual([
      'gpt-6-astra',
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
    ])
  })

  it('treats missing config as unset', () => {
    expect(sanitizeSpawnableModels(undefined)).toEqual({ state: 'unset', models: [] })
    expect(sanitizeSpawnableModels(null)).toEqual({ state: 'unset', models: [] })
  })

  it('trims, dedupes and filters non-strings for a valid array', () => {
    expect(sanitizeSpawnableModels([' gpt-5.5 ', 'gpt-5.5', 42, 'gpt-5.6-sol'])).toEqual({
      state: 'ok',
      models: ['gpt-5.5', 'gpt-5.6-sol'],
    })
  })

  it('marks an explicitly present non-array as invalid', () => {
    expect(sanitizeSpawnableModels('glm-5.3-flash')).toEqual({ state: 'invalid', models: [] })
    expect(sanitizeSpawnableModels(42)).toEqual({ state: 'invalid', models: [] })
  })

  it('marks an explicitly empty / fully-cleaned array as empty', () => {
    expect(sanitizeSpawnableModels([])).toEqual({ state: 'empty', models: [] })
    expect(sanitizeSpawnableModels(['', '  '])).toEqual({ state: 'empty', models: [] })
    expect(sanitizeSpawnableModels([42, null])).toEqual({ state: 'empty', models: [] })
  })
})

describe('createDefaultConfig spawnableModels 透传保全 (codex-model-config)', () => {
  const baseOptions = {
    language: 'zh-CN' as const,
    installedWorkflows: ['propose'],
  }

  it('passes through spawnableModels alongside the executor and model fields', () => {
    const config = createDefaultConfig({
      ...baseOptions,
      host: { reviewExecutor: 'subagent', reviewModel: 'a', codingModel: 'c', spawnableModels: ['glm-5.3-flash'] },
    })
    expect(config.host).toEqual({
      reviewExecutor: 'subagent',
      reviewModel: 'a',
      codingModel: 'c',
      spawnableModels: ['glm-5.3-flash'],
    })
  })

  it('preserves spawnableModels even when all model fields are blank', () => {
    const config = createDefaultConfig({ ...baseOptions, host: { spawnableModels: [] } })
    expect(config.host?.spawnableModels).toEqual([])
  })

  it('omits codexHost when nothing (including spawnableModels) is provided', () => {
    const config = createDefaultConfig(baseOptions)
    expect(config.host).toBeUndefined()
  })
})

describe('readLyConfig / writeLyConfig', () => {
  it('writes and reads back config at ~/.codex/lyx/config.toml', async () => {
    const config = createDefaultConfig({
      language: 'en',
      installedWorkflows: ['propose'],
      host: { reviewModel: 'gpt-5.1', spawnableModels: ['gpt-5.6-luna'] },
    })
    await writeLyConfig(config)

    expect(existsSync(join(osMocks.home, '.codex', 'lyx', 'config.toml'))).toBe(true)
    const readBack = await readLyConfig()
    expect(readBack?.general?.version).toBe(config.general.version)
    expect(readBack?.general?.language).toBe('en')
    expect(readBack?.workflows?.installed).toEqual(['propose'])
    expect(readBack?.host?.reviewModel).toBe('gpt-5.1')
    expect(readBack?.host?.spawnableModels).toEqual(['gpt-5.6-luna'])
    expect((readBack as any)?.installedHosts).toBeUndefined()
  })

  it('returns null when no config file exists', async () => {
    expect(await readLyConfig()).toBeNull()
  })

  it('ignores legacy routing/performance fields on read and drops them on write', async () => {
    mkdirSync(join(osMocks.home, '.codex', 'lyx'), { recursive: true })
    writeFileSync(join(osMocks.home, '.codex', 'lyx', 'config.toml'), [
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
    const content = readFileSync(join(osMocks.home, '.codex', 'lyx', 'config.toml'), 'utf-8')
    expect(content).not.toContain('[routing]')
    expect(content).not.toContain('liteMode')
  })

  it('never reads, modifies or deletes a legacy ~/.ly/config.toml', async () => {
    const legacyFile = join(osMocks.home, '.ly', 'config.toml')
    mkdirSync(join(osMocks.home, '.ly'), { recursive: true })
    const legacyContent = 'general = { version = "0.0.1", language = "zh-CN" }\n[codexHost]\nreviewModel = "legacy-model"\n'
    writeFileSync(legacyFile, legacyContent)

    const config = createDefaultConfig({ language: 'en', installedWorkflows: ['propose'] })
    await writeLyConfig(config)
    await readLyConfig()

    expect(readFileSync(legacyFile, 'utf-8')).toBe(legacyContent)
    expect(existsSync(join(osMocks.home, '.codex', 'lyx', 'config.toml'))).toBe(true)
  })
})

describe('per-host config files (add-claude-host)', () => {
  const codexFile = () => join(osMocks.home, '.codex', 'lyx', 'config.toml')
  const claudeLyDir = () => join(osMocks.home, '.claude-test', 'lyx')

  it('resolves config paths per host', () => {
    expect(getHostConfigPath('codex').replace(/\\/g, '/')).toBe(`${osMocks.home}/.codex/lyx/config.toml`)
    expect(getHostConfigPath('codex', { lyDir: claudeLyDir() })).toBe(join(claudeLyDir(), 'config.toml'))
  })

  it('keeps legacy no-arg path functions pointing to the codex host', () => {
    expect(getConfigPath()).toBe(getHostConfigPath('codex'))
    expect(getLyDir()).toBe(getHostLyDir('codex'))
  })

  it('writes two host locations without overwriting each other', async () => {
    await writeLyConfig(createDefaultConfig({ language: 'zh-CN', installedWorkflows: ['propose'], host: { reviewExecutor: 'subagent' } }))
    await writeLyConfig(
      createDefaultConfig({ language: 'en', installedWorkflows: ['commit'], host: { codingExecutor: 'subagent' } }),
      'codex',
      { lyDir: claudeLyDir() },
    )
    const a = await readLyConfig()
    const b = await readLyConfig('codex', { lyDir: claudeLyDir() })
    expect(a?.general.language).toBe('zh-CN')
    expect(a?.host?.reviewExecutor).toBe('subagent')
    expect(a?.host?.codingExecutor).toBeUndefined()
    expect(b?.general.language).toBe('en')
    expect(b?.host?.codingExecutor).toBe('subagent')
    expect(b?.host?.reviewExecutor).toBeUndefined()
    rmSync(join(osMocks.home, '.claude-test'), { recursive: true, force: true })
  })

  it('reads the legacy [codexHost] section as [host] and rewrites it normalized', async () => {
    mkdirSync(join(osMocks.home, '.codex', 'lyx'), { recursive: true })
    writeFileSync(codexFile(), [
      'general = { version = "0.6.1", language = "zh-CN" }',
      'workflows = { installed = ["propose"] }',
      '[codexHost]',
      'reviewExecutor = "subagent"',
      'reviewModel = "glm-5.3-flash"',
      'reviewReasoningEffort = "high"',
      'codingExecutor = "main"',
    ].join('\n'))

    const legacy = await readLyConfig()
    expect(legacy?.host).toEqual({
      reviewExecutor: 'subagent',
      reviewModel: 'glm-5.3-flash',
      reviewReasoningEffort: 'high',
      codingExecutor: 'main',
    })
    expect((legacy as any).codexHost).toBeUndefined()

    await writeLyConfig(legacy!)
    const content = readFileSync(codexFile(), 'utf-8')
    expect(content).toContain('[host]')
    expect(content).not.toContain('[codexHost]')
    const rewritten = await readLyConfig()
    expect(rewritten?.host).toEqual(legacy?.host)
  })

  it('prefers [host] over a stale legacy section when both exist', async () => {
    mkdirSync(join(osMocks.home, '.codex', 'lyx'), { recursive: true })
    writeFileSync(codexFile(), [
      'general = { version = "0.6.1", language = "zh-CN" }',
      '[host]',
      'reviewModel = "new"',
      '[codexHost]',
      'reviewModel = "old"',
    ].join('\n'))
    const config = await readLyConfig()
    expect(config?.host?.reviewModel).toBe('new')
    expect((config as any).codexHost).toBeUndefined()
  })

  it('ignores a persisted installedHosts field; disk config files are authoritative', async () => {
    mkdirSync(join(osMocks.home, '.codex', 'lyx'), { recursive: true })
    writeFileSync(codexFile(), [
      'installedHosts = ["codex", "claude"]',
      'general = { version = "0.6.1", language = "zh-CN" }',
    ].join('\n'))

    const config = await readLyConfig()
    expect((config as any).installedHosts).toBeUndefined()
    // 历史字段声称装了 claude，但磁盘上只有 codex 的配置文件 → 以磁盘为准
    expect(await listInstalledHosts()).toEqual(['codex'])

    await writeLyConfig(config!)
    expect(readFileSync(codexFile(), 'utf-8')).not.toContain('installedHosts')
  })

  it('lists no installed hosts when no config file exists', async () => {
    expect(await listInstalledHosts()).toEqual([])
  })
})
