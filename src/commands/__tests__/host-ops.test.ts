import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAgentModelLines } from '../../hosts/claude/adapter'
import { claudeDefinitionDrift, claudeDoctorChecks } from '../../hosts/claude/doctor'
import { codexDoctorChecks } from '../../hosts/codex/doctor'
import { initI18n } from '../../i18n'
import { getAllCommandIds, installWorkflows, uninstallWorkflows } from '../../utils/installer'
import { buildInitArgs, planHostRefresh } from '../update'

const installedState = vi.hoisted(() => ({ hosts: [] as string[] }))
vi.mock('../../utils/config', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/config')>()
  return { ...mod, listInstalledHosts: async () => [...installedState.hosts] }
})

const { describeUninstallTargets, resolveUninstallHosts } = await import('../uninstall')

const base = mkdtempSync(join(tmpdir(), 'ly-host-ops-'))
const codexPaths = { skillsDir: join(base, 'agents-skills'), lyDir: join(base, 'codex-lyx'), promptsDir: join(base, 'codex-lyx', 'prompts') }
const claudePaths = { skillsDir: join(base, 'claude-skills'), agentsDir: join(base, 'claude-agents'), lyDir: join(base, 'claude-lyx'), promptsDir: join(base, 'claude-lyx', 'prompts') }
const hostPaths = { codex: codexPaths, claude: claudePaths }

beforeAll(async () => {
  await initI18n('zh-CN')
})

afterAll(async () => {
  await fs.remove(base)
})

async function installBoth(claudeConfig: Record<string, string> = {}) {
  return installWorkflows(getAllCommandIds(), '', true, {
    hosts: ['codex', 'claude'],
    hostPaths,
    hostConfig: { codex: {}, claude: claudeConfig },
  })
}

describe('multi-host install / uninstall (7.1, 8.2)', () => {
  it('installs both hosts and records results per host', async () => {
    const result = await installBoth()
    expect(result.success, result.errors.join('\n')).toBe(true)
    expect(Object.keys(result.hosts ?? {}).sort()).toEqual(['claude', 'codex'])
    expect(result.hosts!.codex!.installedCommands.length).toBe(14)
    expect(result.hosts!.claude!.installedCommands.length).toBe(14)
  })

  it('uninstalling claude leaves every codex artifact untouched, and OpenSpec artifacts intact', async () => {
    await installBoth()
    await fs.ensureDir(codexPaths.lyDir)
    writeFileSync(join(codexPaths.lyDir, 'config.toml'), 'general = { version = "1.0.0" }\n')
    await fs.ensureDir(claudePaths.lyDir)
    writeFileSync(join(claudePaths.lyDir, 'config.toml'), 'general = { version = "1.0.0" }\n')
    await fs.ensureDir(join(claudePaths.skillsDir, 'openspec-propose'))
    writeFileSync(join(claudePaths.skillsDir, 'openspec-propose', 'SKILL.md'), '# openspec\n')
    const codexBefore = (await fs.readdir(codexPaths.skillsDir)).sort()

    const result = await uninstallWorkflows('', { hosts: ['claude'], hostPaths })
    expect(result.success, result.errors.join('\n')).toBe(true)
    expect(Object.keys(result.hosts ?? {})).toEqual(['claude'])
    expect(await fs.readdir(claudePaths.skillsDir)).toEqual(['openspec-propose'])
    expect(fs.existsSync(claudePaths.lyDir)).toBe(false)
    // codex 侧原样保留
    expect((await fs.readdir(codexPaths.skillsDir)).sort()).toEqual(codexBefore)
    expect(fs.existsSync(join(codexPaths.lyDir, 'config.toml'))).toBe(true)
    expect(fs.existsSync(join(codexPaths.promptsDir, 'codex', 'reviewer.md'))).toBe(true)
  })

  it('uninstall is order-independent and repeatable (already-removed host is skipped without error)', async () => {
    const again = await uninstallWorkflows('', { hosts: ['claude'], hostPaths })
    expect(again.success).toBe(true)
    expect(again.errors).toEqual([])
  })
})

describe('doctor per host (7.2 / 7.3)', () => {
  beforeEach(async () => {
    await installBoth()
  })

  it('codex checks commands + role prompts', async () => {
    const checks = await codexDoctorChecks({ paths: codexPaths, config: {} })
    expect(checks.map(c => c.label)).toEqual(expect.arrayContaining(['Commands', 'Roles']))
    expect(checks.find(c => c.label === 'Commands')!.status).toBe('ok')
    expect(checks.find(c => c.label === 'Roles')!.status).toBe('ok')
  })

  it('claude checks commands + agent definitions; inherit is shown as inherit, not missing', async () => {
    const checks = await claudeDoctorChecks({ paths: claudePaths, config: {} })
    expect(checks.find(c => c.label === 'Commands')!.status).toBe('ok')
    expect(checks.find(c => c.label === 'Agents')!.status).toBe('ok')
    const sub = checks.find(c => c.label.includes('Claude'))!
    expect(sub.status).toBe('ok')
    expect(sub.detail).toContain('model=inherit')
    expect(sub.detail).not.toMatch(/未配置|missing/)
  })

  it('reports drift when the config changes after install (and none when consistent)', async () => {
    expect(await claudeDefinitionDrift({ paths: claudePaths, config: {} })).toEqual([])
    const drift = await claudeDefinitionDrift({ paths: claudePaths, config: { reviewModel: 'sonnet' } })
    expect(drift.sort()).toEqual(['lyx-plan-reviewer.md', 'lyx-reviewer.md'])
    const checks = await claudeDoctorChecks({ paths: claudePaths, config: { reviewModel: 'sonnet' } })
    expect(checks.find(c => c.label.includes('Claude'))!.status).toBe('warn')
  })

  it('reports missing agent definitions as a failure', async () => {
    await fs.remove(claudePaths.agentsDir)
    const checks = await claudeDoctorChecks({ paths: claudePaths, config: {} })
    expect(checks.find(c => c.label === 'Agents')!.status).toBe('fail')
  })
})

describe('update per host (7.5)', () => {
  it('same version and no drift → skip', () => {
    expect(planHostRefresh({ currentVersion: '0.7.0', localVersion: '0.7.0', drift: [] })).toBe('skip')
  })

  it('outdated host → refresh', () => {
    expect(planHostRefresh({ currentVersion: '0.7.0', localVersion: '0.6.1', drift: [] })).toBe('refresh')
  })

  it('same version but definitions drifted → rerender', () => {
    expect(planHostRefresh({ currentVersion: '0.7.0', localVersion: '0.7.0', drift: ['lyx-reviewer.md'] })).toBe('rerender')
  })

  it('re-render with the current config actually rewrites drifted definitions', async () => {
    await installBoth()
    expect(await claudeDefinitionDrift({ paths: claudePaths, config: { reviewModel: 'sonnet' } })).not.toEqual([])
    await installWorkflows(getAllCommandIds(), '', true, { hosts: ['claude'], hostPaths, hostConfig: { claude: { reviewModel: 'sonnet' } } })
    expect(await claudeDefinitionDrift({ paths: claudePaths, config: { reviewModel: 'sonnet' } })).toEqual([])
    expect(readFileSync(join(claudePaths.agentsDir, 'lyx-reviewer.md'), 'utf-8')).toContain('model: sonnet')
  })

  it('passes --host through to the non-interactive reinstall only when hosts are given', () => {
    expect(buildInitArgs()).toBe('init --force --skip-prompt')
    expect(buildInitArgs(['claude'])).toBe('init --force --skip-prompt --host claude')
  })
})

describe('single-host entry for ops commands (7.6)', () => {
  it('explicit host → only that host', async () => {
    installedState.hosts = ['codex', 'claude']
    expect(await resolveUninstallHosts(['claude'])).toEqual(['claude'])
  })

  it('no host given → all installed hosts', async () => {
    installedState.hosts = ['codex', 'claude']
    expect(await resolveUninstallHosts(undefined)).toEqual(['codex', 'claude'])
  })

  it('nothing installed → fallback host (still cleans legacy residue)', async () => {
    installedState.hosts = []
    expect(await resolveUninstallHosts(undefined)).toEqual(['codex'])
  })
})

describe('review-code fixes (add-claude-host W1–W4)', () => {
  it('w1: claude doctor warns when models / efforts are configured but the executor is main', async () => {
    await installBoth({ reviewModel: 'sonnet' })
    const checks = await claudeDoctorChecks({ paths: claudePaths, config: { reviewModel: 'sonnet', codingReasoningEffort: 'high' } })
    const sub = checks.find(c => c.label.includes('Claude'))!
    expect(sub.status).toBe('warn')
    expect(sub.detail).toContain('reviewModel=sonnet')
    expect(sub.detail).toContain('codingReasoningEffort=high')
    // 执行者为 subagent 时不报"不生效"
    const ok = await claudeDoctorChecks({ paths: claudePaths, config: { reviewExecutor: 'subagent', reviewModel: 'sonnet' } })
    expect(ok.find(c => c.label.includes('Claude'))!.status).toBe('ok')
  })

  it('w2: non-string model / effort values never crash rendering, doctor or drift detection', async () => {
    const bad = { reviewModel: 5, reviewReasoningEffort: true, codingModel: { x: 1 } } as any
    expect(renderAgentModelLines(5, true)).toBe('model: inherit')
    await installBoth()
    await expect(claudeDefinitionDrift({ paths: claudePaths, config: bad })).resolves.toEqual([])
    await expect(claudeDoctorChecks({ paths: claudePaths, config: bad })).resolves.toBeDefined()
  })

  it('w4: codex uninstall description lists every removal / modification it performs', () => {
    const lines = describeUninstallTargets(['codex', 'claude']).join('\n')
    for (const needle of ['/lyx-*/', '/ly-*/', 'prompts/ly-*.md', '/prompts/codex/', 'AGENTS.md', 'config.toml', 'agents/ly-*.toml'])
      expect(lines, needle).toContain(needle)
    expect(lines).toContain('[claude]')
    expect(lines).toContain('lyx-*.md')
  })
})

describe('review-code round-2 fixes (add-claude-host)', () => {
  const lockedBase = mkdtempSync(join(tmpdir(), 'ly-locked-'))
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0

  afterAll(async () => {
    await fs.chmod(join(lockedBase, 'skills'), 0o755).catch(() => {})
    await fs.remove(lockedBase)
  })

  it.skipIf(isRoot)('w1: unreadable skills dir → doctor reports a failed host check instead of throwing', async () => {
    const skillsDir = join(lockedBase, 'skills')
    await fs.ensureDir(join(skillsDir, 'lyx-commit'))
    await fs.chmod(skillsDir, 0o000)
    const adapterPaths = { ...codexPaths, skillsDir }
    await expect(codexDoctorChecks({ paths: adapterPaths, config: {} })).rejects.toThrow()
    const { collectHostDoctorChecksWith } = await import('../doctor')
    const checks = await collectHostDoctorChecksWith('codex', adapterPaths, undefined)
    const failed = checks.find(c => c.label === 'host checks')
    expect(failed?.status).toBe('fail')
    expect(failed?.detail).toMatch(/EACCES|permission/i)
    await fs.chmod(skillsDir, 0o755)
  })

  it('w3: menu uninstall scope lists the claude paths when only claude is being removed', () => {
    const lines = describeUninstallTargets(['claude']).join('\n')
    expect(lines).toContain('.claude/skills/lyx-*/')
    expect(lines).toContain('.claude/agents/lyx-*.md')
    expect(lines).not.toContain('.agents/skills')
    expect(lines).not.toContain('.codex/lyx')
  })

  it('info: broken symlinks are skipped for files the same way as for directories', async () => {
    const { listPrefixedFiles } = await import('../../utils/fs-helpers')
    const dir = join(lockedBase, 'links')
    await fs.ensureDir(dir)
    await fs.writeFile(join(dir, 'lyx-a.md'), '#\n')
    await fs.symlink(join(dir, 'missing.md'), join(dir, 'lyx-broken.md'))
    expect((await listPrefixedFiles(dir, 'lyx-', '.md')).map(f => f.split('/').pop())).toEqual(['lyx-a.md'])
  })
})
