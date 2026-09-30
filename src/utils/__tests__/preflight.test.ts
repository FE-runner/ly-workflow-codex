import { homedir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initI18n } from '../../i18n'

import { checkExternalDeps, detectOpenspecCli, detectOpenspecSkills, ensureOpenspec, inspectOpenspec, printOpenspecInspection } from '../preflight'

const execFileMock = vi.fn()
const spawnMock = vi.fn()
const existsSyncMock = vi.fn()
const promptMock = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => execFileMock(...args),
  spawn: (...args: any[]) => spawnMock(...args),
}))

vi.mock('node:fs', () => ({
  existsSync: (...args: any[]) => existsSyncMock(...args),
}))

/** 已安装宿主（配置文件存在）——mock 掉真实 home 探测，保证用例与本机环境无关 */
const installedHostsState: { hosts: string[] } = { hosts: ['codex'] }
vi.mock('../config', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../config')>()
  return { ...mod, listInstalledHosts: async () => [...installedHostsState.hosts] }
})

vi.mock('inquirer', () => ({
  default: { prompt: (...args: any[]) => promptMock(...args) },
}))

/** Mutable CLI presence read by the execFile mock — install success can flip it. */
const cliState = { installed: true }

function mockExec() {
  execFileMock.mockImplementation((cmd: string, args: any[], _opts: any, cb: (err: any, out: string) => void) => {
    if (cmd !== 'openspec') {
      cb(null, '')
      return
    }
    if (args[0] === 'config' && args[1] === 'list') {
      cb(null, JSON.stringify({ workflows: ['propose', 'explore', 'apply', 'archive'] }))
      return
    }
    if (args[0] === 'doctor') {
      cb(null, JSON.stringify({ root: { healthy: true }, status: [] }))
      return
    }
    if (!cliState.installed) {
      cb(new Error('not found'), '')
      return
    }
    cb(null, '1.7.0\n')
  })
}

/** Simulate npm install outcome; onSpawn runs before the close/error event. */
function npmInstallResult(exitCode: number | 'spawn-error', onSpawn?: () => void) {
  spawnMock.mockImplementation(() => {
    const listeners: Record<string, any[]> = {}
    const on = (event: string, cb: any) => {
      (listeners[event] ||= []).push(cb)
      return undefined
    }
    const emit = (event: string, arg?: any) => (listeners[event] || []).forEach(cb => cb(arg))
    queueMicrotask(() => {
      onSpawn?.()
      if (exitCode === 'spawn-error')
        emit('error', new Error('spawn ENOENT'))
      else emit('close', exitCode)
    })
    return { on } as any
  })
}

/** Force isTTY value on stdin/stdout; restores (or deletes) original state. */
async function withTTY(value: boolean, fn: () => Promise<void>) {
  const stdin = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
  const stdout = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value })
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value })
  try {
    await fn()
  }
  finally {
    for (const [target, desc] of [[process.stdin, stdin], [process.stdout, stdout]] as const) {
      if (desc)
        Object.defineProperty(target, 'isTTY', desc)
      else delete (target as any).isTTY
    }
  }
}

describe('detectOpenspecCli', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns installed with trimmed version on success', async () => {
    mockExec()
    cliState.installed = true
    expect(await detectOpenspecCli()).toEqual({ installed: true, version: '1.7.0' })
  })

  it('returns not installed on exec error', async () => {
    mockExec()
    cliState.installed = false
    expect(await detectOpenspecCli()).toEqual({ installed: false })
  })

  it('treats timeout (killed) as installed-but-unhealthy, not missing', async () => {
    execFileMock.mockImplementation((_cmd: string, _a: any, _o: any, cb: any) => {
      cb(Object.assign(new Error('spawn timeout'), { killed: true }), '')
    })
    expect(await detectOpenspecCli()).toEqual({ installed: true, version: 'unknown' })
  })
})

describe('detectOpenspecSkills (codex host skills)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns true when any openspec-* SKILL.md exists under ~/.agents/skills or project .agents/skills', () => {
    existsSyncMock.mockImplementation((p: any) => String(p).includes('openspec-propose') && String(p).endsWith('/SKILL.md'))
    expect(detectOpenspecSkills()).toBe(true)
  })

  it('returns false when no openspec skill exists', () => {
    existsSyncMock.mockImplementation((p: any) => !String(p).includes('openspec'))
    expect(detectOpenspecSkills()).toBe(false)
  })
})

describe('inspectOpenspec', () => {
  beforeEach(() => {
    cliState.installed = true
    mockExec()
  })

  afterEach(() => vi.restoreAllMocks())

  it('reports project-ready when all required skills are in the project roots', async () => {
    existsSyncMock.mockReturnValue(true)
    const result = await inspectOpenspec()
    expect(result.cli.status).toBe('ok')
    expect(result.skills.status).toBe('project-ready')
    expect(result.root.status).toBe('healthy')
  })

  it('reports global-only WARN when all required skills are only in global roots', async () => {
    const globalRoot = join(homedir(), '.agents', 'skills')
    existsSyncMock.mockImplementation((p: any) => String(p).startsWith(globalRoot))
    const result = await inspectOpenspec()
    expect(result.skills.status).toBe('global-only')
    expect(result.actions).toContainEqual({ kind: 'warn-global-only' })
  })

  it('treats mixed project/global skill sources as global-only', async () => {
    const globalRoot = join(homedir(), '.agents', 'skills')
    existsSyncMock.mockImplementation((p: any) => {
      const path = String(p)
      if (path.includes('openspec-explore'))
        return path.startsWith(globalRoot)
      return true
    })
    const result = await inspectOpenspec()
    expect(result.skills.status).toBe('global-only')
  })

  it('reports missing skills when one required skill is absent everywhere', async () => {
    existsSyncMock.mockImplementation((p: any) => !String(p).includes('openspec-explore'))
    const result = await inspectOpenspec()
    expect(result.skills.status).toBe('missing')
    expect(result.skills.missing).toContain('openspec-explore')
  })

  it('maps no_openspec_root doctor output to root.missing', async () => {
    existsSyncMock.mockReturnValue(true)
    execFileMock.mockImplementation((cmd: string, args: any[], _opts: any, cb: any) => {
      if (cmd === 'openspec' && args[0] === '--version') {
        cb(null, '1.13.0\n')
        return
      }
      if (cmd === 'openspec' && args[0] === 'config') {
        cb(null, JSON.stringify({ workflows: ['propose', 'explore', 'apply', 'archive'] }))
        return
      }
      if (cmd === 'openspec' && args[0] === 'doctor') {
        cb(Object.assign(new Error('exit 1'), { code: 1 }), JSON.stringify({
          root: null,
          status: [{ severity: 'error', code: 'no_openspec_root' }],
        }))
        return
      }
      cb(null, '')
    })
    const result = await inspectOpenspec()
    expect(result.root.status).toBe('missing')
  })

  it('requires root.healthy=true instead of accepting malformed doctor output as healthy', async () => {
    existsSyncMock.mockReturnValue(true)
    execFileMock.mockImplementation((cmd: string, args: any[], _opts: any, cb: any) => {
      if (cmd === 'openspec' && args[0] === '--version') {
        cb(null, '1.13.0\n')
        return
      }
      if (cmd === 'openspec' && args[0] === 'config') {
        cb(null, JSON.stringify({ workflows: ['propose', 'explore', 'apply', 'archive'] }))
        return
      }
      if (cmd === 'openspec' && args[0] === 'doctor') {
        cb(null, JSON.stringify({ root: {}, status: [] }))
        return
      }
      cb(null, '')
    })
    const result = await inspectOpenspec()
    expect(result.root.status).toBe('unhealthy')
  })

  it('reports skills unknown when profile read fails but fallback skills exist', async () => {
    existsSyncMock.mockReturnValue(true)
    execFileMock.mockImplementation((cmd: string, args: any[], _opts: any, cb: any) => {
      if (cmd === 'openspec' && args[0] === '--version') {
        cb(null, '1.13.0\n')
        return
      }
      if (cmd === 'openspec' && args[0] === 'config') {
        cb(new Error('config unavailable'), '')
        return
      }
      if (cmd === 'openspec' && args[0] === 'doctor') {
        cb(null, JSON.stringify({ root: { healthy: true }, status: [] }))
        return
      }
      cb(null, '')
    })
    const result = await inspectOpenspec()
    expect(result.skills.status).toBe('unknown')
  })

  it('does not repair missing skills while root is unhealthy', async () => {
    existsSyncMock.mockImplementation((p: any) => !String(p).includes('openspec-explore'))
    execFileMock.mockImplementation((cmd: string, args: any[], _opts: any, cb: any) => {
      if (cmd === 'openspec' && args[0] === '--version') {
        cb(null, '1.13.0\n')
        return
      }
      if (cmd === 'openspec' && args[0] === 'config') {
        cb(null, JSON.stringify({ workflows: ['propose', 'explore', 'apply', 'archive'] }))
        return
      }
      if (cmd === 'openspec' && args[0] === 'doctor') {
        cb(Object.assign(new Error('unhealthy'), { code: 1 }), JSON.stringify({
          root: { healthy: false },
          status: [{ severity: 'error', code: 'broken_reference' }],
        }))
        return
      }
      cb(null, '')
    })
    const result = await ensureOpenspec({ yes: true })
    expect(result.inspection.root.status).toBe('unhealthy')
    const updateCalls = execFileMock.mock.calls.filter(([, args]) => Array.isArray(args) && args[0] === 'update')
    expect(updateCalls).toHaveLength(0)
  })
})

describe('checkExternalDeps', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    cliState.installed = true
    // CI runners set CI=1, which makes checkExternalDeps take the
    // non-interactive branch — isolate it so install-flow tests are
    // deterministic on CI as well as locally.
    delete process.env.CI
  })

  afterEach(() => {
    delete process.env.CI
    vi.restoreAllMocks()
  })

  it('cI env var: skips install ask and prints unavailable list', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(false)
    process.env.CI = '1'
    await withTTY(true, async () => {
      await checkExternalDeps()
    })
    expect(promptMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })

  it('silent pass when CLI installed and skills present', async () => {
    mockExec()
    existsSyncMock.mockReturnValue(true)
    await checkExternalDeps()
    expect(logSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('warns once when CLI installed but openspec skills missing (plus the repair command)', async () => {
    mockExec()
    existsSyncMock.mockReturnValue(false)
    await checkExternalDeps()
    const lines = logSpy.mock.calls.map(c => String(c[0]))
    expect(lines.filter(l => l.includes('⚠'))).toHaveLength(1)
    expect(lines.some(l => l.includes('openspec init --tools codex'))).toBe(true)
    expect(promptMock).not.toHaveBeenCalled()
  })

  it('skipPrompt option: skips install ask and prints unavailable list', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(false)
    await withTTY(true, async () => {
      await checkExternalDeps({ skipPrompt: true })
    })
    expect(promptMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })

  it('non-TTY: skips install ask and prints unavailable list', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(false)
    await withTTY(false, async () => {
      await checkExternalDeps()
    })
    expect(promptMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })

  it('declined install: prints unavailable list, no npm call', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(false)
    promptMock.mockResolvedValue({ confirmed: false })
    await withTTY(true, async () => {
      await checkExternalDeps()
    })
    expect(promptMock).toHaveBeenCalledTimes(1)
    expect(spawnMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })

  it('successful install: spawn npm with arg array, CLI recheck passes, skills ready', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(true)
    promptMock.mockResolvedValue({ confirmed: true })
    npmInstallResult(0, () => {
      cliState.installed = true
    })
    await withTTY(true, async () => {
      await checkExternalDeps()
    })
    const spawnArgs = spawnMock.mock.calls[0] as any[]
    expect(spawnArgs[0]).toBe('npm')
    expect(Array.isArray(spawnArgs[1])).toBe(true)
    expect(logSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('install succeeds but CLI not on PATH: prints PATH guidance', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(true)
    promptMock.mockResolvedValue({ confirmed: true })
    npmInstallResult(0) // CLI recheck still fails — npm bin not on PATH
    await withTTY(true, async () => {
      await checkExternalDeps()
    })
    expect(spawnMock).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })

  it('failed npm install: reports error and continues (never throws)', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(false)
    promptMock.mockResolvedValue({ confirmed: true })
    npmInstallResult(1)
    await withTTY(true, async () => {
      await expect(checkExternalDeps()).resolves.toBeUndefined()
    })
    expect(errSpy).toHaveBeenCalled()
  })

  it('npm spawn error (ENOENT): reports error and continues (never throws)', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(false)
    promptMock.mockResolvedValue({ confirmed: true })
    npmInstallResult('spawn-error')
    await withTTY(true, async () => {
      await expect(checkExternalDeps()).resolves.toBeUndefined()
    })
    expect(errSpy).toHaveBeenCalled()
  })

  it('inquirer prompt rejection: swallowed by top-level catch (never throws)', async () => {
    mockExec()
    cliState.installed = false
    existsSyncMock.mockReturnValue(false)
    promptMock.mockRejectedValue(new Error('User force closed the prompt'))
    await withTTY(true, async () => {
      await expect(checkExternalDeps()).resolves.toBeUndefined()
    })
  })
})

// 保持 beforeAll 引用避免 i18n 未初始化（部分用例通过 i18n key 输出）
beforeAll(async () => {
  await initI18n('zh-CN')
})

describe('multi-host skills inspection and repair (add-claude-host)', () => {
  const home = homedir()
  const cwd = process.cwd()
  const project = (host: 'codex' | 'claude') => host === 'codex' ? join(cwd, '.agents', 'skills') : join(cwd, '.claude', 'skills')

  beforeEach(() => {
    cliState.installed = true
    mockExec()
    installedHostsState.hosts = ['codex']
  })

  afterEach(() => {
    installedHostsState.hosts = ['codex']
    vi.restoreAllMocks()
  })

  it('only claude installed: judged by claude roots, not missing because codex roots are empty', async () => {
    installedHostsState.hosts = ['claude']
    existsSyncMock.mockImplementation((p: any) => String(p).startsWith(project('claude')))
    const result = await inspectOpenspec()
    expect(result.hosts).toEqual(['claude'])
    expect(result.skills.status).toBe('project-ready')
    expect(result.skills.byHost.codex).toBeUndefined()
  })

  it('no host config file: scans all registered hosts instead of skipping', async () => {
    installedHostsState.hosts = []
    existsSyncMock.mockReturnValue(true)
    const result = await inspectOpenspec()
    expect(result.hosts).toEqual(['codex', 'claude'])
    expect(Object.keys(result.skills.byHost).sort()).toEqual(['claude', 'codex'])
  })

  it('codex project-ready + claude missing → overall missing, per-host lines, repair only claude', async () => {
    installedHostsState.hosts = ['codex', 'claude']
    existsSyncMock.mockImplementation((p: any) => String(p).startsWith(project('codex')))
    const result = await inspectOpenspec()
    expect(result.skills.byHost.codex?.status).toBe('project-ready')
    expect(result.skills.byHost.claude?.status).toBe('missing')
    expect(result.skills.status).toBe('missing')
    expect(result.actions).toContainEqual({ kind: 'repair-skills', strategy: 'init', hosts: ['claude'] })

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printOpenspecInspection(result)
    const lines = logSpy.mock.calls.map(c => String(c[0]))
    expect(lines.some(l => l.includes('[claude]'))).toBe(true)
    expect(lines.some(l => l.includes('[codex]'))).toBe(false)
    expect(lines.some(l => l.includes('openspec init --tools claude'))).toBe(true)
  })

  it('ensure repairs only the host missing skills with its own --tools value', async () => {
    installedHostsState.hosts = ['codex', 'claude']
    existsSyncMock.mockImplementation((p: any) => String(p).startsWith(project('codex')))
    const result = await ensureOpenspec({ yes: true })
    const initCalls = execFileMock.mock.calls.filter(([cmd, args]) => cmd === 'openspec' && Array.isArray(args) && args[0] === 'init')
    expect(initCalls.map(([, args]) => args.slice(0, 3))).toContainEqual(['init', '--tools', 'claude'])
    expect(initCalls.every(([, args]) => args[2] === 'claude')).toBe(true)
    expect(result.executed).toContain('repair-skills:init:openspec init --tools claude')
  })

  it('fresh environment (no host config): ensure writes nothing, only diagnoses', async () => {
    installedHostsState.hosts = []
    existsSyncMock.mockReturnValue(false)
    const result = await ensureOpenspec({ yes: true })
    const writeCalls = execFileMock.mock.calls.filter(([cmd, args]) => cmd === 'openspec' && Array.isArray(args) && (args[0] === 'init' || args[0] === 'update'))
    expect(writeCalls).toHaveLength(0)
    expect(result.executed).toEqual([])
  })

  it('after host confirmation: writes only for the selected hosts', async () => {
    installedHostsState.hosts = []
    existsSyncMock.mockReturnValue(false)
    await ensureOpenspec({ yes: true, hosts: ['codex'], allowWrite: true })
    const initCalls = execFileMock.mock.calls.filter(([cmd, args]) => cmd === 'openspec' && Array.isArray(args) && args[0] === 'init')
    expect(initCalls.length).toBeGreaterThan(0)
    expect(initCalls.every(([, args]) => args[2] === 'codex')).toBe(true)
  })

  it('global-only never triggers project-level writes', async () => {
    installedHostsState.hosts = ['codex']
    existsSyncMock.mockImplementation((p: any) => String(p).startsWith(join(home, '.agents', 'skills')))
    const result = await ensureOpenspec({ yes: true })
    expect(result.inspection.skills.status).toBe('global-only')
    expect(result.executed).toEqual([])
  })
})
