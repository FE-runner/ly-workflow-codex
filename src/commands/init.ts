import type { InitOptions, SupportedLang } from '../types'
import type { CodexModelProvider } from '../utils/codex-provider'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { version as packageVersion } from '../../package.json'
import { i18n, initI18n } from '../i18n'
import { codexConfigPath, listModelProviders, readCodexConfigToml, readCodexCurrentModel, readModelsJson, sanitizeProviderName, upsertModelProvider } from '../utils/codex-provider'
import {
  createDefaultConfig,
  ensureLyDir,
  readLyConfig,
  sanitizeCodexHostExtras,
  sanitizeModelField,
  sanitizeReviewModel,
  writeLyConfig,
} from '../utils/config'
import { getCoreCommandIds, installWorkflows, migrateLegacyPrompts } from '../utils/installer'
import { buildModelFieldChoices, MODEL_CHOICE_CUSTOM, MODEL_CHOICE_UNSET } from '../utils/model-candidates'
import { PACKAGE_NAME } from '../utils/package-meta'

// ═══════════════════════════════════════════════════════
// codex 宿主采集：API 提供方 → 模型三连
// ═══════════════════════════════════════════════════════

const OPENAI_OFFICIAL_BASE_URL = 'https://api.openai.com/v1'

/** codexHost 模型字段的采集结果（reviewModelB 仅承载存量保真值，不再采集） */
interface CodexHostModels {
  reviewModel?: string
  reviewModelB?: string
  codingModel?: string
}

type ProviderChoice
  = | { type: 'existing', provider: CodexModelProvider }
    | { type: 'official' }
    | { type: 'custom' }

// 模型字段的驱动元数据（i18n 键 + 持久化清洗归属：reviewModel 白名单、codingModel 仅 trim）。
// reviewModelB 已弃用（单审查执行模型不读取），向导不再采集；存量值经 existingExtras 保真写回
const MODEL_FIELDS = [
  { key: 'reviewModel', labelKey: 'init:model.reviewModelA', sanitize: sanitizeReviewModel },
  { key: 'codingModel', labelKey: 'init:model.codingModel', sanitize: sanitizeModelField },
] as const

/**
 * 模型字段 list 选择（候选 = 默认继承（留空）+ 自定义输入 + 既有值）：
 * 候选构造与默认值语义由 `buildModelFieldChoices` 统一提供（init 与 menu 共用）——
 * 模型指定只保留两种方式：留空（继承当前会话模型）或自定义输入任意模型名
 * （能否 spawn 由宿主实际能力决定，配置仅为提示；agent 模型需额外配置并可用示例 prompt 验证）。
 * 既有值非空 → 附该项并默认；无既有值或空白 → 默认"留空"。
 */
async function pickModelField(input: {
  field: typeof MODEL_FIELDS[number]
  current?: string
}): Promise<string | undefined> {
  const { field, current } = input
  const { choices, defaultChoice } = buildModelFieldChoices({ current })

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
  if (pick === MODEL_CHOICE_CUSTOM) {
    // 自定义输入：保留自由输入方式（不做清单限制）；留空视为取消（回退默认"留空"）
    const { custom } = await inquirer.prompt([{
      type: 'input',
      name: 'custom',
      message: i18n.t('init:model.customPrompt'),
    }])
    const model = custom?.trim()
    return model ? model : undefined
  }
  return typeof pick === 'string' ? pick.trim() : undefined
}

/**
 * Codex 现状检测（只读展示，零副作用）：主会话模型（~/.codex/config.toml 顶层 model）、
 * [model_providers.*] 条目、~/.codex/models.json 注册集合规模。读取失败或缺文件如实标注
 * "未检测到"（models.json 返回 undefined 与"注册 0 个"可区分），全部失败均不阻断流程；
 * 附 reasoning_effort 参数坑背景提示（部分第三方模型需显式 low，仅背景说明、不新增配置通道）。
 */
async function printCodexStatus(): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold(`  📊 ${i18n.t('init:codexStatus.title')}`))
  console.log()

  const currentModel = await readCodexCurrentModel()
  console.log(`  · ${ansis.cyan(i18n.t('init:codexStatus.mainModelLabel'))} ${
    currentModel
      ? i18n.t('init:codexStatus.mainModel', { model: currentModel })
      : ansis.gray(i18n.t('init:codexStatus.notDetected'))}`)

  const providers = await listModelProviders()
  console.log(`  · ${ansis.cyan(i18n.t('init:codexStatus.providersLabel'))} ${
    providers.length > 0
      ? providers.map(p => p.name).join(', ')
      : ansis.gray(i18n.t('init:codexStatus.noProvider'))}`)

  const models = await readModelsJson()
  console.log(`  · ${ansis.cyan(i18n.t('init:codexStatus.registeredLabel'))} ${
    models === undefined
      ? ansis.gray(i18n.t('init:codexStatus.notDetected'))
      : i18n.t('init:codexStatus.registeredModels', { count: models.length })}`)

  console.log()
  console.log(ansis.yellow(`  ⚠ ${i18n.t('init:codexStatus.reasoningHint')}`))
  console.log(ansis.gray(`  ${i18n.t('init:codexStatus.spawnableHint')}`))
}

/**
 * codex 宿主侧交互采集：API 提供方 → Codex 现状检测 → 模型三连。
 * 仅交互模式进入（skip-prompt 保持既有跳过语义）；返回经 sanitizeReviewModel
 * / sanitizeModelField 清洗的三字段（undefined = 回退当前会话模型）。
 *
 * API 提供方列表 = config.toml 现有 [model_providers.*] 条目 + OpenAI 官方 + 自定义；
 * 选自定义时增量写入 config.toml（upsertModelProvider 文本合并，保注释）。
 * 模型三连候选 = 默认继承（留空）+ 自定义输入（任意模型名，能否 spawn 由宿主实际能力
 * 决定，配置仅为提示并附示例 prompt 教用户验证；agent 模型需额外配置）。
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

  if (provider.type === 'existing') {
    // 直接选用既有 provider（不再拉取 /models：模型候选与校验仅以 spawnableModels 为来源）
    console.log(ansis.gray(`  ✓ ${i18n.t('init:mode.providerExistingSelected', { name: provider.provider.name })}`))
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

    const baseUrl = (url || OPENAI_OFFICIAL_BASE_URL).trim()

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
  // official：直接选用（OAuth 登录语义保留）

  // ── Step 2: Codex 现状检测（只读展示）──
  await printCodexStatus()

  // ── Step 3: 模型三连（候选 = 留空 + 自定义输入 + 既有值）──
  console.log()
  console.log(ansis.cyan.bold(`  🧠 ${i18n.t('init:model.trioTitle')}`))
  console.log()
  console.log(ansis.gray(`  ${i18n.t('init:model.trioCandidatesHint')}`))
  console.log()

  const collected: CodexHostModels = {}
  for (const field of MODEL_FIELDS) {
    const current = options.defaults[field.key]?.trim() || undefined
    const raw = await pickModelField({ field, current })
    collected[field.key] = field.sanitize(raw)
  }
  return collected
}

/** 配置摘要（交互与非交互共用）：host + 模型字段 + 命令数 */
function printSummary(input: { models: CodexHostModels, commandCount: number }): void {
  const { models, commandCount } = input
  console.log()
  console.log(ansis.yellow('━'.repeat(50)))
  console.log(ansis.bold(`  ${i18n.t('init:summary.title')}`))
  console.log()
  console.log(`  ${ansis.cyan(i18n.t('init:summary.host'))}  ${ansis.green('codex')}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewModelA'))}  ${models.reviewModel ? ansis.green(models.reviewModel) : ansis.gray(i18n.t('init:host.reviewModelUnset'))}`)
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
  // 既有配置中的模型字段作为交互/非交互默认值（空白等价未配置；保真写回不丢，含弃用的 reviewModelB）
  const existingExtras = sanitizeCodexHostExtras(existingConfig?.codexHost)
  const defaultModels: CodexHostModels = {
    reviewModel: sanitizeReviewModel(existingConfig?.codexHost?.reviewModel),
    reviewModelB: existingExtras.reviewModelB,
    codingModel: existingExtras.codingModel,
  }
  // 模型三连候选 = 默认继承（留空）+ 自定义输入 + 既有值；agent 模型需额外配置，
  // 能否 spawn 由宿主实际能力决定（详见模板与 lycx doctor 提示）
  let collectedModels: CodexHostModels = { ...defaultModels }

  // ═══════════════════════════════════════════════════════
  // Interactive flow（codex 单宿主）
  // ═══════════════════════════════════════════════════════
  if (!options.skipPrompt) {
    // ── API 提供方 → Codex 现状检测 → 模型二连 ──
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
    // non-interactive：打印最小摘要行（保留既有字段默认）
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
        ...existingExtras,
        reviewModel: collectedModels.reviewModel,
        // reviewModelB 已弃用、不再采集：保真写回存量值，SHALL NOT 因重装而丢弃
        reviewModelB: existingExtras.reviewModelB,
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
