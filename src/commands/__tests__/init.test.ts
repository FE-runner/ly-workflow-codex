import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initI18n } from '../../i18n'

const state = vi.hoisted(() => ({
  installed: [] as string[],
  detected: [] as string[],
  answers: [] as Array<Record<string, unknown>>,
  prompts: [] as any[],
  writes: [] as Array<{ host: string, config: any }>,
  installs: [] as Array<{ hosts: string[], hostConfig: any }>,
}))

vi.mock('inquirer', () => ({
  default: {
    prompt: async (questions: any[]) => {
      state.prompts.push(questions[0])
      const next = state.answers.shift()
      if (!next)
        throw new Error(`unexpected prompt: ${questions[0]?.name} — ${questions[0]?.message}`)
      return next
    },
  },
}))

vi.mock('ora', () => ({
  default: () => ({ start: () => ({ succeed: () => {}, fail: () => {} }) }),
}))

const providerSpies = vi.hoisted(() => ({
  upsertModelProvider: vi.fn(),
  listModelProviders: vi.fn(async () => []),
}))
vi.mock('../../hosts/codex/provider', () => ({
  codexConfigPath: () => '/nonexistent/config.toml',
  listModelProviders: providerSpies.listModelProviders,
  readCodexConfigToml: async () => null,
  readCodexCurrentModel: async () => undefined,
  readModelsJson: async () => undefined,
  sanitizeProviderName: (v: string) => v,
  upsertModelProvider: providerSpies.upsertModelProvider,
}))

vi.mock('../../hosts/codex/legacy-cleanup', () => ({
  cleanupLegacyArtifacts: async () => ({ cleaned: [], skipped: [], failed: [] }),
  reportCleanupResult: () => {},
}))

vi.mock('../../utils/config', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/config')>()
  return {
    ...mod,
    listInstalledHosts: async () => [...state.installed],
    readLyConfig: async () => null,
    writeLyConfig: async (config: any, host: string) => { state.writes.push({ host, config }) },
  }
})

vi.mock('../../utils/host-selection', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/host-selection')>()
  return { ...mod, detectHosts: async () => [...state.detected] }
})

vi.mock('../../utils/installer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/installer')>()
  return {
    ...mod,
    installWorkflows: async (_ids: string[], _dir: string, _force: boolean, config: any) => {
      state.installs.push({ hosts: config.hosts, hostConfig: config.hostConfig })
      return { success: true, installedCommands: [], installedPrompts: [], errors: [], configPath: '' }
    },
  }
})

const { init } = await import('../init')

beforeAll(async () => {
  await initI18n('zh-CN')
})

beforeEach(() => {
  state.installed = []
  state.detected = []
  state.answers = []
  state.prompts = []
  state.writes = []
  state.installs = []
  providerSpies.upsertModelProvider.mockClear()
  providerSpies.listModelProviders.mockClear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('init — host selection (5.1)', () => {
  it('defaults the host checkbox to installed ∪ detected hosts', async () => {
    state.detected = ['codex', 'claude']
    // 语言 → 宿主多选（取消 codex）→ claude 执行者二连 → 确认
    state.answers = [
      { selectedLang: 'zh-CN' },
      { hosts: ['claude'] },
      { pick: 'main' },
      { pick: 'main' },
      { confirm: true },
    ]
    await init()
    const hostPrompt = state.prompts.find(p => p.name === 'hosts')
    expect(hostPrompt.choices.filter((c: any) => c.checked).map((c: any) => c.value)).toEqual(['codex', 'claude'])
    // 取消 codex 后只写 claude，不动 codex
    expect(state.writes.map(w => w.host)).toEqual(['claude'])
    expect(state.installs.map(i => i.hosts)).toEqual([['claude']])
  })
})

describe('init — non-interactive host set (5.2)', () => {
  it('only claude config on disk → reinstalls only claude, never creates codex', async () => {
    state.installed = ['claude']
    state.detected = ['codex', 'claude']
    await init({ skipPrompt: true })
    expect(state.writes.map(w => w.host)).toEqual(['claude'])
    expect(state.installs.map(i => i.hosts)).toEqual([['claude']])
  })

  it('fresh environment with nothing detected → installs codex (pre-change behavior)', async () => {
    await init({ skipPrompt: true })
    expect(state.writes.map(w => w.host)).toEqual(['codex'])
  })

  it('fresh environment with only ~/.claude → installs claude', async () => {
    state.detected = ['claude']
    await init({ skipPrompt: true })
    expect(state.writes.map(w => w.host)).toEqual(['claude'])
  })
})

describe('init — claude wizard (5.3)', () => {
  it('asks executors only, never touches provider config, writes executors to the claude [host] section', async () => {
    state.detected = ['claude']
    state.answers = [
      { selectedLang: 'zh-CN' },
      { hosts: ['claude'] },
      { pick: 'subagent' },
      { pick: 'main' },
      { confirm: true },
    ]
    await init()
    expect(providerSpies.upsertModelProvider).not.toHaveBeenCalled()
    expect(providerSpies.listModelProviders).not.toHaveBeenCalled()
    // 没有模型/推理档采集步骤：全部提示都已按预设答案消费完毕
    expect(state.answers).toEqual([])
    expect(state.prompts.map(p => p.name)).toEqual(['selectedLang', 'hosts', 'pick', 'pick', 'confirm'])
    const write = state.writes.find(w => w.host === 'claude')!
    expect(write.config.host).toEqual({ reviewExecutor: 'subagent', codingExecutor: 'main' })
    expect(write.config.paths.prompts.replace(/\\/g, '/')).toContain('/.claude/lyx')
  })
})

describe('init --host validation (W3)', () => {
  it('invalid host prints a readable error and sets exit code, without a stack trace or install', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await init({ skipPrompt: true, host: 'foo' })
    expect(process.exitCode).toBe(1)
    expect(errSpy.mock.calls.map(c => String(c[0])).join('\n')).toContain('Unknown host: foo')
    expect(state.writes).toEqual([])
    expect(state.installs).toEqual([])
    process.exitCode = undefined
  })
})
