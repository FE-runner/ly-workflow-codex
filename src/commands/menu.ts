import { exec } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { join } from 'pathe'
import { parse as parseTOML } from 'smol-toml'
import { version } from '../../package.json'
import { i18n } from '../i18n'
import { getConfigPath, readLyConfig, resolveSpawnableModels, sanitizeModelField, sanitizeReviewModel, writeLyConfig } from '../utils/config'
import { getCoreCommandIds, getWorkflowConfigs, installWorkflows, uninstallWorkflows } from '../utils/installer'
import { buildModelFieldChoices, MODEL_CHOICE_UNSET } from '../utils/model-candidates'
import { AGENTS_SKILLS_DIR, PACKAGE_NAME } from '../utils/package-meta'
import { init } from './init'
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
    item('3', i18n.t('menu:options.configReviewModel'), isZh ? '配置审查模型' : 'Configure review model'),

    groupSep(isZh ? '帮助与卸载' : 'Help & Uninstall'),
    item('H', i18n.t('menu:options.help'), isZh ? '查看全部斜杠命令' : 'View all slash commands'),
    item('-', i18n.t('menu:options.uninstall'), isZh ? `移除 ${PACKAGE_NAME} 配置` : `Remove ${PACKAGE_NAME} config`),

    new inquirer.Separator(ansis.gray('─'.repeat(42))),
    { name: `  ${ansis.red('Q.')} ${i18n.t('menu:options.exit')}`, value: 'Q' },
  ]
}

export async function showMainMenu(): Promise<void> {
  while (true) {
    const config = await readLyConfig()
    const cmdCount = config?.workflows?.installed?.length || 0
    const lang = config?.general?.language || 'zh-CN'

    const statusParts = [
      ansis.green(`v${version}`),
      ansis.white(`${cmdCount} commands`),
      ansis.yellow(lang),
    ]
    if (sanitizeReviewModel(config?.codexHost?.reviewModel)) {
      statusParts.push(ansis.green(`review model: ${config?.codexHost?.reviewModel}`))
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
        await update()
        break
      case '3':
        await configReviewModel()
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

  const col1 = 22
  const section = (title: string) => console.log(ansis.yellow.bold(`  ${title}`))
  const cmd = (name: string, desc: string) => console.log(`  ${ansis.green(name.padEnd(col1))} ${ansis.gray(desc)}`)

  const commandsDir = AGENTS_SKILLS_DIR

  let installedFiles: string[] = []
  try {
    installedFiles = fs.readdirSync(commandsDir).filter((f) => {
      if (!f.startsWith('lyx-'))
        return false
      try {
        return fs.statSync(join(commandsDir, f)).isDirectory()
      }
      catch { return false }
    })
  }
  catch {
    console.log(ansis.yellow(`  ${isZh ? '未找到已安装的命令。' : 'No installed commands found.'}`))
    console.log(ansis.gray(`  ${isZh ? '运行 `lycx init` 后查看已安装命令' : 'Run `lycx init` then check installed commands'}`))
    console.log()
    return
  }

  const coreConfigs = getWorkflowConfigs()
  const coreCommandNames = new Set(coreConfigs.flatMap(w => w.commands))

  const coreFiles = installedFiles.map(f => f.replace(/^lyx-/, ''))

  section(isZh ? '核心命令' : 'Core commands')
  for (const config_ of coreConfigs) {
    for (const cmdName of config_.commands) {
      if (coreFiles.includes(cmdName) && coreCommandNames.has(cmdName)) {
        cmd(`@lyx-${cmdName}`, (isZh ? config_.description : config_.descriptionEn) || '')
      }
    }
  }
  console.log()

  console.log(ansis.gray(`  ${i18n.t('menu:help.hint')}`))
  console.log()
}

/**
 * Synchronous config read for non-async contexts (help display)
 */
function readLyConfigSync(): any {
  try {
    const configPath = getConfigPath()
    if (fs.pathExistsSync(configPath)) {
      return parseTOML(fs.readFileSync(configPath, 'utf-8'))
    }
  }
  catch { /* ignore */ }
  return null
}

// ═══════════════════════════════════════════════════════
// Review model configuration
// ═══════════════════════════════════════════════════════

/** codex 宿主审查模型（codexHost.reviewModel）编辑入口 */
async function configReviewModel(): Promise<void> {
  const config = await readLyConfig()
  const currentReviewModel = sanitizeReviewModel(config?.codexHost?.reviewModel)
  // 候选/默认语义与 init 模型三连共用（buildModelFieldChoices），来源 = spawnableModels 生效清单
  const spawnableModels = resolveSpawnableModels(config?.codexHost)

  console.log()
  console.log(ansis.cyan.bold(`  ${i18n.t('init:model.title')}`))
  console.log()
  console.log(ansis.gray(`  ${i18n.t('init:host.reviewModelHint')}`))

  const { choices, defaultChoice } = buildModelFieldChoices({
    models: spawnableModels,
    current: currentReviewModel,
  })
  const { model } = await inquirer.prompt([{
    type: 'list',
    name: 'model',
    message: i18n.t('init:host.reviewModelPrompt'),
    choices,
    default: defaultChoice,
    pageSize: 15,
  }])
  const next = model === MODEL_CHOICE_UNSET ? undefined : sanitizeReviewModel(model)

  if (next === currentReviewModel) {
    console.log(ansis.gray(`  ${i18n.t('common:configNotModified')}`))
    return
  }

  const fresh = await readLyConfig()
  if (!fresh) {
    console.log(`  ${ansis.yellow('⚠')} ${PACKAGE_NAME} config not initialized`)
    return
  }
  // 写回保留既有 reviewModelB / codingModel / spawnableModels（本次仍只编辑审查 agent A）
  const existingB = sanitizeModelField(fresh.codexHost?.reviewModelB)
  const existingCoding = sanitizeModelField(fresh.codexHost?.codingModel)
  const existingSpawnable = fresh.codexHost?.spawnableModels
  if (next || existingB || existingCoding || existingSpawnable !== undefined) {
    fresh.codexHost = {
      ...(next ? { reviewModel: next } : {}),
      ...(existingB ? { reviewModelB: existingB } : {}),
      ...(existingCoding ? { codingModel: existingCoding } : {}),
      ...(existingSpawnable !== undefined ? { spawnableModels: existingSpawnable } : {}),
    }
  }
  else {
    fresh.codexHost = undefined
  }
  await writeLyConfig(fresh)

  console.log()
  console.log(ansis.green(`  ✓ ${i18n.t('init:model.routingUpdated')}`))
  console.log(`  ${ansis.cyan(i18n.t('init:summary.reviewModelCodex'))} ${next || i18n.t('init:host.reviewModelUnset')}`)

  // reviewModel 渲染进 codex 版审查命令模板（-m 参数），改配置后按新值重装 codex 模板
  await reinstallTemplates()
}

/** 模型配置变更后的命令模板重装（codex 宿主，--force 覆盖渲染） */
async function reinstallTemplates(): Promise<void> {
  const spinner = ora(i18n.t('init:model.reinstalling')).start()
  try {
    const config = await readLyConfig()
    const reviewModel = sanitizeReviewModel(config?.codexHost?.reviewModel)
    const spawnableModels = resolveSpawnableModels(config?.codexHost)
    const result = await installWorkflows(getCoreCommandIds(), '', true, { reviewModel, spawnableModels })
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

  const result = await uninstallWorkflows(join(homedir(), '.codex'))

  if (result.success) {
    console.log(ansis.green(`  ✅ ${i18n.t('menu:uninstall.success')}`))

    if (result.removedSkills.length > 0) {
      console.log()
      console.log(ansis.cyan(`  ${i18n.t('menu:uninstall.removedSkills')}`))
      for (const file of result.removedSkills) {
        console.log(`    ${ansis.gray('•')} ${file}`)
      }
    }

    if (result.removedLegacyPrompts.length > 0) {
      console.log()
      console.log(ansis.cyan(`  ${i18n.t('menu:uninstall.removedLegacyPrompts')}`))
      for (const file of result.removedLegacyPrompts) {
        console.log(`    ${ansis.gray('•')} ${file}`)
      }
    }

    if (result.removedSharedPrompts) {
      console.log()
      console.log(ansis.cyan(`  ${i18n.t('menu:uninstall.removedSharedPrompts')}`))
    }

    if (result.configTomlKept) {
      console.log()
      console.log(ansis.cyan(`  ${i18n.t('menu:uninstall.configTomlKept')}`))
    }

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
