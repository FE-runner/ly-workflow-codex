import type { CodexModelProvider } from '../hosts/codex/provider'
import type { ExecutorKind, InitOptions, InstallResult, LyConfig, SupportedLang } from '../types'
import type { HostId } from '../utils/host-adapters'
import type { SubagentConfigCollected } from './collect-subagent-config'
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
import { PACKAGE_NAME } from '../utils/package-meta'
import { collectSubagentConfig } from './collect-subagent-config'

// ═══════════════════════════════════════════════════════
// 宿主采集：codex = API 提供方 / 现状检测（专属前置）+ 子代理配置；
//           claude = 子代理配置（采集面与 codex 一致，无 provider 步骤）
// ═══════════════════════════════════════════════════════

const OPENAI_OFFICIAL_BASE_URL = 'https://api.openai.com/v1'

type ProviderChoice
  = | { type: 'existing', provider: CodexModelProvider }
    | { type: 'official' }
    | { type: 'custom' }

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
  defaults: SubagentConfigCollected
}): Promise<SubagentConfigCollected> {
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

  // ── Step 3: 子代理配置采集（执行者二连 → 模型二连 → 推理档二连；与 claude 共用实现）──
  return collectSubagentConfig({
    defaults: options.defaults,
    executorHintKey: 'init:executor.hint',
    suggestions: getAdapter('codex').reasoningEffortSuggestions,
  })
}

/**
 * claude 宿主侧交互采集：与 codex 采用同一采集面（执行者二连 → 模型二连 → 推理档二连），
 * 复用 `collectSubagentConfig`；差异只在推理档建议清单按宿主提供（claude = low/medium/high/xhigh/max）。
 * SHALL NOT 采集或写入 Claude Code 自身的 provider / settings 配置；既有模型与推理档原样保留为默认值。
 */
async function collectClaudeHostConfig(options: { defaults: SubagentConfigCollected }): Promise<SubagentConfigCollected> {
  return collectSubagentConfig({
    defaults: options.defaults,
    executorHintKey: 'init:claude.executorHint',
    suggestions: getAdapter('claude').reasoningEffortSuggestions,
  })
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
function printSummary(input: { host: HostId, models: SubagentConfigCollected, commandCount: number }): void {
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
  // 编程调用（菜单等）同样不抛堆栈：非法 --host 打印可读错误并设置退出码
  let explicitHosts: HostId[] | undefined
  try {
    explicitHosts = parseHostList(options.host)
  }
  catch (error) {
    console.error(ansis.red(`  ${error instanceof Error ? error.message : String(error)}`))
    process.exitCode = 1
    return
  }
  const hosts = options.skipPrompt
    ? explicitHosts ?? resolveNonInteractiveHosts({ installed: installedHosts, detected: detectedHosts })
    : await pickHosts(explicitHosts ?? defaultInteractiveHosts({ installed: installedHosts, detected: detectedHosts }))

  const selectedWorkflows = getCoreCommandIds()

  // ═══════════════════════════════════════════════════════
  // Step 3: 逐宿主采集（既有配置作为默认值；空白等价未配置；保真写回不丢）
  // ═══════════════════════════════════════════════════════
  const collectedByHost = new Map<HostId, SubagentConfigCollected>()
  for (const host of hosts) {
    const existing = existingConfigs.get(host)?.host
    const defaults: SubagentConfigCollected = {
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
