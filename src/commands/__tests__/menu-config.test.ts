import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initI18n } from '../../i18n'

const state = vi.hoisted(() => ({
  installed: [] as string[],
  host: {} as Record<string, unknown>,
  answers: [] as Array<Record<string, unknown>>,
  prompts: [] as any[],
  writes: [] as Array<{ host: string, hostSection: any }>,
  installs: [] as any[],
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

vi.mock('../../utils/config', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/config')>()
  return {
    ...mod,
    listInstalledHosts: async () => [...state.installed],
    readLyConfig: async () => ({ host: state.host }),
    writeLyConfig: async (config: any, host: string) => {
      state.writes.push({ host, hostSection: config.host })
    },
  }
})

vi.mock('../../utils/installer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/installer')>()
  return {
    ...mod,
    installWorkflows: async (_ids: string[], _dir: string, _force: boolean, cfg: any) => {
      state.installs.push(cfg)
      return { success: true, installedCommands: [], installedPrompts: [], errors: [], configPath: '' }
    },
  }
})

const { configExecutorsAndModels } = await import('../menu')

beforeAll(async () => {
  await initI18n('zh-CN')
})

beforeEach(() => {
  state.installed = []
  state.host = {}
  state.answers = []
  state.prompts = []
  state.writes = []
  state.installs = []
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('menu 子代理配置入口 (host-subagent-model-config)', () => {
  it('codex：采集六个字段并写回，写回后重渲染产物', async () => {
    state.installed = ['codex']
    state.host = { reviewExecutor: 'main', codingExecutor: 'main' }
    state.answers = [
      { pick: 'subagent' },
      { pick: 'subagent' },
      { pick: 'glm-5.3-flash' },
      { pick: 'DeepSeek-V4.1-Flash' },
      { pick: 'high' },
      { pick: 'low' },
    ]
    await configExecutorsAndModels()
    expect(state.answers).toEqual([])
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0].host).toBe('codex')
    expect(state.writes[0].hostSection).toEqual({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewModel: 'glm-5.3-flash',
      codingModel: 'DeepSeek-V4.1-Flash',
      reviewReasoningEffort: 'high',
      codingReasoningEffort: 'low',
    })
    // 写回后触发重渲染（claude 侧同时重渲子代理定义）
    expect(state.installs).toHaveLength(1)
    expect(state.installs[0].hosts).toEqual(['codex'])
  })

  it('claude：保留执行者二连；编码侧为 main 时不采集其模型与推理档，既有值保留', async () => {
    state.installed = ['claude']
    state.host = {
      reviewExecutor: 'main',
      codingExecutor: 'main',
      codingModel: 'claude-opus-5-5',
      codingReasoningEffort: 'low',
    }
    state.answers = [
      { pick: 'subagent' },
      { pick: 'main' },
      { pick: 'claude-sonnet-5-5' },
      { pick: 'high' },
    ]
    await configExecutorsAndModels()
    expect(state.answers).toEqual([])
    // main 执行者下编码侧不提问：四个提示 = 执行者二连 + 审查模型 + 审查推理档
    expect(state.prompts.map(p => p.name)).toEqual(['pick', 'pick', 'pick', 'pick'])
    expect(state.writes[0].hostSection).toEqual({
      reviewExecutor: 'subagent',
      codingExecutor: 'main',
      reviewModel: 'claude-sonnet-5-5',
      codingModel: 'claude-opus-5-5',
      reviewReasoningEffort: 'high',
      codingReasoningEffort: 'low',
    })
  })

  it('claude：推理档候选含 xhigh、不含 minimal；显式"不覆盖"清除该字段', async () => {
    state.installed = ['claude']
    state.host = { reviewExecutor: 'subagent', codingExecutor: 'main', reviewReasoningEffort: 'high' }
    state.answers = [
      { pick: 'subagent' },
      { pick: 'main' },
      { pick: '\u0000lyx:unset' },
      { pick: '\u0000lyx:reasoning-unset' },
    ]
    await configExecutorsAndModels()
    const reasoningPrompt = state.prompts.find(p => String(p.message).includes('reviewReasoningEffort'))!
    const values = reasoningPrompt.choices.map((c: any) => c.value)
    expect(values).toContain('xhigh')
    expect(values).not.toContain('minimal')
    expect(state.writes[0].hostSection.reviewReasoningEffort).toBeUndefined()
    expect(state.writes[0].hostSection.reviewModel).toBeUndefined()
  })

  it('既有值作为候选项默认值（不静默丢弃）：只改一个字段也完整写回六字段', async () => {
    state.installed = ['claude']
    state.host = {
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewModel: 'claude-sonnet-5-5',
      codingModel: 'claude-opus-5-5',
      reviewReasoningEffort: 'xhigh',
    }
    state.answers = [
      { pick: 'subagent' },
      { pick: 'subagent' },
      { pick: 'claude-sonnet-5-5' },
      { pick: 'claude-opus-5-5' },
      { pick: 'high' },
      { pick: '\u0000lyx:reasoning-unset' },
    ]
    await configExecutorsAndModels()
    const modelPrompts = state.prompts.filter(p => String(p.message).includes('模型'))
    expect(modelPrompts.map(p => p.default)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5'])
    const reviewEffortPrompt = state.prompts.find(p => String(p.message).includes('reviewReasoningEffort'))!
    expect(reviewEffortPrompt.default).toBe('xhigh')
    expect(state.writes[0].hostSection).toEqual({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewModel: 'claude-sonnet-5-5',
      codingModel: 'claude-opus-5-5',
      reviewReasoningEffort: 'high',
    })
  })

  it('未修改任何字段时不写回、不重渲染', async () => {
    state.installed = ['claude']
    state.host = { reviewExecutor: 'main', codingExecutor: 'main' }
    state.answers = [
      { pick: 'main' },
      { pick: 'main' },
    ]
    await configExecutorsAndModels()
    expect(state.writes).toEqual([])
    expect(state.installs).toEqual([])
  })
})
