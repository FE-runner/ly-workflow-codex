import type { InitOptions, SupportedLang } from '../types'
import type { CodexModelProvider } from '../utils/codex-provider'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { version as packageVersion } from '../../package.json'
import { i18n, initI18n } from '../i18n'
import { codexConfigPath, fetchCodexModels, listModelProviders, readCodexConfigToml, sanitizeProviderName, upsertModelProvider } from '../utils/codex-provider'
import {
  createDefaultConfig,
  ensureLyDir,
  readLyConfig,
  sanitizeModelField,
  sanitizeReviewModel,
  writeLyConfig,
} from '../utils/config'
import { getCoreCommandIds, installWorkflows, migrateLegacyPrompts } from '../utils/installer'
import { PACKAGE_NAME } from '../utils/package-meta'

// ═══════════════════════════════════════════════════════
// codex 宿主采集：API 提供方 → 模型三连
// ═══════════════════════════════════════════════════════

const OPENAI_OFFICIAL_BASE_URL = 'https://api.openai.com/v1'

/** codexHost 三个模型字段的采集结果 */
interface CodexHostModels {
  reviewModel?: string
  reviewModelB?: string
  codingModel?: string
}

type ProviderChoice
  = | { type: 'existing', provider: CodexModelProvider }
    | { type: 'official' }
    | { type: 'custom' }

// 模型三连 list 的两个哨兵项（NUL 前缀保证绝不与任何模型 id 冲突）
const MODEL_CHOICE_CUSTOM = '\u0000lyx:custom'
const MODEL_CHOICE_UNSET = '\u0000lyx:unset'

// 三个模型字段的驱动元数据（i18n 键 + 持久化清洗归属：A 白名单、B/coding 仅 trim）
const MODEL_FIELDS = [
  { key: 'reviewModel', labelKey: 'init:model.reviewModelA', promptKey: 'init:model.reviewModelAPrompt', sanitize: sanitizeReviewModel },
  { key: 'reviewModelB', labelKey: 'init:model.reviewModelB', promptKey: 'init:model.reviewModelBPrompt', sanitize: sanitizeModelField },
  { key: 'codingModel', labelKey: 'init:model.codingModel', promptKey: 'init:model.codingModelPrompt', sanitize: sanitizeModelField },
] as const

/**
 * 模型字段列表选择（provider 模型列表拉取成功路径）：
 * - 既有值在列表内 → 默认该项
 * - 既有值非空但不在列表 → 默认"自定义输入"且弹框 SHALL 预填既有值（直接回车即保留原值）
 * - 无既有值或空白 → 默认"不设置"
 */
async function pickModelField(input: {
  field: typeof MODEL_FIELDS[number]
  models: string[]
  current?: string
}): Promise<string | undefined> {
  const { field, models, current } = input
  const inList = current !== undefined && models.includes(current)
  const choices = [
    ...models.map(id => ({ name: id, value: id })),
    { name: ansis.cyan(`✏️ ${i18n.t('init:model.customChoice')}`), value: MODEL_CHOICE_CUSTOM },
    { name: ansis.gray(i18n.t('init:model.unsetChoice')), value: MODEL_CHOICE_UNSET },
  ]
  const defaultChoice = inList ? current : current !== undefined ? MODEL_CHOICE_CUSTOM : MODEL_CHOICE_UNSET

  const { pick } = await inquirer.prompt([{
    type: 'list',
    name: 'pick',
    message: i18n.t(field.labelKey),
    choices,
    default: defaultChoice,
    pageSize: 15,
  }])

  if (pick === MODEL_CHOICE_UNSET)
    return undefined
  if (pick !== MODEL_CHOICE_CUSTOM)
    return pick

  // 自定义输入弹框预填既有值
  const { custom } = await inquirer.prompt([{
    type: 'input',
    name: 'custom',
    message: i18n.t('init:model.customPrompt'),
    default: current || '',
  }])
  return custom?.trim() || undefined
}

/** 模型字段自由输入（模型列表拉取失败回退路径；留空 = 不设置） */
async function inputModelField(input: {
  field: typeof MODEL_FIELDS[number]
  current?: string
}): Promise<string | undefined> {
  const { field, current } = input
  const { model } = await inquirer.prompt([{
    type: 'input',
    name: 'model',
    message: i18n.t(field.promptKey),
    default: current || '',
  }])
  return model?.trim() || undefined
}

/**
 * codex 宿主侧交互采集：API 提供方 → 模型三连。
 * 仅交互模式进入（skip-prompt 保持既有跳过语义）；返回经 sanitizeReviewModel
 * / sanitizeModelField 清洗的三字段（undefined = 回退当前会话模型）。
 *
 * API 提供方列表 = config.toml 现有 [model_providers.*] 条目 + OpenAI 官方 + 自定义；
 * 选自定义时增量写入 config.toml（upsertModelProvider 文本合并，保注释）。
 * 模型三连：GET {base_url}/models 拉取一次列表，三字段共用该列表逐个 list 选择，
 * 拉取失败回退三个 input 自由输入。
 */
async function collectCodexHostConfig(options: {
  defaults: CodexHostModels
}): Promise<CodexHostModels> {
  // ── Step 1: 选择 API 提供方 ──
  console.log()
  console.log(ansis.cyan.bold(`  🔌 ${i18n.t('init:mode.providerSelect')}`))
  console.log()

  const configExists = await fs.pathExists(codexConfigPath())
  const parsedConfig = await readCodexConfigToml()
  const existingProviders = await listModelProviders()
  // 文件存在但整体解析失败：列表按空处理（不报错），提示一次
  if (configExists && parsedConfig === null)
    console.log(ansis.yellow(`  ⚠ ${i18n.t('init:mode.configParseFailed')}`))

  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: i18n.t('init:mode.providerSelect'),
    choices: [
      ...existingProviders.map(p => ({
        name: `${i18n.t('init:mode.providerExisting', { name: p.name })}${p.baseUrl ? ansis.gray(` — ${p.baseUrl}`) : ''}`,
        value: { type: 'existing', provider: p } as ProviderChoice,
      })),
      { name: `${ansis.green('●')} ${i18n.t('init:mode.providerOfficial')}`, value: { type: 'official' } as ProviderChoice },
      { name: `${ansis.cyan('●')} ${i18n.t('init:mode.providerCustom')}`, value: { type: 'custom' } as ProviderChoice },
    ],
  }])

  let baseUrl = OPENAI_OFFICIAL_BASE_URL
  let apiKey = ''

  if (provider.type === 'existing') {
    baseUrl = provider.provider.baseUrl?.trim() || OPENAI_OFFICIAL_BASE_URL

    // 该 provider 声明了 env_key 且环境变量未设置 → 补询 API key（仅用于拉取模型列表）
    const envKey = provider.provider.envKey
    if (envKey && !process.env[envKey]) {
      const { key } = await inquirer.prompt([{
        type: 'password',
        name: 'key',
        message: i18n.t('init:mode.envKeyMissingPrompt', { envKey }),
        mask: '*',
      }])
      apiKey = key?.trim() || ''
    }
  }
  else if (provider.type === 'custom') {
    console.log()
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: i18n.t('init:mode.customNamePrompt'),
      validate: (v: string) => Boolean(sanitizeProviderName(v)) || i18n.t('init:mode.nameInvalid'),
    }])
    const providerName = sanitizeProviderName(name)!

    const { url } = await inquirer.prompt([{
      type: 'input',
      name: 'url',
      message: i18n.t('init:mode.customUrlPrompt'),
      default: OPENAI_OFFICIAL_BASE_URL,
    }])
    const { key } = await inquirer.prompt([{
      type: 'password',
      name: 'key',
      message: `${i18n.t('init:mode.customKeyPrompt')} ${ansis.gray(`(${i18n.t('init:mode.optional')})`)}`,
      mask: '*',
    }])

    baseUrl = (url || OPENAI_OFFICIAL_BASE_URL).trim()
    apiKey = key?.trim() || ''

    // 写入 ~/.codex/config.toml（增量合并，保注释）
    const writeResult = await upsertModelProvider({ name: providerName, baseUrl })
    if (writeResult.status === 'written') {
      console.log(ansis.green(`  ✓ ${i18n.t('init:mode.providerWritten', { name: providerName })}`))
    }
    else if (writeResult.status === 'exists') {
      console.log(ansis.gray(`  ${i18n.t('init:mode.providerExists', { name: providerName })}`))
    }
    else {
      console.log(ansis.yellow(`  ⚠ ${i18n.t('init:mode.providerWriteFailed', { error: writeResult.error })}`))
    }
  }
  // official：apiKey/baseUrl 保持默认（OAuth 登录）

  // ── Step 2: 模型三连 ──
  console.log()
  console.log(ansis.cyan.bold(`  🧠 ${i18n.t('init:model.trioTitle')}`))
  console.log()
  if (baseUrl) {
    console.log(ansis.gray(`  ${i18n.t('init:mode.modelFetching', { baseUrl })}`))
  }

  const fetchResult = await fetchCodexModels({ baseUrl, apiKey })

  // 拉取失败（网络/非标响应/超时）：提示原因，回退自由输入
  if (!fetchResult.ok) {
    console.log(ansis.yellow(`  ⚠ ${i18n.t('init:mode.modelFetchFailed', { reason: fetchResult.error })}`))
  }

  const collected: CodexHostModels = {}
  for (const field of MODEL_FIELDS) {
    const current = options.defaults[field.key]?.trim() || undefined
    const raw = fetchResult.ok
      ? await pickModelField({ field, models: fetchResult.models, current })
      : await inputModelField({ field, current })
    collected[field.key] = field.sanitize(raw)
  }
  return collected
}

/** 配置摘要（交互与非交互共用）：host + 三模型 + 命令数 */
function printSummary(input: { models: CodexHostModels, commandCount: number }): void {
  const { models, commandCount } = input
  console.log()
  console.log(ansis.yellow('━'.repeat(50)))
  console.log(ansis.bold(`  ${i18n.t('init:summary.title')}`))
  console.log()
  console.log(`  ${ansis.cyan(i18n.t('init:summary.host'))}  ${ansis.green('codex')}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewModelA'))}  ${models.reviewModel ? ansis.green(models.reviewModel) : ansis.gray(i18n.t('init:host.reviewModelUnset'))}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewModelB'))}  ${models.reviewModelB ? ansis.green(models.reviewModelB) : ansis.gray(i18n.t('init:host.reviewModelUnset'))}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.codingModel'))}  ${models.codingModel ? ansis.green(models.codingModel) : ansis.gray(i18n.t('init:host.reviewModelUnset'))}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.commandCount'))}  ${ansis.yellow(commandCount.toString())}`)
  console.log(ansis.yellow('━'.repeat(50)))
  console.log()
}

export async function init(options: InitOptions = {}): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold(`  ${PACKAGE_NAME} v${packageVersion}`))
  console.log(ansis.gray(`  Codex 单 Agent 开发工作流`))
  console.log()

  // ═══════════════════════════════════════════════════════
  // Step 0: Language selection (FIRST interactive step)
  // ═══════════════════════════════════════════════════════
  const existingConfig = await readLyConfig()
  const savedLang = existingConfig?.general?.language
  let language: SupportedLang = savedLang ?? 'zh-CN'

  if (!options.skipPrompt) {
    if (savedLang) {
      language = savedLang
      await initI18n(language)
    }
    else {
      const { selectedLang } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedLang',
        message: '选择语言 / Select language',
        choices: [
          { name: '简体中文', value: 'zh-CN' },
          { name: 'English', value: 'en' },
        ],
        default: 'zh-CN',
      }])
      language = selectedLang
      await initI18n(language)
    }
  }
  else if (options.lang) {
    language = options.lang
    await initI18n(language)
  }
  else if (savedLang) {
    // 非交互且未显式指定语言：保留现有 config 语言
    // （update 走 `init --force --skip-prompt` 重装时不再被重置为 zh-CN）
    language = savedLang
    await initI18n(language)
  }

  const selectedWorkflows = getCoreCommandIds()
  // 既有配置中的三个模型字段作为交互/非交互默认值（空白等价未配置；保真写回不丢）
  const defaultModels: CodexHostModels = {
    reviewModel: sanitizeReviewModel(existingConfig?.codexHost?.reviewModel),
    reviewModelB: sanitizeModelField(existingConfig?.codexHost?.reviewModelB),
    codingModel: sanitizeModelField(existingConfig?.codexHost?.codingModel),
  }
  let collectedModels: CodexHostModels = { ...defaultModels }

  // ═══════════════════════════════════════════════════════
  // Interactive flow（codex 单宿主）
  // ═══════════════════════════════════════════════════════
  if (!options.skipPrompt) {
    // ── API 提供方 → 模型三连 ──
    collectedModels = await collectCodexHostConfig({ defaults: defaultModels })

    // ── 摘要 ──
    printSummary({ models: collectedModels, commandCount: selectedWorkflows.length })

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: i18n.t('init:confirmInstall'),
      default: true,
    }])
    if (!confirm) {
      console.log(ansis.yellow(i18n.t('init:installCancelled')))
      return
    }
  }
  else {
    // non-interactive：打印最小摘要行（保留既有三字段默认）
    printSummary({ models: collectedModels, commandCount: selectedWorkflows.length })
  }

  // ═══════════════════════════════════════════════════════
  // Install
  // ═══════════════════════════════════════════════════════
  const spinner = ora(i18n.t('init:installing')).start()

  try {
    await ensureLyDir()

    const config = createDefaultConfig({
      language,
      installedWorkflows: selectedWorkflows,
      codexHost: {
        reviewModel: collectedModels.reviewModel,
        reviewModelB: collectedModels.reviewModelB,
        codingModel: collectedModels.codingModel,
      },
      installedHosts: ['codex'],
    })

    // Save config FIRST - ensure it's created even if installation fails
    await writeLyConfig(config)

    // Legacy prompts migration (~/.claude/.ly/prompts/ → ~/.ly/prompts/) — 失败不阻断
    try {
      const migration = await migrateLegacyPrompts()
      if (migration.migrated) {
        console.log()
        console.log(`  ${ansis.green('✓')} ${i18n.t('init:promptsMigrated')}`)
      }
      else if (migration.error) {
        console.log()
        console.log(`  ${ansis.yellow('⚠')} ${i18n.t('init:promptsMigrationFailed', { error: migration.error })}`)
      }
    }
    catch { /* non-blocking */ }

    // Install codex host commands + shared role prompts
    const result = await installWorkflows(selectedWorkflows, '', options.force, {
      reviewModel: collectedModels.reviewModel,
    })

    spinner.succeed(ansis.green(i18n.t('init:installSuccess')))

    // Show result summary
    if (!result.success || result.errors.length > 0) {
      if (result.errors.length > 0) {
        result.errors.forEach((error) => {
          console.log(`    ${ansis.red('✗')} ${error}`)
        })
      }
      if (!result.success) {
        console.log()
        console.log(ansis.yellow('  尝试修复 / Try to fix:'))
        console.log(ansis.cyan(`    npx ${PACKAGE_NAME}@latest init --force`))
        console.log(ansis.gray(`    If still failing, report an issue at ${'https://github.com/FE-runner/ly-workflow-codex/issues'}`))
      }
    }

    console.log()
    console.log(`  ${ansis.cyan(i18n.t('init:installedCommands'))}`)
    for (const cmd of result.installedCommands) {
      console.log(`    ${ansis.green('✓')} lyx-${cmd} ${ansis.gray('→ ~/.agents/skills/')}`)
    }
    if (result.installedPrompts.length > 0) {
      console.log()
      console.log(`  ${ansis.cyan(i18n.t('init:installedPrompts'))}`)
      for (const name of result.installedPrompts) {
        console.log(`    ${ansis.green('✓')} ${name} ${ansis.gray('→ ~/.ly/prompts/')}`)
      }
    }

    // codex 侧残留清理（旧包写入的 AGENTS.md 区块 / config.toml 旧区块 / 旧 agents）— 非阻断
    try {
      const { cleanupLegacyArtifacts, reportCleanupResult } = await import('../utils/legacy-cleanup')
      reportCleanupResult(await cleanupLegacyArtifacts())
    }
    catch { /* non-blocking */ }

    console.log()
    console.log(ansis.green(`  ✓ ${i18n.t('init:installSuccess')}`))
    console.log(ansis.gray(`    Config: ~/.ly/config.toml`))
    console.log()
  }
  catch (error) {
    spinner.fail(ansis.red(i18n.t('init:installFailed')))
    console.error(error)
  }
}
