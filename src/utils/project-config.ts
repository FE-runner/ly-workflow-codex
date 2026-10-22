import type { LyConfig, ProjectSection, TestMode } from '../types'
import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import fs from 'node:fs'
import { resolve } from 'pathe'
import { readLyConfigState, sanitizeTestMode } from './config'
import type { HostConfigLocation, HostConfigReadResult } from './config'
import type { HostId } from './host-adapters'

export type ProjectPathSource = 'git-root' | 'submodule-root' | 'worktree-main-root' | 'worktree-root-bare' | 'worktree-root-unresolved' | 'cwd'
export type TestModeSource = 'project' | 'host' | 'default'
export type ProjectConfigWarningCode
  = | 'projects-invalid-shape'
    | 'project-entry-invalid-shape'
    | 'project-test-mode-missing'
    | 'project-test-mode-invalid'
    | 'project-path-conflict'

export interface ProjectConfigWarning {
  code: ProjectConfigWarningCode
  keys?: string[]
  key?: string
}

export interface ProjectKeyResolution {
  path: string
  source: ProjectPathSource
}

export interface ProjectTestModeResolution {
  mode: TestMode
  source: TestModeSource
  projectPath: string
  projectPathSource: ProjectPathSource
  matchedProjectKeys: string[]
  hostTestMode: TestMode
  hostTestModeInvalid: boolean
  warnings: ProjectConfigWarning[]
}

export type EffectiveProjectTestMode
  = | { status: 'ok', config: LyConfig, project: ProjectKeyResolution, effective: ProjectTestModeResolution }
    | Extract<HostConfigReadResult, { status: 'missing' | 'invalid' }>

interface ExecTextResult {
  ok: boolean
  stdout: string
}

function execText(file: string, args: string[], cwd: string): Promise<ExecTextResult> {
  return new Promise((resolveResult) => {
    execFile(file, args, { cwd, timeout: 5000 }, (error, stdout) => {
      resolveResult({ ok: !error, stdout: stdout?.toString().trim() ?? '' })
    })
  })
}

function canonicalize(path: string): string {
  try {
    return fs.realpathSync.native(path)
  }
  catch {
    return resolve(path)
  }
}

function absoluteFrom(cwd: string, value: string): string {
  return canonicalize(resolve(cwd, value))
}

export function normalizeProjectPath(value: string, cwd = process.cwd()): string {
  return canonicalize(resolve(cwd, value))
}

export async function resolveProjectKey(cwd = process.cwd()): Promise<ProjectKeyResolution> {
  const fallback = canonicalize(resolve(cwd))
  const top = await execText('git', ['rev-parse', '--show-toplevel'], cwd)
  if (!top.ok || !top.stdout)
    return { path: fallback, source: 'cwd' }

  const topPath = absoluteFrom(cwd, top.stdout)
  const superproject = await execText('git', ['rev-parse', '--show-superproject-working-tree'], cwd)
  if (superproject.ok && superproject.stdout)
    return { path: topPath, source: 'submodule-root' }

  const gitDir = await execText('git', ['rev-parse', '--git-dir'], cwd)
  const commonDir = await execText('git', ['rev-parse', '--git-common-dir'], cwd)
  if (!gitDir.ok || !commonDir.ok || !gitDir.stdout || !commonDir.stdout)
    return { path: topPath, source: 'git-root' }

  const gitDirPath = absoluteFrom(cwd, gitDir.stdout)
  const commonDirPath = absoluteFrom(cwd, commonDir.stdout)
  if (gitDirPath === commonDirPath)
    return { path: topPath, source: 'git-root' }

  const bare = await execText('git', [`--git-dir=${commonDirPath}`, 'rev-parse', '--is-bare-repository'], cwd)
  if (bare.ok && bare.stdout === 'true')
    return { path: topPath, source: 'worktree-root-bare' }

  const coreWorktree = await execText('git', [`--git-dir=${commonDirPath}`, 'config', '--get', 'core.worktree'], cwd)
  if (coreWorktree.ok && coreWorktree.stdout)
    return { path: canonicalize(resolve(commonDirPath, coreWorktree.stdout)), source: 'worktree-main-root' }

  const commonParent = dirname(commonDirPath)
  const dotGit = join(commonParent, '.git')
  if (fs.existsSync(dotGit)) {
    const candidate = await execText('git', ['-C', commonParent, `--git-dir=${dotGit}`, 'rev-parse', '--git-dir'], cwd)
    if (candidate.ok && candidate.stdout) {
      const candidateGitDir = absoluteFrom(commonParent, candidate.stdout)
      if (candidateGitDir === commonDirPath)
        return { path: canonicalize(commonParent), source: 'worktree-main-root' }
    }
  }

  return { path: topPath, source: 'worktree-root-unresolved' }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function projectEntriesForPath(
  config: LyConfig,
  projectPath: string,
  cwd = process.cwd(),
): Array<{ key: string, entry: ProjectSection }> {
  const projects = config.projects
  if (!isPlainObject(projects))
    return []
  return Object.entries(projects)
    .filter(([key]) => normalizeProjectPath(key, cwd) === projectPath)
    .map(([key, entry]) => ({ key, entry }))
}

export function resolveProjectTestMode(input: {
  config: LyConfig
  project: ProjectKeyResolution
  cwd?: string
}): ProjectTestModeResolution {
  const { config, project, cwd = process.cwd() } = input
  const hostRaw = config.host?.testMode
  const hostTestMode = sanitizeTestMode(hostRaw) ?? 'normal'
  const hostTestModeInvalid = typeof hostRaw === 'string' && hostRaw.trim() !== '' && !sanitizeTestMode(hostRaw)
  const warnings: ProjectConfigWarning[] = []
  const fallback = (): ProjectTestModeResolution => ({
    mode: hostTestMode,
    source: hostTestModeInvalid ? 'host' : config.host?.testMode ? 'host' : 'default',
    projectPath: project.path,
    projectPathSource: project.source,
    matchedProjectKeys: [],
    hostTestMode,
    hostTestModeInvalid,
    warnings,
  })

  const projects = config.projects
  if (projects === undefined)
    return fallback()
  if (!isPlainObject(projects)) {
    warnings.push({ code: 'projects-invalid-shape' })
    return fallback()
  }

  const matchedKeys: string[] = []
  const projectModes: TestMode[] = []
  let matchingInvalid = false

  for (const [key, rawEntry] of Object.entries(projects)) {
    if (normalizeProjectPath(key, cwd) !== project.path)
      continue
    matchedKeys.push(key)
    if (!isPlainObject(rawEntry)) {
      warnings.push({ code: 'project-entry-invalid-shape', key })
      matchingInvalid = true
      continue
    }
    const rawMode = rawEntry.testMode
    if (rawMode === undefined || (typeof rawMode === 'string' && rawMode.trim() === '')) {
      warnings.push({ code: 'project-test-mode-missing', key })
      matchingInvalid = true
      continue
    }
    const mode = sanitizeTestMode(rawMode)
    if (!mode) {
      warnings.push({ code: 'project-test-mode-invalid', key })
      matchingInvalid = true
      continue
    }
    projectModes.push(mode)
  }

  if (matchedKeys.length === 0)
    return fallback()

  const uniqueModes = [...new Set(projectModes)]
  if (uniqueModes.length > 1) {
    warnings.push({ code: 'project-path-conflict', keys: [...matchedKeys] })
    matchingInvalid = true
  }

  if (matchingInvalid || uniqueModes.length === 0 || projectModes.length !== matchedKeys.length) {
    const result = fallback()
    result.matchedProjectKeys = matchedKeys
    return result
  }

  return {
    mode: uniqueModes[0],
    source: 'project',
    projectPath: project.path,
    projectPathSource: project.source,
    matchedProjectKeys: matchedKeys,
    hostTestMode,
    hostTestModeInvalid,
    warnings,
  }
}

export async function readEffectiveProjectTestMode(
  host: HostId,
  options: { cwd?: string, location?: HostConfigLocation } = {},
): Promise<EffectiveProjectTestMode> {
  const cwd = options.cwd ?? process.cwd()
  const config = await readLyConfigState(host, options.location)
  if (config.status !== 'ok')
    return config
  const project = await resolveProjectKey(cwd)
  return {
    status: 'ok',
    config: config.config,
    project,
    effective: resolveProjectTestMode({ config: config.config, project, cwd }),
  }
}
