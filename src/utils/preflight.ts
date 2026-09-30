import type { ExecFileOptions } from 'node:child_process'
import type { HostId } from './host-adapters'
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import ansis from 'ansis'
import inquirer from 'inquirer'
import { join } from 'pathe'
import { i18n } from '../i18n'
import { listInstalledHosts } from './config'
import { getAdapter, listRegisteredHosts } from './host-adapters'

/**
 * OpenSpec dependency inspection and repair.
 *
 * The lifecycle commands depend on three layers:
 * 1. the global `openspec` CLI;
 * 2. OpenSpec skills for the active workflow profile;
 * 3. a healthy OpenSpec root.
 *
 * `openspec doctor --json` can only cover layer 3. It requires the CLI and
 * does not inspect Codex skill directories.
 */

export interface OpenspecCliStatus {
  installed: boolean
  version?: string
}

export type OpenspecCliInspectionStatus = 'ok' | 'missing' | 'unhealthy'
export type OpenspecSkillsInspectionStatus = 'project-ready' | 'global-only' | 'missing' | 'unknown'
export type OpenspecRootInspectionStatus = 'healthy' | 'missing' | 'unhealthy' | 'not-checked'

export interface OpenspecSkillRoot {
  scope: 'project' | 'global'
  path: string
}

export interface OpenspecSkillsInspection {
  /** 整体状态：多宿主时取各宿主最差者（missing > unknown > global-only > project-ready） */
  status: OpenspecSkillsInspectionStatus
  required: string[]
  resolved: Record<string, string>
  /** 整体缺失清单（任一宿主缺失的 skill 并集） */
  missing: string[]
  roots: OpenspecSkillRoot[]
  profileSource: 'openspec-config' | 'fallback'
  /** 按宿主分别判定（自 add-claude-host 起） */
  byHost: Partial<Record<HostId, OpenspecHostSkillsInspection>>
}

export interface OpenspecHostSkillsInspection {
  status: OpenspecSkillsInspectionStatus
  resolved: Record<string, string>
  missing: string[]
  roots: OpenspecSkillRoot[]
}

export interface OpenspecRootInspection {
  status: OpenspecRootInspectionStatus
  doctor?: unknown
  error?: string
}

export type OpenspecAction
  = | { kind: 'install-cli' }
    | { kind: 'warn-global-only' }
    | { kind: 'init-root', hosts: HostId[] }
    | { kind: 'repair-skills', strategy: 'update' | 'init', hosts: HostId[] }
    | { kind: 'report-root', doctor?: unknown }

export interface OpenspecInspection {
  /** 本次检查所覆盖的宿主集合 */
  hosts: HostId[]
  cli: {
    status: OpenspecCliInspectionStatus
    version?: string
  }
  skills: OpenspecSkillsInspection
  root: OpenspecRootInspection
  actions: OpenspecAction[]
}

export interface OpenspecEnsureResult {
  inspection: OpenspecInspection
  executed: string[]
}

interface OpenspecEnsureOptions {
  cwd?: string
  yes?: boolean
  confirmInstall?: () => Promise<boolean>
  /** 目标宿主（写入型修复的范围）；缺省为已安装宿主集合 */
  hosts?: HostId[]
  /**
   * 是否允许写入型修复（init root / 补齐项目级 skills）。缺省：hosts 显式给出或存在已安装宿主时允许；
   * 不存在任何宿主配置文件且未显式指定宿主时只做只读诊断（写入延后到宿主选择确认之后）。
   */
  allowWrite?: boolean
}

interface ExecResult {
  ok: boolean
  stdout: string
  stderr: string
  error?: unknown
}

/** Commands that directly require the openspec CLI / openspec skills. */
const DEPENDENT_COMMANDS = ['@lyx-init', '@lyx-explore', '@lyx-propose', '@lyx-review-plan', '@lyx-archive']

const INSTALL_CMD = ['npm', 'install', '-g', '@fission-ai/openspec@latest']

/** Windows needs shell:true to resolve npm-generated .cmd shims. */
const SHELL_OPT = process.platform === 'win32' ? { shell: true } : {}

/** Legacy any-skill detector names; retained for compatibility with older callers/tests. */
const LEGACY_OPENSPEC_SKILL_NAMES = [
  'openspec-explore',
  'openspec-propose',
  'openspec-apply-change',
  'openspec-archive-change',
]

const DEFAULT_WORKFLOWS = ['propose', 'explore', 'apply', 'update', 'sync', 'archive']

const WORKFLOW_TO_SKILL: Record<string, string> = {
  'explore': 'openspec-explore',
  'new': 'openspec-new-change',
  'continue': 'openspec-continue-change',
  'apply': 'openspec-apply-change',
  'update': 'openspec-update-change',
  'ff': 'openspec-ff-change',
  'sync': 'openspec-sync-specs',
  'archive': 'openspec-archive-change',
  'bulk-archive': 'openspec-bulk-archive-change',
  'verify': 'openspec-verify-change',
  'onboard': 'openspec-onboard',
  'propose': 'openspec-propose',
}

/**
 * OpenSpec 技能扫描根：由各宿主适配器提供，项目级在前、全局级在后（项目级命中优先）。
 * hosts 缺省为全部已注册宿主。
 */
export function getOpenspecSkillRoots(cwd = process.cwd(), hosts: HostId[] = listRegisteredHosts()): OpenspecSkillRoot[] {
  const roots = hosts.flatMap(id => getAdapter(id).openspecSkillRoots(cwd))
  return [...roots.filter(r => r.scope === 'project'), ...roots.filter(r => r.scope === 'global')]
}

/**
 * Legacy boolean detector: any known openspec-* skill under the registered hosts' roots.
 * New code should use `inspectOpenspec()`.
 */
export function detectOpenspecSkills(): boolean {
  const roots = getOpenspecSkillRoots().map(r => r.path)
  return LEGACY_OPENSPEC_SKILL_NAMES.some(name =>
    roots.some(root => existsSync(join(root, name, 'SKILL.md'))),
  )
}

/** Detect the global openspec CLI via `openspec --version`. */
export function detectOpenspecCli(): Promise<OpenspecCliStatus> {
  return new Promise((resolve) => {
    execFile('openspec', ['--version'], { timeout: 5000, ...SHELL_OPT }, (err, stdout) => {
      if (err) {
        // Installed but unhealthy (e.g. hung execution) — do not trigger a reinstall.
        if (('killed' in err && err.killed) || (err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
          resolve({ installed: true, version: 'unknown' })
          return
        }
        resolve({ installed: false })
        return
      }
      resolve({ installed: true, version: stdout.toString().trim() || 'unknown' })
    })
  })
}

function execFileText(cmd: string, args: string[], options: ExecFileOptions = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000, ...SHELL_OPT, ...options }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: stdout?.toString() ?? '',
        stderr: stderr?.toString() ?? '',
        error: err,
      })
    })
  })
}

function resolveWorkflowDependencies(workflows: string[]): string[] {
  const resolved = [...workflows]
  if ((resolved.includes('archive') || resolved.includes('bulk-archive')) && !resolved.includes('sync'))
    resolved.splice(Math.max(resolved.findIndex(w => w === 'archive' || w === 'bulk-archive'), 0), 0, 'sync')
  return resolved
}

async function readOpenspecProfile(cwd: string): Promise<{ workflows: string[], source: 'openspec-config' | 'fallback' }> {
  const result = await execFileText('openspec', ['config', 'list', '--json'], { cwd })
  if (!result.ok)
    return { workflows: DEFAULT_WORKFLOWS, source: 'fallback' }

  try {
    const parsed = JSON.parse(result.stdout) as { workflows?: unknown }
    if (!Array.isArray(parsed.workflows) || parsed.workflows.length === 0)
      return { workflows: DEFAULT_WORKFLOWS, source: 'fallback' }
    const workflows = parsed.workflows.filter((w): w is string => typeof w === 'string' && w.length > 0)
    return { workflows: resolveWorkflowDependencies(workflows), source: 'openspec-config' }
  }
  catch {
    return { workflows: DEFAULT_WORKFLOWS, source: 'fallback' }
  }
}

function mapWorkflowsToSkills(workflows: string[]): string[] {
  return [...new Set(workflows.map(w => WORKFLOW_TO_SKILL[w]).filter((s): s is string => Boolean(s)))]
}

const SKILLS_STATUS_RANK: Record<OpenspecSkillsInspectionStatus, number> = {
  'project-ready': 0,
  'global-only': 1,
  'unknown': 2,
  'missing': 3,
}

function inspectHostSkills(
  required: string[],
  roots: OpenspecSkillRoot[],
  profileSource: 'openspec-config' | 'fallback',
): OpenspecHostSkillsInspection {
  const resolved: Record<string, string> = {}
  const projectHits = new Set<string>()
  const missing: string[] = []

  for (const skill of required) {
    for (const root of roots) {
      const skillFile = join(root.path, skill, 'SKILL.md')
      if (existsSync(skillFile)) {
        resolved[skill] = skillFile
        if (root.scope === 'project')
          projectHits.add(skill)
        break
      }
    }
    if (!resolved[skill])
      missing.push(skill)
  }

  let status: OpenspecSkillsInspectionStatus
  if (missing.length > 0)
    status = 'missing'
  else if (profileSource === 'fallback')
    status = 'unknown'
  else if (projectHits.size !== required.length)
    status = 'global-only'
  else
    status = 'project-ready'

  return { status, resolved, missing, roots }
}

/**
 * skills 层检查：每个宿主只在该宿主自己的技能根里判定（单宿主缺另一宿主的技能根不算 missing），
 * 整体状态取各宿主最差者。
 */
function inspectOpenspecSkills(
  required: string[],
  cwd: string,
  profileSource: 'openspec-config' | 'fallback',
  hosts: HostId[],
): OpenspecSkillsInspection {
  const byHost: Partial<Record<HostId, OpenspecHostSkillsInspection>> = {}
  for (const host of hosts)
    byHost[host] = inspectHostSkills(required, getOpenspecSkillRoots(cwd, [host]), profileSource)

  const perHost = hosts.map(h => byHost[h]!)
  const status = perHost.reduce<OpenspecSkillsInspectionStatus>(
    (worst, cur) => SKILLS_STATUS_RANK[cur.status] > SKILLS_STATUS_RANK[worst] ? cur.status : worst,
    'project-ready',
  )
  const missing = [...new Set(perHost.flatMap(h => h.missing))]
  const resolved = Object.assign({}, ...[...perHost].reverse().map(h => h.resolved)) as Record<string, string>

  return { status, required, resolved, missing, roots: getOpenspecSkillRoots(cwd, hosts), profileSource, byHost }
}

/** 某状态的宿主清单（按检查顺序） */
function hostsWithStatus(skills: OpenspecSkillsInspection, status: OpenspecSkillsInspectionStatus): HostId[] {
  return (Object.keys(skills.byHost) as HostId[]).filter(h => skills.byHost[h]?.status === status)
}

/**
 * 读取型检查的宿主集合：已安装宿主（配置文件存在）；一个都没有时取全部已注册宿主
 * （全新环境首次 init 前也要按全部宿主的技能根扫描，SHALL NOT 因集合为空跳过检查）。
 */
export async function resolveInspectHosts(explicit?: HostId[]): Promise<HostId[]> {
  if (explicit && explicit.length > 0)
    return explicit
  const installed = await listInstalledHosts()
  return installed.length > 0 ? installed : listRegisteredHosts()
}

async function inspectOpenspecRoot(cwd: string, cli: OpenspecCliStatus): Promise<OpenspecRootInspection> {
  if (!cli.installed)
    return { status: 'not-checked' }

  const result = await execFileText('openspec', ['doctor', '--json'], { cwd })
  let doctor: unknown
  try {
    doctor = result.stdout ? JSON.parse(result.stdout) : undefined
  }
  catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : String(error) }
  }

  const statuses = (doctor as { status?: Array<{ code?: string }> } | undefined)?.status ?? []
  if (!result.ok) {
    if (statuses.some(s => s.code === 'no_openspec_root'))
      return { status: 'missing', doctor }
    return {
      status: 'unhealthy',
      doctor,
      error: result.stderr || 'openspec doctor --json failed',
    }
  }

  const rootHealthy = (doctor as { root?: { healthy?: boolean } } | undefined)?.root?.healthy
  return rootHealthy === true
    ? { status: 'healthy', doctor }
    : { status: 'unhealthy', doctor }
}

export async function inspectOpenspec(options?: { cwd?: string, hosts?: HostId[] }): Promise<OpenspecInspection> {
  const cwd = options?.cwd ?? process.cwd()
  const hosts = await resolveInspectHosts(options?.hosts)
  const cli = await detectOpenspecCli()
  const cliStatus: OpenspecCliInspectionStatus = !cli.installed
    ? 'missing'
    : cli.version === 'unknown' ? 'unhealthy' : 'ok'

  const profile = cli.installed && cliStatus !== 'unhealthy'
    ? await readOpenspecProfile(cwd)
    : { workflows: DEFAULT_WORKFLOWS, source: 'fallback' as const }
  const required = mapWorkflowsToSkills(profile.workflows)
  const skills = inspectOpenspecSkills(required, cwd, profile.source, hosts)
  const root = await inspectOpenspecRoot(cwd, cli)

  const actions: OpenspecAction[] = []
  if (cliStatus === 'missing')
    actions.push({ kind: 'install-cli' })
  if (skills.status === 'global-only')
    actions.push({ kind: 'warn-global-only' })
  if (skills.status === 'missing') {
    if (root.status === 'missing')
      actions.push({ kind: 'init-root', hosts })
    else
      actions.push({ kind: 'repair-skills', strategy: 'init', hosts: hostsWithStatus(skills, 'missing') })
  }
  if (root.status === 'missing' && !actions.some(a => a.kind === 'init-root'))
    actions.push({ kind: 'init-root', hosts })
  if (root.status === 'unhealthy')
    actions.push({ kind: 'report-root', doctor: root.doctor })

  return {
    hosts,
    cli: { status: cliStatus, version: cli.version },
    skills,
    root,
    actions,
  }
}

function isNonInteractive(skipPrompt?: boolean): boolean {
  return Boolean(skipPrompt || process.env.CI || !process.stdin.isTTY || !process.stdout.isTTY)
}

function printUnavailable(): void {
  console.log(ansis.yellow(`  ${i18n.t('common:preflight.unavailableList', { list: DEPENDENT_COMMANDS.join(' ') })}`))
  console.log(ansis.gray(`  ${i18n.t('common:preflight.unaffectedNote')}`))
}

async function runNpmInstall(): Promise<boolean> {
  return new Promise((resolve) => {
    const [cmd, ...args] = INSTALL_CMD
    const child = spawn(cmd, args, { stdio: 'inherit', ...SHELL_OPT })
    child.on('error', () => resolve(false))
    child.on('close', code => resolve(code === 0))
  })
}

export async function confirmOpenspecCliInstall(skipPrompt?: boolean): Promise<boolean> {
  if (isNonInteractive(skipPrompt)) {
    printUnavailable()
    return false
  }

  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: i18n.t('common:preflight.installAsk'),
    default: true,
  }])

  if (!confirmed) {
    printUnavailable()
    return false
  }
  return true
}

async function installCli(): Promise<boolean> {
  const ok = await runNpmInstall()
  if (!ok) {
    console.error(ansis.red(`✗ ${i18n.t('common:preflight.installFailed')}`))
    printUnavailable()
    return false
  }
  const recheck = await detectOpenspecCli()
  if (!recheck.installed) {
    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.installNotInPath')}`))
    return false
  }
  return true
}

export function printOpenspecInspection(inspection: OpenspecInspection): void {
  if (inspection.cli.status === 'missing') {
    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.cliMissing')}`))
    printUnavailable()
    return
  }
  if (inspection.cli.status === 'unhealthy') {
    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.cliUnhealthy')}`))
  }

  // 多宿主时按宿主分行输出（单宿主时行为与改造前一致，不加宿主前缀）
  const multiHost = inspection.hosts.length > 1
  for (const host of inspection.hosts) {
    const hostSkills = inspection.skills.byHost[host]
    if (!hostSkills)
      continue
    const tag = multiHost ? `[${host}] ` : ''
    if (hostSkills.status === 'global-only') {
      console.log(ansis.yellow(`⚠ ${tag}${i18n.t('common:preflight.skillsGlobalOnly')}`))
    }
    else if (hostSkills.status === 'missing') {
      console.log(ansis.yellow(`⚠ ${tag}${i18n.t('common:preflight.skillsMissing', { list: hostSkills.missing.join(', ') })}`))
      console.log(ansis.gray(`  ${i18n.t('common:preflight.repairHint', { cmd: `openspec init --tools ${getAdapter(host).openspecTool}` })}`))
    }
    else if (hostSkills.status === 'unknown') {
      console.log(ansis.yellow(`⚠ ${tag}${i18n.t('common:preflight.skillsUnknown')}`))
    }
  }

  if (inspection.root.status === 'missing') {
    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.rootMissing')}`))
  }
  else if (inspection.root.status === 'unhealthy') {
    console.error(ansis.red(`✗ ${i18n.t('common:preflight.rootUnhealthy')}`))
  }
}

export async function ensureOpenspec(options?: OpenspecEnsureOptions): Promise<OpenspecEnsureResult> {
  const cwd = options?.cwd ?? process.cwd()
  const executed: string[] = []
  const installed = await listInstalledHosts()
  // 写入目标 = 显式指定的宿主，或已安装（已确认）宿主；SHALL NOT 为未确认的宿主写入项目级产物
  const targets = options?.hosts && options.hosts.length > 0 ? options.hosts : installed
  const allowWrite = options?.allowWrite ?? targets.length > 0
  const inspect = () => inspectOpenspec({ cwd, hosts: targets.length > 0 ? targets : undefined })
  let inspection = await inspect()

  if (inspection.cli.status === 'missing') {
    const confirmed = options?.yes || (options?.confirmInstall ? await options.confirmInstall() : false)
    if (!confirmed)
      return { inspection, executed }
    if (await installCli()) {
      executed.push('install-cli')
      inspection = await inspect()
    }
    else {
      return { inspection, executed }
    }
  }

  if (inspection.cli.status !== 'ok')
    return { inspection, executed }

  if (inspection.root.status === 'unhealthy')
    return { inspection, executed }

  // 全新环境（无任何宿主配置文件）且未显式指定宿主：只读诊断，写入型修复延后到宿主选择确认之后
  if (!allowWrite || targets.length === 0)
    return { inspection, executed }

  const toolsOf = (hosts: HostId[]) => hosts.map(h => getAdapter(h).openspecTool).join(',')

  if (inspection.root.status === 'missing') {
    const tools = toolsOf(targets)
    const initResult = await execFileText('openspec', ['init', '--tools', tools, '--no-animation'], { cwd })
    executed.push(`init-root:openspec init --tools ${tools}`)
    inspection = await inspect()
    if (!initResult.ok && inspection.root.status === 'missing')
      return { inspection, executed }
  }

  // 只对确实缺少技能的宿主补齐；global-only 不触发项目级修复；不重建另一宿主的产物
  const missingHosts = hostsWithStatus(inspection.skills, 'missing')
  if (missingHosts.length > 0) {
    const tools = toolsOf(missingHosts)
    const initResult = await execFileText('openspec', ['init', '--tools', tools, '--no-animation'], { cwd })
    executed.push(`repair-skills:init:openspec init --tools ${tools}`)
    inspection = await inspect()

    if (inspection.skills.status === 'missing') {
      const updateResult = await execFileText('openspec', ['update', '--force'], { cwd })
      executed.push('repair-skills:update:openspec update --force')
      inspection = await inspect()
      if (!updateResult.ok && !initResult.ok && inspection.skills.status === 'missing')
        return { inspection, executed }
    }
  }

  return { inspection, executed }
}

/**
 * Orchestrated preflight entry for installer flows (default action / init / menu).
 * Never throws — installer main flow must proceed regardless of check outcomes.
 */
export async function checkExternalDeps(options?: { skipPrompt?: boolean, initOpenspec?: boolean }): Promise<void> {
  try {
    // --init-openspec 的写入型修复不在此处执行：前置检查发生在宿主选择之前，
    // 写入延后到 init 确认宿主（配置文件已产生）之后按所选宿主集合执行。
    let inspection = await inspectOpenspec()
    if (inspection.cli.status === 'missing') {
      if (!await confirmOpenspecCliInstall(options?.skipPrompt))
        return
      if (!await installCli())
        return
      inspection = await inspectOpenspec()
    }
    printOpenspecInspection(inspection)
  }
  catch {
    // Never break the installer flow because of preflight failures.
  }
}
