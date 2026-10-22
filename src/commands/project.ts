import type { LyConfig, ProjectSection, TestMode } from '../types'
import type { HostId } from '../utils/host-adapters'
import ansis from 'ansis'
import { i18n } from '../i18n'
import { listRegisteredHosts } from '../utils/host-adapters'
import { parseHostList } from '../utils/host-selection'
import { readLyConfigState, sanitizeTestMode, writeLyConfig } from '../utils/config'
import { projectEntriesForPath, resolveProjectKey } from '../utils/project-config'

export interface ProjectTestModeOptions {
  unset?: boolean
  host?: string
}

interface PreparedHost {
  host: HostId
  config: LyConfig
  matches: Array<{ key: string, entry: ProjectSection }>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function reportProjectError(message: string): void {
  console.error(ansis.red(`  ✗ ${message}`))
  process.exitCode = 1
}

function validateProjectTable(config: LyConfig, host: HostId): boolean {
  if (config.projects === undefined)
    return true
  if (isPlainObject(config.projects))
    return true
  reportProjectError(i18n.t('project:invalidProjectsShape', { host }))
  return false
}

function conflictingKeys(input: {
  matches: Array<{ key: string, entry: ProjectSection }>
  canonicalKey: string
  targetMode: TestMode
}): string[] {
  const { matches, canonicalKey, targetMode } = input
  const conflicts: string[] = []
  for (const { key, entry } of matches) {
    if (key === canonicalKey)
      continue
    const rawMode = entry.testMode
    const mode = sanitizeTestMode(rawMode)
    if (!mode) {
      conflicts.push(key)
      continue
    }
    if (mode !== targetMode)
      conflicts.push(key)
  }
  return conflicts
}

export async function runProjectTestMode(mode: string | undefined, options: ProjectTestModeOptions = {}): Promise<boolean> {
  let explicitHosts: HostId[] | undefined
  try {
    explicitHosts = parseHostList(options.host)
  }
  catch (error) {
    reportProjectError(error instanceof Error ? error.message : String(error))
    return false
  }

  if (options.unset && mode !== undefined) {
    reportProjectError(i18n.t('project:unsetWithMode'))
    return false
  }
  const targetMode = sanitizeTestMode(mode)
  if (!options.unset && !targetMode) {
    reportProjectError(mode ? i18n.t('project:invalidMode', { mode }) : i18n.t('project:modeRequired'))
    return false
  }

  const project = await resolveProjectKey()
  const targets = explicitHosts ?? listRegisteredHosts()
  const prepared: PreparedHost[] = []
  const skipped: HostId[] = []
  let hasPreflightError = false

  for (const host of targets) {
    const state = await readLyConfigState(host)
    if (state.status === 'missing') {
      skipped.push(host)
      continue
    }
    if (state.status === 'invalid') {
      reportProjectError(i18n.t('project:invalidConfig', { host, path: state.path, error: state.error }))
      hasPreflightError = true
      continue
    }
    if (!validateProjectTable(state.config, host)) {
      hasPreflightError = true
      continue
    }

    const matches = projectEntriesForPath(state.config, project.path)
    for (const match of matches) {
      if (!isPlainObject(match.entry)) {
        reportProjectError(i18n.t('project:invalidEntry', { host, key: match.key }))
        hasPreflightError = true
      }
    }

    if (!options.unset && targetMode) {
      const conflicts = conflictingKeys({
        matches: matches.filter(match => isPlainObject(match.entry)),
        canonicalKey: project.path,
        targetMode,
      })
      if (conflicts.length > 0) {
        reportProjectError(i18n.t('project:pathConflict', { host, keys: conflicts.join(', ') }))
        hasPreflightError = true
      }
    }

    prepared.push({ host, config: state.config, matches })
  }

  if (hasPreflightError)
    return false

  if (prepared.length === 0) {
    reportProjectError(i18n.t('project:noInstalledTargets', { hosts: targets.join(', ') || 'unknown' }))
    return false
  }

  const written: HostId[] = []
  const noops: HostId[] = []
  for (const item of prepared) {
    const config = structuredClone(item.config)
    const projects = isPlainObject(config.projects)
      ? { ...config.projects } as Record<string, ProjectSection>
      : {}

    if (options.unset) {
      let removed = false
      for (const { key } of item.matches) {
        const entry = projects[key]
        if (!isPlainObject(entry))
          continue
        if (entry.testMode === undefined)
          continue
        const next = { ...entry }
        delete next.testMode
        removed = true
        if (Object.keys(next).length === 0)
          delete projects[key]
        else
          projects[key] = next
      }
      if (!removed) {
        noops.push(item.host)
        continue
      }
    }
    else {
      const existing = projects[project.path]
      projects[project.path] = {
        ...(isPlainObject(existing) ? existing : {}),
        testMode: targetMode,
      }
    }

    config.projects = Object.keys(projects).length > 0 ? projects : undefined
    try {
      await writeLyConfig(config, item.host)
      written.push(item.host)
    }
    catch (error) {
      console.error(ansis.red(`  ✗ ${i18n.t('project:writeFailed', {
        host: item.host,
        error: error instanceof Error ? error.message : String(error),
      })}`))
      if (written.length > 0)
        console.error(ansis.yellow(`  ${i18n.t('project:partialWrite', { hosts: written.join(', ') })}`))
      process.exitCode = 1
      return false
    }
  }

  if (skipped.length > 0)
    console.log(ansis.gray(`  ${i18n.t('project:skippedHosts', { hosts: skipped.join(', ') })}`))
  if (written.length > 0) {
    console.log(ansis.green(`  ✓ ${options.unset
      ? i18n.t('project:unsetSuccess', { hosts: written.join(', '), path: project.path })
      : i18n.t('project:setSuccess', { mode: targetMode, hosts: written.join(', '), path: project.path })}`))
  }
  if (noops.length > 0)
    console.log(ansis.gray(`  ${i18n.t('project:unsetNoop', { hosts: noops.join(', '), path: project.path })}`))
  return written.length > 0 || noops.length > 0
}
