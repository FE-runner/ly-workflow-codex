import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ inspect: [] as any[], ensure: [] as any[] }))

vi.mock('../../utils/preflight', () => ({
  inspectOpenspec: async (opts: any) => {
    calls.inspect.push(opts)
    return { hosts: opts?.hosts ?? ['codex'], cli: { status: 'ok' }, skills: { byHost: {} }, root: {}, actions: [] }
  },
  ensureOpenspec: async (opts: any) => {
    calls.ensure.push(opts)
    return { inspection: { hosts: opts?.hosts ?? [], skills: { byHost: {} } }, executed: [] }
  },
  confirmOpenspecCliInstall: async () => false,
  printOpenspecInspection: () => {},
}))

const { runOpenspecCommand } = await import('../openspec')

beforeEach(() => {
  calls.inspect = []
  calls.ensure = []
  process.exitCode = undefined
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.exitCode = undefined
  vi.restoreAllMocks()
})

describe('lycx openspec inspect / ensure --host (6.3)', () => {
  it('inspect with two hosts passes both to the inspector', async () => {
    await runOpenspecCommand('inspect', { host: 'codex,claude', json: true })
    expect(calls.inspect[0].hosts).toEqual(['codex', 'claude'])
  })

  it('inspect without --host lets the inspector resolve installed hosts', async () => {
    await runOpenspecCommand('inspect', {})
    expect(calls.inspect[0].hosts).toBeUndefined()
  })

  it('ensure with a single explicit host allows writes for that host only', async () => {
    await runOpenspecCommand('ensure', { host: 'claude', yes: true, json: true })
    expect(calls.ensure[0]).toMatchObject({ hosts: ['claude'], allowWrite: true, yes: true })
  })

  it('ensure without --host defers the write decision to installed hosts', async () => {
    await runOpenspecCommand('ensure', { yes: true })
    expect(calls.ensure[0].hosts).toBeUndefined()
    expect(calls.ensure[0].allowWrite).toBeUndefined()
  })

  it('rejects unknown hosts and unknown actions with exit code 1', async () => {
    await runOpenspecCommand('ensure', { host: 'gemini' })
    expect(process.exitCode).toBe(1)
    expect(calls.ensure).toHaveLength(0)
    process.exitCode = undefined
    await runOpenspecCommand('bogus', {})
    expect(process.exitCode).toBe(1)
  })
})
