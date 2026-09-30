import type { HostDoctorCheck, HostId } from '../utils/host-adapters'
import { execSync } from 'node:child_process'
import ansis from 'ansis'
import fs from 'fs-extra'
import { join } from 'pathe'
import { version as packageVersion } from '../../package.json'
import { i18n } from '../i18n'
import { getHostConfigPath, readLyConfig, sanitizeExecutor } from '../utils/config'
import { listPrefixedDirs } from '../utils/fs-helpers'
import { getAdapter } from '../utils/host-adapters'
import { resolveTargetHosts } from '../utils/host-selection'
import { PACKAGE_NAME } from '../utils/package-meta'
import { inspectOpenspec } from '../utils/preflight'

const OK = ansis.green('✓')
const WARN = ansis.yellow('⚠')
const FAIL = ansis.red('✗')

function execSafe(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: 'pipe', timeout: 10000 }).toString().trim()
  }
  catch { return null }
}

function buildOpenspecSkillsDetail(status: string, missing: string[]): string {
  if (status === 'project-ready')
    return i18n.t('common:doctor.skillsInitialized')
  if (status === 'global-only')
    return i18n.t('common:doctor.skillsGlobalOnly')
  if (status === 'unknown')
    return i18n.t('common:doctor.skillsUnknown')
  return i18n.t('common:doctor.skillsMissing', { list: missing.join(', ') || 'unknown' })
}

function buildOpenspecRootDetail(status: string): string {
  if (status === 'healthy')
    return i18n.t('common:doctor.rootHealthy')
  if (status === 'missing')
    return i18n.t('common:doctor.rootMissing')
  if (status === 'unhealthy')
    return i18n.t('common:doctor.rootUnhealthy')
  return i18n.t('common:doctor.rootNotChecked')
}

export { assessSubagentModelConfig } from '../hosts/codex/doctor'
export type { SubagentExecutorResult, SubagentModelConfigResult, SubagentModelFieldResult } from '../hosts/codex/doctor'

export interface HostOpsOptions {
  /** 只作用于指定宿主；缺省 = 全部已安装宿主 */
  hosts?: HostId[]
}

const STATUS_ICON: Record<HostDoctorCheck['status'], string> = { ok: OK, warn: WARN, fail: FAIL }

/** 按宿主收集体检项（配置 + 适配器提供的宿主专属体检项），供输出与测试共用 */
export async function collectHostDoctorChecks(host: HostId): Promise<HostDoctorCheck[]> {
  const adapter = getAdapter(host)
  const config = await readLyConfig(host)
  const checks: HostDoctorCheck[] = [{
    label: 'config',
    status: config ? 'ok' : 'warn',
    detail: config
      ? `v${config.general?.version || '?'}, lang=${config.general?.language || '?'} (${getHostConfigPath(host)})`
      : i18n.t('doctor:configMissing', { path: getHostConfigPath(host) }),
  }]
  if (adapter.doctorChecks)
    checks.push(...await adapter.doctorChecks({ paths: adapter.defaultPaths(), config: config?.host }))
  return checks
}

export async function doctor(options: HostOpsOptions = {}): Promise<void> {
  const common: HostDoctorCheck[] = []

  // 1. Node version
  const nodeVer = process.version
  const major = Number.parseInt(nodeVer.slice(1))
  common.push({
    label: 'Node.js',
    status: major >= 20 ? 'ok' : 'fail',
    detail: `${nodeVer}${major < 20 ? ' (requires >=20)' : ''}`,
  })

  // 2. OpenSpec dependency（按宿主判定 skills；共享检查器）
  const hosts = await resolveTargetHosts(options.hosts)
  const openspec = await inspectOpenspec({ hosts: hosts.length > 0 ? hosts : undefined })
  common.push({
    label: 'OpenSpec CLI',
    status: openspec.cli.status === 'ok' ? 'ok' : 'warn',
    detail: openspec.cli.status === 'ok'
      ? `v${openspec.cli.version}`
      : openspec.cli.status === 'unhealthy'
        ? i18n.t('common:doctor.openspecCliUnhealthy')
        : i18n.t('common:doctor.openspecCliMissing'),
  })
  for (const host of openspec.hosts) {
    const skills = openspec.skills.byHost[host]
    if (!skills)
      continue
    common.push({
      label: openspec.hosts.length > 1 ? `OpenSpec skills [${host}]` : 'OpenSpec skills',
      status: skills.status === 'project-ready' ? 'ok' : 'warn',
      detail: buildOpenspecSkillsDetail(skills.status, skills.missing),
    })
  }
  common.push({
    label: 'OpenSpec root',
    status: openspec.root.status === 'healthy' ? 'ok' : 'warn',
    detail: buildOpenspecRootDetail(openspec.root.status),
  })

  // 3. 按宿主分组：配置 + 命令产物 + 角色词 / 子代理定义 + 子代理配置
  const groups: Array<{ host: HostId, checks: HostDoctorCheck[] }> = []
  for (const host of hosts)
    groups.push({ host, checks: await collectHostDoctorChecks(host) })

  // Output
  const printCheck = ({ label, status, detail }: HostDoctorCheck) =>
    console.log(`  ${STATUS_ICON[status]} ${ansis.bold(label.padEnd(24))} ${ansis.gray(detail)}`)

  console.log()
  console.log(ansis.cyan.bold(`  ly-workflow-codex Doctor v${packageVersion}`))
  console.log()
  common.forEach(printCheck)
  if (hosts.length === 0) {
    console.log(`  ${WARN} ${ansis.gray(i18n.t('doctor:noHostInstalled'))}`)
  }
  for (const { host, checks } of groups) {
    console.log()
    console.log(ansis.magenta.bold(`  ${i18n.t('doctor:hostGroup', { host })}`))
    checks.forEach(printCheck)
    for (const line of checks.flatMap(c => c.hints ?? []))
      console.log(ansis.gray(`     ${line}`))
  }

  const failures = [...common, ...groups.flatMap(g => g.checks)].filter(c => c.status === 'fail')
  console.log()
  if (failures.length === 0) {
    console.log(ansis.green('  All checks passed.'))
  }
  else {
    console.log(ansis.red(`  ${failures.length} issue(s) found. Run ${ansis.cyan(`npx ${PACKAGE_NAME}`)} to reinstall.`))
  }
  console.log()
}

export async function status(options: HostOpsOptions = {}): Promise<void> {
  const hosts = await resolveTargetHosts(options.hosts)
  const latestVer = execSafe(`npm view ${PACKAGE_NAME} version`) || 'unknown'
  const openspec = await inspectOpenspec({ hosts: hosts.length > 0 ? hosts : undefined })

  console.log()
  console.log(ansis.cyan.bold('  ly-workflow-codex Status'))
  console.log()
  if (hosts.length === 0)
    console.log(`  ${WARN} ${ansis.gray(i18n.t('doctor:noHostInstalled'))}`)

  for (const host of hosts) {
    const adapter = getAdapter(host)
    const config = await readLyConfig(host)
    const installedVer = config?.general?.version || 'unknown'
    const cmds = await listPrefixedDirs(adapter.defaultPaths().skillsDir, 'lyx-')
    const executor = (key: 'reviewExecutor' | 'codingExecutor') => sanitizeExecutor(config?.host?.[key]) ?? 'main'
    console.log(ansis.magenta.bold(`  ${i18n.t('doctor:hostGroup', { host })}`))
    console.log(`  ${ansis.bold('Version')}        ${installedVer}${installedVer !== latestVer ? ansis.yellow(` (latest: ${latestVer})`) : ansis.green(' (up to date)')}`)
    console.log(`  ${ansis.bold('Commands')}       ${cmds.length} (${adapter.commandPrefix}lyx-*)`)
    console.log(`  ${ansis.bold('Config')}         ${getHostConfigPath(host)}`)
    console.log(`  ${ansis.bold('Executors')}      review=${executor('reviewExecutor')}, coding=${executor('codingExecutor')}`)
    console.log()
  }

  console.log(`  ${ansis.bold('OpenSpec CLI')}   ${openspec.cli.status === 'ok' ? `v${openspec.cli.version}` : ansis.yellow(i18n.t(openspec.cli.status === 'unhealthy' ? 'common:doctor.openspecCliUnhealthy' : 'common:doctor.openspecCliMissing'))}`)
  console.log(`  ${ansis.bold('OpenSpec skills')} ${openspec.skills.status === 'project-ready' ? i18n.t('common:doctor.skillsInitialized') : ansis.yellow(buildOpenspecSkillsDetail(openspec.skills.status, openspec.skills.missing))}`)
  console.log(`  ${ansis.bold('OpenSpec root')}   ${openspec.root.status === 'healthy' ? i18n.t('common:doctor.rootHealthy') : ansis.yellow(buildOpenspecRootDetail(openspec.root.status))}`)
  console.log(`  ${ansis.bold('Active tasks')}   ${await countActiveTasks()}`)
  console.log()
}

/** 当前项目 .ly/tasks 下未完成的任务数（历史任务目录，仅展示） */
async function countActiveTasks(): Promise<string> {
  let activeTasks = 0
  const tasksDir = join(process.cwd(), '.ly', 'tasks')
  if (await fs.pathExists(tasksDir)) {
    for (const d of await fs.readdir(tasksDir)) {
      if (d === 'archive')
        continue
      const taskJson = join(tasksDir, d, 'task.json')
      if (await fs.pathExists(taskJson)) {
        try {
          const t = await fs.readJSON(taskJson)
          const s = String(t.status || '').toLowerCase()
          if (!['completed', 'complete', 'done', 'finished', 'archived', 'cancelled', 'closed'].includes(s))
            activeTasks++
        }
        catch { /* ignore */ }
      }
    }
  }
  return activeTasks > 0 ? ansis.yellow(String(activeTasks)) : '0'
}
