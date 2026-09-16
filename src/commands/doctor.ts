import type { LyConfig } from '../types'
import { execSync } from 'node:child_process'
import ansis from 'ansis'
import fs from 'fs-extra'
import { join } from 'pathe'
import { version as packageVersion } from '../../package.json'
import { i18n } from '../i18n'
import { readCodexCurrentModel } from '../utils/codex-provider'
import { LY_PROMPTS_DIR, readLyConfig, sanitizeModelField, sanitizeReasoningEffort, sanitizeReviewModel, sanitizeSpawnableModels } from '../utils/config'
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
  status: 'ok'
  /** 判定原因：'unset' 留空 | 'configured' 已配置 */
  okKind: 'unset' | 'configured'
  /** 与该模型字段一一对应的推理档字段名 */
  reasoningEffortKey: string
  /** 推理档值（清洗后）；undefined = 未配置（不传 reasoning_effort） */
  reasoningEffort?: string
  /** 【弃用字段标记】单审查执行模型不再读取使用（字段与存量值保留，仅提示） */
  deprecated?: boolean
}

export interface SubagentModelConfigResult {
  /** 总体状态：warn（spawnableModels 形态异常）> ok；模型字段本身只做提示不做强校验 */
  status: 'ok' | 'warn'
  fields: SubagentModelFieldResult[]
  /** spawnableModels 字段形态（empty/invalid 时对总体输出 WARN，区别于未配置的静默通过） */
  spawnState: 'unset' | 'ok' | 'empty' | 'invalid'
}

/**
 * 子代理模型配置审查（doctor 第 7 项核心判定，独立导出便于单测）：
 * 三个模型字段只做提示不做清单强校验——留空 = 通过（回退当前会话模型）；非空 = 通过
 * （已配置，标注"agent 模型需额外配置"：能否 spawn 由环境实际能力决定，不做预校验，
 * 运行期以宿主 spawn 报错为准，见模板示例 prompt 验证方法）。spawnableModels 字段显式
 * 存在但格式非法/清洗后为空 → 总体 WARN（区别于未配置，仅作形态提示）。
 */
export function assessSubagentModelConfig(codexHost: LyConfig['codexHost']): SubagentModelConfigResult {
  const spawn = sanitizeSpawnableModels(codexHost?.spawnableModels)

  const fields: SubagentModelFieldResult[] = [
    {
      key: 'reviewModel',
      value: sanitizeReviewModel(codexHost?.reviewModel),
      reasoningEffortKey: 'reviewReasoningEffort',
      reasoningEffort: sanitizeReasoningEffort(codexHost?.reviewReasoningEffort),
    },
    {
      key: 'reviewModelB',
      value: sanitizeModelField(codexHost?.reviewModelB),
      reasoningEffortKey: 'reviewReasoningEffortB',
      reasoningEffort: sanitizeReasoningEffort(codexHost?.reviewReasoningEffortB),
    },
    {
      key: 'codingModel',
      value: sanitizeModelField(codexHost?.codingModel),
      reasoningEffortKey: 'codingReasoningEffort',
      reasoningEffort: sanitizeReasoningEffort(codexHost?.codingReasoningEffort),
    },
  ].map((f) => ({
    key: f.key,
    value: f.value,
    status: 'ok' as const,
    okKind: f.value ? 'configured' as const : 'unset' as const,
    reasoningEffortKey: f.reasoningEffortKey,
    reasoningEffort: f.reasoningEffort,
    deprecated: f.key === 'reviewModelB' || f.reasoningEffortKey === 'reviewReasoningEffortB',
  }))

  const spawnWarn = spawn.state === 'empty' || spawn.state === 'invalid'
  return {
    status: spawnWarn ? 'warn' : 'ok',
    fields,
    spawnState: spawn.state,
  }
}

/** 第 7 项检查详情（单行）：逐字段提示 + spawnableModels 形态 WARN */
function buildSubagentModelCheckDetail(result: SubagentModelConfigResult): string {
  const parts = result.fields.flatMap((f) => {
    const modelPart = f.value
      ? i18n.t('doctor:modelConfig.okConfigured', { key: f.key, model: f.value })
      : i18n.t('doctor:modelConfig.okUnset', { key: f.key })
    const reasoningPart = f.reasoningEffort
      ? i18n.t('doctor:modelConfig.okReasoningConfigured', { key: f.reasoningEffortKey, effort: f.reasoningEffort })
      : i18n.t('doctor:modelConfig.okReasoningUnset', { key: f.reasoningEffortKey })
    const deprecatedPart = f.deprecated ? i18n.t('doctor:modelConfig.deprecatedNote') : ''
    return [modelPart + deprecatedPart, reasoningPart]
  })
  if (result.spawnState === 'empty' || result.spawnState === 'invalid')
    parts.push(i18n.t('doctor:modelConfig.warnInvalid'))
  return parts.join('; ')
}

/** 第 7 项补充提示（附在检查列表后）：agent 模型需额外配置 + 示例验证 prompt */
function buildSubagentModelHintLines(currentModel?: string): string[] {
  const lines = [i18n.t('doctor:modelConfig.agentNeedConfig')]
  if (currentModel)
    lines.push(i18n.t('doctor:modelConfig.inheritNote', { model: currentModel }))
  lines.push(i18n.t('doctor:modelConfig.verifyHint'))
  return lines
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

  // 7. Codex 子代理模型配置（提示型）：三字段留空 = 继承当前会话模型；非空 = 已配置
  // （agent 模型需额外配置，能否 spawn 由环境实际能力决定，不做清单强校验）。
  // config 缺失时第 7 项仍按全字段未配置判定 OK（行为可接受）：config 文件缺失已由
  // 第 1 项 config 检查（WARN）兜底，此处无需重复报错。
  const currentModel = await readCodexCurrentModel()
  const modelCheck = assessSubagentModelConfig(config?.codexHost)
  checks.push({
    label: i18n.t('doctor:modelConfig.label'),
    status: modelCheck.status === 'warn' ? WARN : OK,
    detail: buildSubagentModelCheckDetail(modelCheck),
  })

  // Output
  console.log()
  console.log(ansis.cyan.bold(`  ly-workflow-codex Doctor v${packageVersion}`))
  console.log()
  for (const { label, status, detail } of checks) {
    console.log(`  ${status} ${ansis.bold(label.padEnd(20))} ${ansis.gray(detail)}`)
  }
  for (const line of buildSubagentModelHintLines(currentModel))
    console.log(ansis.gray(`     ${line}`))

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
