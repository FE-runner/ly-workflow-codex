import type { CodexModelProvider } from '../hosts/codex/provider'
import type { ExecutorKind, InitOptions, InstallResult, LyConfig, SupportedLang } from '../types'
import type { HostId } from '../utils/host-adapters'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { version as packageVersion } from '../../package.json'
import { codexConfigPath, listModelProviders, readCodexConfigToml, readCodexCurrentModel, readModelsJson, sanitizeProviderName, upsertModelProvider } from '../hosts/codex/provider'
import { i18n, initI18n } from '../i18n'
import {
  createDefaultConfig,
  getHostConfigPath,
  listInstalledHosts,
  mergeHostConfig,
  readLyConfig,
  sanitizeExecutor,
  sanitizeModelField,
  sanitizeReasoningEffort,
  sanitizeReviewModel,
  writeLyConfig,
} from '../utils/config'
import { getAdapter, listRegisteredHosts } from '../utils/host-adapters'
import { defaultInteractiveHosts, detectHosts, parseHostList, resolveNonInteractiveHosts } from '../utils/host-selection'
import { getCoreCommandIds, installWorkflows } from '../utils/installer'
import {
  buildModelFieldChoices,
  buildReasoningEffortChoices,
  MODEL_CHOICE_CUSTOM,
  MODEL_CHOICE_UNSET,
  REASONING_CHOICE_CUSTOM,
  REASONING_CHOICE_UNSET,
} from '../utils/model-candidates'
import { PACKAGE_NAME } from '../utils/package-meta'

// ═══════════════════════════════════════════════════════
// codex 宿主采集：API 提供方 → 模型三连
// ═══════════════════════════════════════════════════════

const OPENAI_OFFICIAL_BASE_URL = 'https://api.openai.com/v1'

/** codexHost 的采集结果：执行者二连 + 模型二连 */
interface CodexHostCollected {
  reviewExecutor?: ExecutorKind
  codingExecutor?: ExecutorKind
  reviewModel?: string
  codingModel?: string
  reviewReasoningEffort?: string
  codingReasoningEffort?: string
}

type ProviderChoice
  = | { type: 'existing', provider: CodexModelProvider }
    | { type: 'official' }
    | { type: 'custom' }

// 模型字段的驱动元数据（i18n 键 + 持久化清洗归属：reviewModel 白名单、codingModel 仅 trim）。
// 仅在对应执行者为 subagent 时提示采集；main 路径下保留既有值但不采集。
const MODEL_FIELDS = [
  { key: 'reviewModel', labelKey: 'init:model.reviewModelA', sanitize: sanitizeReviewModel },
  { key: 'codingModel', labelKey: 'init:model.codingModel', sanitize: sanitizeModelField },
] as const

// 推理档覆盖字段的驱动元数据（与对应执行者/模型字段配对）
const REASONING_FIELDS = [
  { key: 'reviewReasoningEffort', executorKey: 'reviewExecutor', labelKey: 'init:reasoning.reviewLabel' },
  { key: 'codingReasoningEffort', executorKey: 'codingExecutor', labelKey: 'init:reasoning.codingLabel' },
] as const

// 执行者字段的驱动元数据（候选固定为 main / subagent，默认 main）
const EXECUTOR_FIELDS = [
  { key: 'reviewExecutor', labelKey: 'init:executor.reviewExecutor' },
  { key: 'codingExecutor', labelKey: 'init:executor.codingExecutor' },
] as const

/**
 * 执行者字段 list 选择：候选 = 主 agent 直接执行（默认）/ spawn 独立子代理。
 * 未配置或既有值非法时默认选中 main。
 */
async function pickExecutorField(input: {
  field: typeof EXECUTOR_FIELDS[number]
  current?: ExecutorKind
}): Promise<ExecutorKind> {
  const { field, current } = input
  const { pick } = await inquirer.prompt([{
    type: 'list',
    name: 'pick',
    message: i18n.t(field.labelKey),
    choices: [
      { name: i18n.t('init:executor.main'), value: 'main' },
      { name: i18n.t('init:executor.subagent'), value: 'subagent' },
    ],
    default: current ?? 'main',
  }])
  return pick === 'subagent' ? 'subagent' : 'main'
}

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
    return model || undefined
  }
  return typeof pick === 'string' ? pick.trim() : undefined
}

/**
 * 推理档覆盖选择：候选 = 不覆盖 + 建议档位 + 自定义输入 + 既有值。
 * 返回 undefined 表示不覆盖（清除字段）；自定义输入留空同样等价于不覆盖。
 */
async function pickReasoningEffortField(input: {
  field: typeof REASONING_FIELDS[number]
  current?: string
}): Promise<string | undefined> {
  const { field, current } = input
  const { choices, defaultChoice } = buildReasoningEffortChoices({ current })

  const { pick } = await inquirer.prompt([{
    type: 'list',
    name: 'pick',
    message: i18n.t(field.labelKey),
    choices,
    default: defaultChoice,
    pageSize: 15,
  }])

  if (pick === REASONING_CHOICE_UNSET)
    return undefined
  if (pick === REASONING_CHOICE_CUSTOM) {
    const { custom } = await inquirer.prompt([{
      type: 'input',
      name: 'custom',
      message: i18n.t('init:reasoning.customPrompt'),
    }])
    const value = custom?.trim()
    return value || undefined
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
  defaults: CodexHostCollected
}): Promise<CodexHostCollected> {
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

  // ── Step 3: 执行者二连（候选 = 主 agent 直接执行 / spawn 独立子代理）──
  console.log()
  console.log(ansis.cyan.bold(`  ${i18n.t('init:executor.title')}`))
  console.log()
  console.log(ansis.gray(`  ${i18n.t('init:executor.hint')}`))
  console.log()

  const collected: CodexHostCollected = {}
  for (const field of EXECUTOR_FIELDS) {
    collected[field.key] = await pickExecutorField({
      field,
      current: options.defaults[field.key],
    })
  }

  // ── Step 4: 模型采集（仅在对应执行者为 subagent 时提示；main 下保留既有值但不采集）──
  console.log()
  console.log(ansis.cyan.bold(`  🧠 ${i18n.t('init:model.trioTitle')}`))
  console.log()
  console.log(ansis.gray(`  ${i18n.t('init:model.trioCandidatesHint')}`))
  console.log()

  for (const field of MODEL_FIELDS) {
    const executorKey = field.key === 'reviewModel' ? 'reviewExecutor' : 'codingExecutor'
    if (collected[executorKey] !== 'subagent') {
      // 执行者为 main：该模型字段不生效，保留既有值但不采集
      collected[field.key] = options.defaults[field.key]?.trim() || undefined
      continue
    }
    const current = options.defaults[field.key]?.trim() || undefined
    const raw = await pickModelField({ field, current })
    collected[field.key] = field.sanitize(raw)
  }

  // ── Step 5: 推理档覆盖采集（仅在对应执行者为 subagent 时提示；main 下保留既有值）──
  for (const field of REASONING_FIELDS) {
    if (collected[field.executorKey] !== 'subagent') {
      collected[field.key] = options.defaults[field.key]?.trim() || undefined
      continue
    }
    collected[field.key] = await pickReasoningEffortField({
      field,
      current: options.defaults[field.key],
    })
  }
  return collected
}

/**
 * claude 宿主侧交互采集：只采集执行者二连（main / subagent）。
 * SHALL NOT 采集模型与推理档（子代理定义默认 model: inherit），SHALL NOT 采集或写入
 * Claude Code 自身的 provider / settings 配置；既有模型与推理档（手改配置得到的）原样保留。
 */
async function collectClaudeHostConfig(options: { defaults: CodexHostCollected }): Promise<CodexHostCollected> {
  console.log()
  console.log(ansis.cyan.bold(`  ${i18n.t('init:executor.title')}`))
  console.log()
  console.log(ansis.gray(`  ${i18n.t('init:claude.executorHint')}`))
  console.log()

  const collected: CodexHostCollected = { ...options.defaults }
  for (const field of EXECUTOR_FIELDS) {
    collected[field.key] = await pickExecutorField({ field, current: options.defaults[field.key] })
  }
  return collected
}

/** 交互选择本次安装的宿主（默认勾选 = 已安装 ∪ 探测到；至少选一个） */
async function pickHosts(defaults: HostId[]): Promise<HostId[]> {
  const { hosts } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'hosts',
    message: i18n.t('init:hostSelect.prompt'),
    choices: listRegisteredHosts().map(host => ({
      name: `${host} ${ansis.gray(`— ${i18n.t(`init:hostSelect.desc.${host}`)}`)}`,
      value: host,
      checked: defaults.includes(host),
    })),
    validate: (value: unknown[]) => value.length > 0 || i18n.t('init:hostSelect.required'),
  }])
  return hosts as HostId[]
}

/** 配置摘要（交互与非交互共用）：宿主 + 执行者字段 + 模型字段 + 命令数 */
function printSummary(input: { host: HostId, models: CodexHostCollected, commandCount: number }): void {
  const { host, models, commandCount } = input
  // claude 宿主：模型/推理档写入子代理定义，未配置即 model: inherit（继承当前会话），不算"未配置"
  const inheritsByDefinition = host === 'claude'
  const executorLabel = (kind: ExecutorKind | undefined): string =>
    kind === 'subagent'
      ? ansis.green(i18n.t('init:summary.executorSubagent'))
      : ansis.gray(i18n.t('init:summary.executorMain'))
  const modelLabel = (value: string | undefined, effective: boolean): string => {
    if (!value)
      return ansis.gray(i18n.t(inheritsByDefinition ? 'init:claude.modelInherit' : 'init:host.reviewModelUnset'))
    if (!effective)
      return ansis.yellow(i18n.t('init:summary.modelIneffective', { model: value }))
    return ansis.green(value)
  }
  const reasoningLabel = (value: string | undefined, effective: boolean): string => {
    if (!effective) {
      return value
        ? ansis.yellow(i18n.t('init:summary.reasoningIneffective', { value }))
        : ansis.gray(i18n.t('init:summary.reasoningIneffectiveUnset'))
    }
    return value
      ? ansis.green(i18n.t('init:summary.reasoningConfigured', { value }))
      : ansis.gray(i18n.t('init:summary.reasoningUnset'))
  }
  const reviewEffective = models.reviewExecutor === 'subagent'
  const codingEffective = models.codingExecutor === 'subagent'
  console.log()
  console.log(ansis.yellow('━'.repeat(50)))
  console.log(ansis.bold(`  ${i18n.t('init:summary.title')}`))
  console.log()
  console.log(`  ${ansis.cyan(i18n.t('init:summary.host'))}  ${ansis.green(host)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewExecutor'))}  ${executorLabel(models.reviewExecutor)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.codingExecutor'))}  ${executorLabel(models.codingExecutor)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewModelA'))}  ${modelLabel(models.reviewModel, reviewEffective)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.codingModel'))}  ${modelLabel(models.codingModel, codingEffective)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewReasoningEffort'))}  ${reasoningLabel(models.reviewReasoningEffort, reviewEffective)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.codingReasoningEffort'))}  ${reasoningLabel(models.codingReasoningEffort, codingEffective)}`)
  if (inheritsByDefinition)
    console.log(ansis.gray(`  ${i18n.t('init:claude.noProviderNote')}`))
  console.log(`  ${ansis.cyan(i18n.t('init:summary.commandCount'))}  ${ansis.yellow(commandCount.toString())}`)
  console.log(ansis.yellow('━'.repeat(50)))
  console.log()
}

export async function init(options: InitOptions = {}): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold(`  ${PACKAGE_NAME} v${packageVersion}`))
  console.log(ansis.gray(`  ${i18n.t('init:tagline')}`))
  console.log()

  // ═══════════════════════════════════════════════════════
  // Step 0: 现状（已安装宿主 = 配置文件存在；探测宿主 = 宿主目录存在）
  // ═══════════════════════════════════════════════════════
  const installedHosts = await listInstalledHosts()
  const detectedHosts = await detectHosts()
  const existingConfigs = new Map<HostId, LyConfig | null>()
  for (const host of listRegisteredHosts())
    existingConfigs.set(host, await readLyConfig(host))

  // ═══════════════════════════════════════════════════════
  // Step 1: Language selection (FIRST interactive step)
  // ═══════════════════════════════════════════════════════
  const savedLang = [...existingConfigs.values()].find(c => c?.general?.language)?.general.language
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

  // ═══════════════════════════════════════════════════════
  // Step 2: 宿主集合（交互 = 多选；非交互 = 已安装 → 探测 → 兜底）
  // ═══════════════════════════════════════════════════════
  const explicitHosts = parseHostList(options.host)
  const hosts = options.skipPrompt
    ? explicitHosts ?? resolveNonInteractiveHosts({ installed: installedHosts, detected: detectedHosts })
    : await pickHosts(explicitHosts ?? defaultInteractiveHosts({ installed: installedHosts, detected: detectedHosts }))

  const selectedWorkflows = getCoreCommandIds()

  // ═══════════════════════════════════════════════════════
  // Step 3: 逐宿主采集（既有配置作为默认值；空白等价未配置；保真写回不丢）
  // ═══════════════════════════════════════════════════════
  const collectedByHost = new Map<HostId, CodexHostCollected>()
  for (const host of hosts) {
    const existing = existingConfigs.get(host)?.host
    const defaults: CodexHostCollected = {
      reviewExecutor: sanitizeExecutor(existing?.reviewExecutor),
      codingExecutor: sanitizeExecutor(existing?.codingExecutor),
      reviewModel: sanitizeReviewModel(existing?.reviewModel),
      codingModel: sanitizeModelField(existing?.codingModel),
      reviewReasoningEffort: sanitizeReasoningEffort(existing?.reviewReasoningEffort),
      codingReasoningEffort: sanitizeReasoningEffort(existing?.codingReasoningEffort),
    }
    let collected = { ...defaults }
    if (!options.skipPrompt) {
      console.log()
      console.log(ansis.magenta.bold(`  ▶ ${i18n.t('init:hostSelect.configuring', { host })}`))
      collected = host === 'claude'
        ? await collectClaudeHostConfig({ defaults })
        : await collectCodexHostConfig({ defaults })
    }
    collectedByHost.set(host, collected)
    printSummary({ host, models: collected, commandCount: selectedWorkflows.length })
  }

  if (!options.skipPrompt) {
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

  // ═══════════════════════════════════════════════════════
  // Step 4: 逐宿主安装（只处理所选宿主；未选宿主的配置与产物不动）
  // ═══════════════════════════════════════════════════════
  const spinner = ora(i18n.t('init:installing')).start()

  try {
    const results: Array<{ host: HostId, result: InstallResult }> = []
    for (const host of hosts) {
      const collected = collectedByHost.get(host)!
      const hostSection = mergeHostConfig(existingConfigs.get(host)?.host, {
        reviewExecutor: collected.reviewExecutor,
        codingExecutor: collected.codingExecutor,
        reviewModel: collected.reviewModel,
        codingModel: collected.codingModel,
        reviewReasoningEffort: collected.reviewReasoningEffort,
        codingReasoningEffort: collected.codingReasoningEffort,
      })
      const config = createDefaultConfig({
        language,
        installedWorkflows: selectedWorkflows,
        hostId: host,
        host: hostSection,
      })

      // Save config FIRST - ensure it's created even if installation fails
      await writeLyConfig(config, host)

      const result = await installWorkflows(selectedWorkflows, '', options.force, {
        hosts: [host],
        hostConfig: { [host]: hostSection ?? {} },
      })
      results.push({ host, result })
    }

    spinner.succeed(ansis.green(i18n.t('init:installSuccess')))

    for (const { host, result } of results) {
      const paths = getAdapter(host).defaultPaths()
      console.log()
      console.log(ansis.magenta.bold(`  [${host}]`))

      if (!result.success || result.errors.length > 0) {
        result.errors.forEach((error) => {
          console.log(`    ${ansis.red('✗')} ${error}`)
        })
        if (!result.success) {
          console.log()
          console.log(ansis.yellow('  尝试修复 / Try to fix:'))
          console.log(ansis.cyan(`    npx ${PACKAGE_NAME}@latest init --force`))
          console.log(ansis.gray(`    If still failing, report an issue at ${'https://github.com/FE-runner/ly-workflow-codex/issues'}`))
        }
      }

      const prefix = getAdapter(host).commandPrefix
      console.log(`  ${ansis.cyan(i18n.t('init:installedCommands'))}`)
      for (const cmd of result.installedCommands) {
        console.log(`    ${ansis.green('✓')} ${prefix}lyx-${cmd} ${ansis.gray(`→ ${paths.skillsDir}`)}`)
      }
      if (result.installedPrompts.length > 0) {
        console.log(`  ${ansis.cyan(i18n.t('init:installedPrompts'))}`)
        for (const name of result.installedPrompts) {
          console.log(`    ${ansis.green('✓')} ${name}`)
        }
      }
      console.log(ansis.gray(`    Config: ${getHostConfigPath(host)}`))
    }

    // codex 侧残留清理（旧包写入的 AGENTS.md 区块 / config.toml 旧区块 / 旧 agents）— 非阻断
    if (hosts.includes('codex')) {
      try {
        const { cleanupLegacyArtifacts, reportCleanupResult } = await import('../hosts/codex/legacy-cleanup')
        reportCleanupResult(await cleanupLegacyArtifacts())
      }
      catch { /* non-blocking */ }
    }

    // 宿主已确认（配置文件已产生）：此时才允许执行项目级 OpenSpec 写入型修复
    if (options.initOpenspec) {
      try {
        const { ensureOpenspec, confirmOpenspecCliInstall, printOpenspecInspection } = await import('../utils/preflight')
        const ensured = await ensureOpenspec({
          hosts,
          allowWrite: true,
          yes: options.skipPrompt,
          confirmInstall: () => confirmOpenspecCliInstall(options.skipPrompt),
        })
        printOpenspecInspection(ensured.inspection)
      }
      catch { /* non-blocking */ }
    }

    console.log()
    console.log(ansis.green(`  ✓ ${i18n.t('init:installSuccess')}`))
    console.log()
  }
  catch (error) {
    spinner.fail(ansis.red(i18n.t('init:installFailed')))
    console.error(error)
  }
}
