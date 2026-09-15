import type { LyConfig } from '../types'
import { execSync } from 'node:child_process'
import ansis from 'ansis'
import fs from 'fs-extra'
import { join } from 'pathe'
import { version as packageVersion } from '../../package.json'
import { i18n } from '../i18n'
import { readCodexCurrentModel } from '../utils/codex-provider'
import { LY_PROMPTS_DIR, readLyConfig, resolveSpawnableModels, sanitizeModelField, sanitizeReviewModel, sanitizeSpawnableModels } from '../utils/config'
import { AGENTS_SKILLS_DIR, PACKAGE_NAME } from '../utils/package-meta'
import { detectOpenspecCli, detectOpenspecSkills } from '../utils/preflight'

const OK = ansis.green('✓')
const WARN = ansis.yellow('⚠')
const FAIL = ansis.red('✗')

async function fileExists(p: string): Promise<boolean> {
  return fs.pathExists(p)
}

async function dirFiles(p: string): Promise<string[]> {
  if (!(await fs.pathExists(p)))
    return []
  return (await fs.readdir(p)).filter(f => !f.startsWith('.'))
}

function execSafe(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: 'pipe', timeout: 10000 }).toString().trim()
  }
  catch { return null }
}

export interface SubagentModelFieldResult {
  key: string
  /** 配置值（清洗后）；undefined = 留空（回退当前会话模型） */
  value?: string
  status: 'ok' | 'fail'
  /** 判定原因：'unset' 留空 | 'in-list' 在可用清单内 | 'out-of-list' 不在可用清单内 */
  okKind: 'unset' | 'in-list' | 'out-of-list'
}

export interface SubagentModelConfigResult {
  /** 总体状态：fail（存在清单外模型）> warn（spawnableModels 形态异常）> ok */
  status: 'ok' | 'warn' | 'fail'
  fields: SubagentModelFieldResult[]
  /** 生效清单（用户配置或内置默认） */
  effectiveModels: string[]
  /** 清单来源：configured = 用户配置；builtin = 内置默认 */
  listSource: 'configured' | 'builtin'
  /** spawnableModels 字段形态（empty/invalid 时对总体输出 WARN，区别于未配置的静默通过） */
  spawnState: 'unset' | 'ok' | 'empty' | 'invalid'
  /** 留空字段将继承的当前会话模型不在生效清单（仅交叉校验命中时存在；WARN 提示来源） */
  inheritedModel?: { model: string }
}

/**
 * 子代理模型配置审查（doctor 第 7 项核心判定，独立导出便于单测）：
 * 以 spawnableModels 生效清单为唯一校验来源，三个模型字段逐项判定——
 * 留空 = 通过（回退当前会话模型）；非空且 ∈ 生效清单 = 通过；非空且 ∉ = FAIL。
 * spawnableModels 字段显式存在但格式非法/清洗后为空 → 总体 WARN（区别于未配置）。
 * 可选交叉校验（opts.currentModel = ~/.codex/config.toml 顶层 model）：存在留空字段时，
 * 当前会话模型可检测到但 ∉ 生效清单 → 总体 WARN（提示"留空继承的模型可能不可 spawn"，
 * 事前体检尽力而为，运行期 spawn 失败兜底仍由模板规则承担）；未检测到则不提示。
 */
export function assessSubagentModelConfig(
  codexHost: LyConfig['codexHost'],
  opts?: { currentModel?: string },
): SubagentModelConfigResult {
  const spawn = sanitizeSpawnableModels(codexHost?.spawnableModels)
  const effectiveModels = resolveSpawnableModels(codexHost)

  const fields: SubagentModelFieldResult[] = [
    { key: 'reviewModel', value: sanitizeReviewModel(codexHost?.reviewModel) },
    { key: 'reviewModelB', value: sanitizeModelField(codexHost?.reviewModelB) },
    { key: 'codingModel', value: sanitizeModelField(codexHost?.codingModel) },
  ].map((f) => {
    const ok = !f.value || effectiveModels.includes(f.value)
    return {
      key: f.key,
      value: f.value,
      status: ok ? 'ok' : 'fail',
      okKind: !f.value ? 'unset' : ok ? 'in-list' : 'out-of-list',
    }
  })

  const anyFail = fields.some(f => f.status === 'fail')
  const spawnWarn = spawn.state === 'empty' || spawn.state === 'invalid'
  const currentModel = opts?.currentModel?.trim()
  const hasUnsetField = fields.some(f => !f.value)
  const inheritedModel = currentModel && hasUnsetField && !effectiveModels.includes(currentModel)
    ? { model: currentModel }
    : undefined
  return {
    status: anyFail ? 'fail' : spawnWarn || inheritedModel ? 'warn' : 'ok',
    fields,
    effectiveModels,
    listSource: spawn.state === 'ok' ? 'configured' : 'builtin',
    spawnState: spawn.state,
    inheritedModel,
  }
}

/** 第 7 项检查详情：逐字段判定 + 生效清单 + spawnableModels 形态 WARN */
function buildSubagentModelCheckDetail(result: SubagentModelConfigResult): string {
  const parts = result.fields.map((f) => {
    if (f.status === 'ok') {
      return f.value
        ? i18n.t('doctor:modelConfig.okInList', { key: f.key, model: f.value })
        : i18n.t('doctor:modelConfig.okUnset', { key: f.key })
    }
    return i18n.t('doctor:modelConfig.failNotInList', { key: f.key, model: f.value })
  })
  const list = result.listSource === 'configured'
    ? i18n.t('doctor:modelConfig.listConfigured', { list: result.effectiveModels.join(', ') })
    : i18n.t('doctor:modelConfig.listBuiltin', { list: result.effectiveModels.join(', ') })
  const spawnWarn = result.spawnState === 'empty' || result.spawnState === 'invalid'
    ? `; ${i18n.t('doctor:modelConfig.warnInvalid')}`
    : ''
  const inheritedWarn = result.inheritedModel
    ? `; ${i18n.t('doctor:modelConfig.warnInheritNotInList', { model: result.inheritedModel.model })}`
    : ''
  return `${parts.join('; ')}; ${list}${spawnWarn}${inheritedWarn}`
}

export async function doctor(): Promise<void> {
  const checks: { label: string, status: string, detail: string }[] = []

  // 1. Node version
  const nodeVer = process.version
  const major = Number.parseInt(nodeVer.slice(1))
  checks.push({
    label: 'Node.js',
    status: major >= 20 ? OK : FAIL,
    detail: `${nodeVer}${major < 20 ? ' (requires >=20)' : ''}`,
  })

  // 2. ly-workflow-codex config
  const config = await readLyConfig()
  checks.push({
    label: 'config',
    status: config ? OK : WARN,
    detail: config ? `v${config.general?.version || '?'}, lang=${config.general?.language || '?'}` : 'Not found (~/.ly/config.toml)',
  })

  // 3. Commands (lyx-* SKILL.md under ~/.agents/skills)
  const skillsEntries = await dirFiles(AGENTS_SKILLS_DIR)
  const cmdCount = skillsEntries.filter(f => f.startsWith('lyx-')).length
  checks.push({
    label: 'Commands',
    status: cmdCount > 0 ? OK : FAIL,
    detail: `${cmdCount} installed (~/.agents/skills/lyx-*/)`,
  })

  // 4. Role prompts (shared ~/.ly/prompts/codex/)
  const roleDir = join(LY_PROMPTS_DIR, 'codex')
  const roleFiles = (await dirFiles(roleDir)).filter(f => f.endsWith('.md'))
  checks.push({
    label: 'Roles',
    status: roleFiles.length >= 2 ? OK : roleFiles.length > 0 ? WARN : FAIL,
    detail: roleFiles.length > 0 ? roleFiles.join(', ') : 'None (~/.ly/prompts/codex/)',
  })

  // 5. OpenSpec CLI
  const openspecCli = await detectOpenspecCli()
  checks.push({
    label: 'OpenSpec CLI',
    status: openspecCli.installed ? OK : WARN,
    detail: openspecCli.installed ? `v${openspecCli.version}` : i18n.t('common:doctor.openspecCliMissing'),
  })

  // 6. OpenSpec skills (openspec-* SKILL.md)
  const hasOpenspecSkills = detectOpenspecSkills()
  checks.push({
    label: 'OpenSpec skills',
    status: hasOpenspecSkills ? OK : WARN,
    detail: hasOpenspecSkills ? i18n.t('common:doctor.skillsInitialized') : i18n.t('common:doctor.skillsMissing'),
  })

  // 7. Codex 子代理模型配置（候选/校验唯一来源 = spawnableModels 生效清单）。
  // config 缺失时第 7 项仍按全字段未配置判定 OK（行为可接受）：config 文件缺失已由
  // 第 1 项 config 检查（WARN）兜底，此处无需重复报错。
  const currentModel = await readCodexCurrentModel()
  const modelCheck = assessSubagentModelConfig(config?.codexHost, { currentModel })
  checks.push({
    label: i18n.t('doctor:modelConfig.label'),
    status: modelCheck.status === 'fail' ? FAIL : modelCheck.status === 'warn' ? WARN : OK,
    detail: buildSubagentModelCheckDetail(modelCheck),
  })

  // Output
  console.log()
  console.log(ansis.cyan.bold(`  ly-workflow-codex Doctor v${packageVersion}`))
  console.log()
  for (const { label, status, detail } of checks) {
    console.log(`  ${status} ${ansis.bold(label.padEnd(20))} ${ansis.gray(detail)}`)
  }

  const failures = checks.filter(c => c.status === FAIL)
  console.log()
  if (failures.length === 0) {
    console.log(ansis.green('  All checks passed.'))
  }
  else {
    console.log(ansis.red(`  ${failures.length} issue(s) found. Run ${ansis.cyan(`npx ${PACKAGE_NAME}`)} to reinstall.`))
  }
  console.log()
}

export async function status(): Promise<void> {
  // Version
  const config = await readLyConfig()
  const installedVer = config?.general?.version || 'unknown'
  const latestVer = execSafe(`npm view ${PACKAGE_NAME} version`) || 'unknown'

  // Commands (ly-* skills)
  const cmds = (await dirFiles(AGENTS_SKILLS_DIR)).filter(f => f.startsWith('lyx-'))

  // Review model
  const reviewModel = config?.codexHost?.reviewModel || '未配置（回退当前会话模型）'

  // Active tasks
  let activeTasks = 0
  const tasksDir = join(process.cwd(), '.ly', 'tasks')
  if (await fileExists(tasksDir)) {
    for (const d of await fs.readdir(tasksDir)) {
      if (d === 'archive')
        continue
      const taskJson = join(tasksDir, d, 'task.json')
      if (await fileExists(taskJson)) {
        try {
          const t = await fs.readJSON(taskJson)
          const s = String(t.status || '').toLowerCase()
          if (!['completed', 'complete', 'done', 'finished', 'archived', 'cancelled', 'closed'].includes(s)) {
            activeTasks++
          }
        }
        catch { /* ignore */ }
      }
    }
  }

  // OpenSpec dependency (same detectors as installer preflight)
  const openspecCli = await detectOpenspecCli()
  const hasOpenspecSkills = detectOpenspecSkills()

  // Output
  console.log()
  console.log(ansis.cyan.bold('  ly-workflow-codex Status'))
  console.log()
  console.log(`  ${ansis.bold('Version')}        ${installedVer}${installedVer !== latestVer ? ansis.yellow(` (latest: ${latestVer})`) : ansis.green(' (up to date)')}`)
  console.log(`  ${ansis.bold('Commands')}       ${cmds.length}`)
  console.log(`  ${ansis.bold('Review model')}   ${reviewModel}`)
  console.log(`  ${ansis.bold('OpenSpec CLI')}   ${openspecCli.installed ? `v${openspecCli.version}` : ansis.yellow(i18n.t('common:doctor.openspecCliMissing'))}`)
  console.log(`  ${ansis.bold('OpenSpec skills')}${hasOpenspecSkills ? ` ${i18n.t('common:doctor.skillsInitialized')}` : ansis.yellow(` ${i18n.t('common:doctor.skillsMissing')}`)}`)
  console.log(`  ${ansis.bold('Active tasks')}   ${activeTasks > 0 ? ansis.yellow(String(activeTasks)) : '0'}`)
  console.log()
}
