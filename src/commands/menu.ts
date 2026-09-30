import type { HostId } from '../utils/host-adapters'
import type { SubagentConfigCollected } from './collect-subagent-config'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { join } from 'pathe'
import { parse as parseTOML } from 'smol-toml'
import { version } from '../../package.json'
import { i18n } from '../i18n'
import { getConfigPath, getHostConfigPath, listInstalledHosts, mergeHostConfig, readLyConfig, sanitizeExecutor, sanitizeModelField, sanitizeReasoningEffort, sanitizeReviewModel, writeLyConfig } from '../utils/config'
import { DEFAULT_HOST, getAdapter, listRegisteredHosts } from '../utils/host-adapters'
import { getCoreCommandIds, getWorkflowConfigs, installWorkflows } from '../utils/installer'
import { PACKAGE_NAME } from '../utils/package-meta'
import { collectSubagentConfig } from './collect-subagent-config'
import { init } from './init'
import { describeUninstallTargets, printUninstallResult, resolveUninstallHosts, runUninstall } from './uninstall'
import { update } from './update'

const execAsync = promisify(exec)

// ═══════════════════════════════════════════════════════
// UI Helpers
// ═══════════════════════════════════════════════════════

/**
 * Get visual display width of a string (CJK = 2, ASCII = 1)
 */
function visWidth(s: string): number {
  // eslint-disable-next-line no-control-regex -- ANSI 转义序列剥离（\x1B[...m）
  const stripped = s.replace(/\x1B\[[0-9;]*m/g, '')
  let w = 0
  for (const ch of stripped) {
    const code = ch.codePointAt(0) || 0
    if (
      (code >= 0x2E80 && code <= 0x9FFF)
      || (code >= 0xF900 && code <= 0xFAFF)
      || (code >= 0xFE30 && code <= 0xFE4F)
      || (code >= 0xFF00 && code <= 0xFF60)
      || (code >= 0xFFE0 && code <= 0xFFE6)
      || (code >= 0x1F300 && code <= 0x1F9FF)
      || (code >= 0x20000 && code <= 0x2FA1F)
    ) {
      w += 2
    }
    else {
      w += 1
    }
  }
  return w
}

function pad(s: string, w: number): string {
  const diff = w - visWidth(s)
  return diff > 0 ? s + ' '.repeat(diff) : s
}

const INNER_W = 60

function centerLine(s: string, w: number): string {
  const vis = visWidth(s)
  const left = Math.max(0, Math.floor((w - vis) / 2))
  const right = Math.max(0, w - vis - left)
  return ' '.repeat(left) + s + ' '.repeat(right)
}

function boxRow(content: string): string {
  const vis = visWidth(content)
  const gap = Math.max(0, INNER_W - vis)
  return ansis.cyan('║') + content + ' '.repeat(gap) + ansis.cyan('║')
}

function wrapStatusLines(parts: string[], width: number): string[] {
  const sep = ansis.gray('  |  ')
  const sepVis = visWidth(sep)
  const lines: string[] = []
  let cur = ''
  for (const p of parts) {
    const pVis = visWidth(p)
    const wouldBe = cur ? visWidth(cur) + sepVis + pVis : pVis
    if (cur && wouldBe > width) {
      lines.push(cur)
      cur = p
    }
    else {
      cur = cur ? cur + sep + p : p
    }
  }
  if (cur)
    lines.push(cur)
  return lines
}

function drawHeader(statusParts: string[]): void {
  const top = ansis.cyan(`╔${'═'.repeat(INNER_W)}╗`)
  const bot = ansis.cyan(`╚${'═'.repeat(INNER_W)}╝`)
  const empty = boxRow(' '.repeat(INNER_W))

  const logo = [
    '█             ██   ██',
    '█              ██ ██ ',
    '█               ███  ',
    '█                █   ',
    '██████           █   ',
  ]

  console.log()
  console.log(top)
  console.log(empty)
  for (const line of logo) {
    console.log(boxRow(centerLine(ansis.bold.white(line), INNER_W)))
  }
  console.log(empty)
  console.log(boxRow(centerLine(ansis.gray('Codex Single-Agent + OpenSpec'), INNER_W)))
  console.log(boxRow(centerLine(ansis.gray('Review Gates / GitFlow Release'), INNER_W)))
  console.log(empty)
  if (statusParts.length > 0) {
    for (const line of wrapStatusLines(statusParts, INNER_W)) {
      console.log(boxRow(centerLine(line, INNER_W)))
    }
    console.log(empty)
  }
  console.log(bot)
  console.log()
}

function groupSep(label: string): InstanceType<typeof inquirer.Separator> {
  const w = 42
  const labelW = visWidth(label)
  const remaining = Math.max(0, w - labelW - 2)
  const left = Math.floor(remaining / 2)
  const right = remaining - left
  return new inquirer.Separator(ansis.gray(`${'─'.repeat(left)} ${label} ${'─'.repeat(right)}`))
}

// ═══════════════════════════════════════════════════════
// Host picking（单宿主操作入口：已安装 >1 个宿主时显式选择；未选 = 全部已安装宿主）
// ═══════════════════════════════════════════════════════

/**
 * 已安装宿主只有 0/1 个 → 不询问，返回 undefined（调用方按"全部已安装宿主"处理）；
 * 多个 → 让用户选择（single = 单选，否则多选，默认全选）。
 */
export async function pickInstalledHosts(messageKey: string, opts: { single?: boolean } = {}): Promise<HostId[] | undefined> {
  return pickInstalledHostsWith(await listInstalledHosts(), async (question) => {
    const answer = await inquirer.prompt([question])
    return opts.single ? [answer.picked] : answer.picked
  }, Boolean(opts.single), i18n.t(messageKey))
}

/** 可测试的选择逻辑（ask 注入）：已安装 ≤1 个时不询问 */
export async function pickInstalledHostsWith(
  installed: HostId[],
  ask: (question: any) => Promise<HostId[]>,
  single: boolean,
  message = '',
): Promise<HostId[] | undefined> {
  if (installed.length <= 1)
    return installed.length === 1 && single ? installed : undefined
  return ask(single
    ? { type: 'list', name: 'picked', message, choices: installed.map(h => ({ name: h, value: h })) }
    : {
        type: 'checkbox',
        name: 'picked',
        message,
        choices: installed.map(h => ({ name: h, value: h, checked: true })),
        validate: (value: unknown[]) => value.length > 0 || i18n.t('init:hostSelect.required'),
      })
}

// ═══════════════════════════════════════════════════════
// Main Menu
// ═══════════════════════════════════════════════════════

export function buildMainMenuChoices(isZh: boolean): any[] {
  const item = (key: string, label: string, desc: string) => ({
    name: `  ${ansis.green(`${key}.`)} ${pad(label, 20)} ${ansis.gray(`- ${desc}`)}`,
    value: key,
  })

  return [
    groupSep(isZh ? '工作流' : 'Workflow'),
    item('1', i18n.t('menu:options.init'), isZh ? `安装 ${PACKAGE_NAME}` : `Install ${PACKAGE_NAME}`),
    item('2', i18n.t('menu:options.update'), isZh ? '更新到最新版本' : 'Update to latest version'),
    item('3', i18n.t('menu:options.configExecutorsAndModels'), isZh ? '配置执行者与模型' : 'Configure executors and models'),

    groupSep(isZh ? '帮助与卸载' : 'Help & Uninstall'),
    item('H', i18n.t('menu:options.help'), isZh ? '查看全部斜杠命令' : 'View all slash commands'),
    item('-', i18n.t('menu:options.uninstall'), isZh ? `移除 ${PACKAGE_NAME} 配置` : `Remove ${PACKAGE_NAME} config`),

    new inquirer.Separator(ansis.gray('─'.repeat(42))),
    { name: `  ${ansis.red('Q.')} ${i18n.t('menu:options.exit')}`, value: 'Q' },
  ]
}

export async function showMainMenu(): Promise<void> {
  while (true) {
    const installedHosts = await listInstalledHosts()
    const config = await readLyConfig(installedHosts[0] ?? DEFAULT_HOST)
    const cmdCount = config?.workflows?.installed?.length || 0
    const lang = config?.general?.language || 'zh-CN'

    const statusParts = [
      ansis.green(`v${version}`),
      ansis.white(`${cmdCount} commands`),
      ansis.yellow(lang),
      ansis.cyan(`hosts: ${installedHosts.length > 0 ? installedHosts.join('+') : '-'}`),
    ]
    if (sanitizeReviewModel(config?.host?.reviewModel)) {
      statusParts.push(ansis.green(`review model: ${config?.host?.reviewModel}`))
    }

    drawHeader(statusParts)

    const isZh = lang === 'zh-CN'

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: i18n.t('menu:title'),
      pageSize: 20,
      choices: buildMainMenuChoices(isZh),
    }])

    switch (action) {
      case '1':
        await init()
        break
      case '2':
        await update({ hosts: await pickInstalledHosts('menu:hostPick.update') })
        break
      case '3':
        await configExecutorsAndModels()
        break
      case '-':
        await uninstall()
        break
      case 'H':
        showHelp()
        break
      case 'Q':
        console.log()
        console.log(ansis.gray(`  ${i18n.t('common:goodbye')}`))
        console.log()
        return
    }

    // Pause after action so user can see results
    console.log()
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: ansis.gray(i18n.t('common:pressEnterToReturn')),
    }])
  }
}

// ═══════════════════════════════════════════════════════
// Help
// ═══════════════════════════════════════════════════════

function showHelp(): void {
  const config = readLyConfigSync()
  const isZh = (config?.general?.language || 'zh-CN') === 'zh-CN'

  console.log()
  console.log(ansis.cyan.bold(`  ${i18n.t('menu:help.title')}`))
  console.log()

  const col1 = 26
  const section = (title: string) => console.log(ansis.yellow.bold(`  ${title}`))
  const cmd = (name: string, desc: string) => console.log(`  ${ansis.green(name.padEnd(col1))} ${ansis.gray(desc)}`)
  const coreConfigs = getWorkflowConfigs()

  let shown = 0
  for (const host of listRegisteredHosts()) {
    const adapter = getAdapter(host)
    const commandsDir = adapter.defaultPaths().skillsDir
    let installed: string[] = []
    try {
      installed = fs.readdirSync(commandsDir)
        .filter(f => f.startsWith('lyx-') && fs.statSync(join(commandsDir, f)).isDirectory())
        .map(f => f.replace(/^lyx-/, ''))
    }
    catch { continue }
    if (installed.length === 0)
      continue
    shown++
    section(`${isZh ? '核心命令' : 'Core commands'} [${host}]`)
    for (const config_ of coreConfigs) {
      for (const cmdName of config_.commands) {
        if (installed.includes(cmdName))
          cmd(`${adapter.commandPrefix}lyx-${cmdName}`, (isZh ? config_.description : config_.descriptionEn) || '')
      }
    }
    console.log()
  }

  if (shown === 0) {
    console.log(ansis.yellow(`  ${isZh ? '未找到已安装的命令。' : 'No installed commands found.'}`))
    console.log(ansis.gray(`  ${isZh ? '运行 `lycx init` 后查看已安装命令' : 'Run `lycx init` then check installed commands'}`))
    console.log()
    return
  }

  console.log(ansis.gray(`  ${i18n.t('menu:help.hint')}`))
  console.log()
}

/**
 * Synchronous config read for non-async contexts (help display)
 */
function readLyConfigSync(): any {
  try {
    const installed = listRegisteredHosts().map(h => getHostConfigPath(h)).filter(p => fs.pathExistsSync(p))
    const configPath = installed[0] ?? getConfigPath()
    if (fs.pathExistsSync(configPath)) {
      return parseTOML(fs.readFileSync(configPath, 'utf-8'))
    }
  }
  catch { /* ignore */ }
  return null
}

// ═══════════════════════════════════════════════════════
// 子代理配置（执行者 / 模型 / 推理档）编辑
// ═══════════════════════════════════════════════════════

/**
 * 子代理配置编辑入口（两宿主同口径）：执行者二连 → 模型二连 → 推理档二连，
 * 复用与 `lycx init` 相同的采集实现；差异只在推理档建议清单由宿主适配层提供。
 * 未触碰的字段以既有值回填；写回后按当前配置重渲染产物（claude 同时重渲子代理定义）。
 */
export async function configExecutorsAndModels(): Promise<void> {
  const hosts = await pickInstalledHosts('menu:hostPick.config', { single: true })
  const host = hosts?.[0] ?? DEFAULT_HOST
  const config = await readLyConfig(host)
  if (!config) {
    console.log(`  ${ansis.yellow('⚠')} ${PACKAGE_NAME} config not initialized (${host})`)
    return
  }

  const current: SubagentConfigCollected = {
    reviewExecutor: sanitizeExecutor(config.host?.reviewExecutor),
    codingExecutor: sanitizeExecutor(config.host?.codingExecutor),
    reviewModel: sanitizeReviewModel(config.host?.reviewModel),
    codingModel: sanitizeModelField(config.host?.codingModel),
    reviewReasoningEffort: sanitizeReasoningEffort(config.host?.reviewReasoningEffort),
    codingReasoningEffort: sanitizeReasoningEffort(config.host?.codingReasoningEffort),
  }
  const next = await collectSubagentConfig({
    defaults: current,
    executorHintKey: host === 'claude' ? 'init:claude.executorHint' : 'init:executor.hint',
    suggestions: getAdapter(host).reasoningEffortSuggestions,
  })

  const changed = (Object.keys(current) as Array<keyof SubagentConfigCollected>)
    .some(key => next[key] !== current[key])
  if (!changed) {
    console.log(ansis.gray(`  ${i18n.t('common:configNotModified')}`))
    return
  }

  const fresh = await readLyConfig(host)
  if (!fresh) {
    console.log(`  ${ansis.yellow('⚠')} ${PACKAGE_NAME} config not initialized (${host})`)
    return
  }
  // 写回全部六个字段（未触碰者已由采集默认值回填）；spawnableModels 等范围外字段由 mergeHostConfig 保留。
  fresh.host = mergeHostConfig(fresh.host, next)
  await writeLyConfig(fresh, host)

  console.log()
  console.log(ansis.green(`  ✓ ${i18n.t('init:model.routingUpdated')}`))
  const modelLine = (value: string | undefined): string =>
    value ? ansis.green(value) : ansis.gray(i18n.t('init:host.reviewModelUnset'))
  const effortLine = (value: string | undefined): string =>
    value
      ? ansis.green(i18n.t('init:summary.reasoningConfigured', { value }))
      : ansis.gray(i18n.t('init:summary.reasoningUnset'))
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewModelA'))} ${modelLine(next.reviewModel)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.codingModel'))} ${modelLine(next.codingModel)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewReasoningEffort'))} ${effortLine(next.reviewReasoningEffort)}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.codingReasoningEffort'))} ${effortLine(next.codingReasoningEffort)}`)

  // 改配置后重装命令模板（claude 同时按当前配置重渲子代理定义）
  await reinstallTemplates(host)
}

/** 配置变更后的命令模板重装（指定宿主，--force 覆盖渲染；claude 同时重渲子代理定义） */
async function reinstallTemplates(host: HostId): Promise<void> {
  const spinner = ora(i18n.t('init:model.reinstalling')).start()
  try {
    const config = await readLyConfig(host)
    const result = await installWorkflows(getCoreCommandIds(), '', true, { hosts: [host], hostConfig: { [host]: config?.host ?? {} } })
    if (result.success) {
      spinner.succeed(i18n.t('init:model.reinstallDone'))
    }
    else {
      spinner.fail(i18n.t('init:model.reinstallFailed'))
    }
    for (const error of result.errors) {
      console.log(ansis.yellow(`  ⚠ ${error}`))
    }
  }
  catch {
    spinner.fail(i18n.t('init:model.reinstallFailed'))
  }
}

// ═══════════════════════════════════════════════════════
// Uninstall
// ═══════════════════════════════════════════════════════

/**
 * Check if ly-workflow-codex is installed globally via npm
 */
async function checkIfGlobalInstall(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`npm list -g ${PACKAGE_NAME} --depth=0`, { timeout: 5000 })
    return stdout.includes(`${PACKAGE_NAME}@`)
  }
  catch {
    return false
  }
}

async function uninstall(): Promise<void> {
  console.log()

  // Check if installed globally via npm
  const isGlobalInstall = await checkIfGlobalInstall()

  if (isGlobalInstall) {
    console.log(ansis.yellow(`  ⚠️  ${i18n.t('menu:uninstall.globalDetected')}`))
    console.log()
    console.log(`  ${i18n.t('menu:uninstall.twoSteps')}`)
    console.log(`    ${ansis.cyan(`1. ${i18n.t('menu:uninstall.step1')}`)} ${ansis.gray(`(${i18n.t('menu:uninstall.step1Hint')})`)}`)
    console.log(`    ${ansis.cyan(`2. ${i18n.t('menu:uninstall.step2')}`)} ${ansis.gray(`(${i18n.t('menu:uninstall.step2Hint')})`)}`)
    console.log()
  }

  // 先确定要卸载的宿主，再按该集合的实际删除 / 修改范围生成确认文案（与 CLI 一致）
  const hosts = await resolveUninstallHosts(await pickInstalledHosts('menu:hostPick.uninstall'))
  console.log(`  ${i18n.t('menu:uninstall.scopeTitle')}`)
  for (const line of describeUninstallTargets(hosts))
    console.log(ansis.gray(`    ${line}`))
  console.log(ansis.gray(`  ${i18n.t('menu:uninstall.scopeNote')}`))
  console.log()

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: isGlobalInstall ? i18n.t('menu:uninstall.continuePrompt') : i18n.t('menu:uninstall.confirm'),
    default: false,
  }])

  if (!confirm) {
    console.log(ansis.gray(`  ${i18n.t('menu:uninstall.cancelled')}`))
    return
  }

  console.log()
  console.log(ansis.yellow(`  ${i18n.t('menu:uninstall.uninstalling')}`))

  const result = await runUninstall(hosts)

  if (result.success) {
    console.log(ansis.green(`  ✅ ${i18n.t('menu:uninstall.success')}`))

    console.log()
    printUninstallResult(result)

    if (isGlobalInstall) {
      console.log()
      console.log(ansis.yellow.bold(`  🔸 ${i18n.t('menu:uninstall.lastStep')}`))
      console.log()
      console.log(`  ${i18n.t('menu:uninstall.runInNewTerminal')}`)
      console.log()
      console.log(ansis.cyan.bold(`    npm uninstall -g ${PACKAGE_NAME}`))
      console.log()
      console.log(ansis.gray(`  (${i18n.t('menu:uninstall.afterDone')})`))
    }
  }
  else {
    console.log(ansis.red(`  ${i18n.t('menu:uninstall.failed')}`))
    for (const error of result.errors) {
      console.log(ansis.red(`    ${error}`))
    }
  }

  console.log()
}
