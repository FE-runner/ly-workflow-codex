import type { ExecFileOptions } from 'node:child_process'
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import ansis from 'ansis'
import inquirer from 'inquirer'
import { join } from 'pathe'
import { i18n } from '../i18n'
import { AGENTS_SKILLS_DIR } from './package-meta'

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
  status: OpenspecSkillsInspectionStatus
  required: string[]
  resolved: Record<string, string>
  missing: string[]
  roots: OpenspecSkillRoot[]
  profileSource: 'openspec-config' | 'fallback'
}

export interface OpenspecRootInspection {
  status: OpenspecRootInspectionStatus
  doctor?: unknown
  error?: string
}

export type OpenspecAction =
  | { kind: 'install-cli' }
  | { kind: 'warn-global-only' }
  | { kind: 'init-root' }
  | { kind: 'repair-skills', strategy: 'update' | 'init' }
  | { kind: 'report-root', doctor?: unknown }

export interface OpenspecInspection {
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
  explore: 'openspec-explore',
  new: 'openspec-new-change',
  continue: 'openspec-continue-change',
  apply: 'openspec-apply-change',
  update: 'openspec-update-change',
  ff: 'openspec-ff-change',
  sync: 'openspec-sync-specs',
  archive: 'openspec-archive-change',
  'bulk-archive': 'openspec-bulk-archive-change',
  verify: 'openspec-verify-change',
  onboard: 'openspec-onboard',
  propose: 'openspec-propose',
}

/** codex skills 安装目录 — defaults to ~/.agents/skills. */
export function getCodexSkillsDir(): string {
  return AGENTS_SKILLS_DIR
}

export function getOpenspecSkillRoots(cwd = process.cwd()): OpenspecSkillRoot[] {
  return [
    { scope: 'project', path: join(cwd, '.agents', 'skills') },
    { scope: 'project', path: join(cwd, '.codex', 'skills') },
    { scope: 'global', path: AGENTS_SKILLS_DIR },
    { scope: 'global', path: join(homedir(), '.codex', 'skills') },
  ]
}

/**
 * Legacy boolean detector: any known openspec-* skill under the old two roots.
 * New code should use `inspectOpenspec()`.
 */
export function detectOpenspecSkills(): boolean {
  const roots = [
    AGENTS_SKILLS_DIR,
    join(process.cwd(), '.agents', 'skills'),
  ]
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

function inspectOpenspecSkills(
  required: string[],
  cwd: string,
  profileSource: 'openspec-config' | 'fallback',
): OpenspecSkillsInspection {
  const roots = getOpenspecSkillRoots(cwd)
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

  return { status, required, resolved, missing, roots, profileSource }
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

export async function inspectOpenspec(options?: { cwd?: string }): Promise<OpenspecInspection> {
  const cwd = options?.cwd ?? process.cwd()
  const cli = await detectOpenspecCli()
  const cliStatus: OpenspecCliInspectionStatus = !cli.installed
    ? 'missing'
    : cli.version === 'unknown' ? 'unhealthy' : 'ok'

  const profile = cli.installed && cliStatus !== 'unhealthy'
    ? await readOpenspecProfile(cwd)
    : { workflows: DEFAULT_WORKFLOWS, source: 'fallback' as const }
  const required = mapWorkflowsToSkills(profile.workflows)
  const skills = inspectOpenspecSkills(required, cwd, profile.source)
  const root = await inspectOpenspecRoot(cwd, cli)

  const actions: OpenspecAction[] = []
  if (cliStatus === 'missing')
    actions.push({ kind: 'install-cli' })
  if (skills.status === 'global-only')
    actions.push({ kind: 'warn-global-only' })
  if (skills.status === 'missing') {
    if (root.status === 'missing')
      actions.push({ kind: 'init-root' })
    else
      actions.push({ kind: 'repair-skills', strategy: 'update' })
  }
  if (root.status === 'missing' && !actions.some(a => a.kind === 'init-root'))
    actions.push({ kind: 'init-root' })
  if (root.status === 'unhealthy')
    actions.push({ kind: 'report-root', doctor: root.doctor })

  return {
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

  if (inspection.skills.status === 'global-only') {
    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.skillsGlobalOnly')}`))
  }
  else if (inspection.skills.status === 'missing') {
    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.skillsMissing', { list: inspection.skills.missing.join(', ') })}`))
  }
  else if (inspection.skills.status === 'unknown') {
    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.skillsUnknown')}`))
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
  let inspection = await inspectOpenspec({ cwd })

  if (inspection.cli.status === 'missing') {
    const confirmed = options?.yes || (options?.confirmInstall ? await options.confirmInstall() : false)
    if (!confirmed)
      return { inspection, executed }
    if (await installCli()) {
      executed.push('install-cli')
      inspection = await inspectOpenspec({ cwd })
    }
    else {
      return { inspection, executed }
    }
  }

  if (inspection.cli.status !== 'ok')
    return { inspection, executed }

  if (inspection.root.status === 'unhealthy')
    return { inspection, executed }

  if (inspection.root.status === 'missing') {
    const initResult = await execFileText('openspec', ['init', '--tools', 'codex', '--no-animation'], { cwd })
    executed.push('init-root')
    inspection = await inspectOpenspec({ cwd })
    if (!initResult.ok && inspection.root.status === 'missing')
      return { inspection, executed }
  }

  if (inspection.skills.status === 'missing') {
    const updateResult = await execFileText('openspec', ['update', '--force'], { cwd })
    executed.push('repair-skills:update')
    inspection = await inspectOpenspec({ cwd })

    if (inspection.skills.status === 'missing') {
      const initResult = await execFileText('openspec', ['init', '--tools', 'codex', '--no-animation'], { cwd })
      executed.push('repair-skills:init')
      inspection = await inspectOpenspec({ cwd })
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
export async function checkExternalDeps(options?: { skipPrompt?: boolean; initOpenspec?: boolean }): Promise<void> {
  try {
    if (options?.initOpenspec) {
      const result = await ensureOpenspec({
        yes: options.skipPrompt,
        confirmInstall: () => confirmOpenspecCliInstall(options.skipPrompt),
      })
      printOpenspecInspection(result.inspection)
      return
    }

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
