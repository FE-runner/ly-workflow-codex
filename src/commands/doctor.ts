import { execSync } from 'node:child_process'
import ansis from 'ansis'
import fs from 'fs-extra'
import { join } from 'pathe'
import { version as packageVersion } from '../../package.json'
import { i18n } from '../i18n'
import { LY_PROMPTS_DIR, readLyConfig } from '../utils/config'
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
