import { describe, expect, it } from 'vitest'
import { assessSubagentModelConfig } from '../doctor'

// switchable-executor-flow：doctor 第 7 项"Codex 子代理模型配置"核心判定的纯函数单测（提示型）。
// 覆盖：执行者字段解析（main / subagent / 非法取值）、main 路径下模型字段不生效 → warn、
// subagent 路径下模型字段提示型通过、spawnableModels 形态 warn、已移除字段提示。
describe('assessSubagentModelConfig (switchable-executor-flow)', () => {
  it('both executors unset → ok, default main, model fields unset', () => {
    const result = assessSubagentModelConfig(undefined)
    expect(result.status).toBe('ok')
    expect(result.spawnState).toBe('unset')
    expect(result.executors.map(e => e.kind)).toEqual(['main', 'main'])
    expect(result.executors.every(e => !e.invalid)).toBe(true)
    expect(result.fields.map(f => f.key)).toEqual(['reviewModel', 'codingModel'])
    expect(result.fields.every(f => f.okKind === 'unset')).toBe(true)
    expect(result.removedFields).toEqual([])
  })

  it('subagent executor with configured models → ok, okKind = configured', () => {
    const result = assessSubagentModelConfig({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewModel: 'glm-5.3-flash',
    })
    expect(result.status).toBe('ok')
    expect(result.executors.map(e => e.kind)).toEqual(['subagent', 'subagent'])
    expect(result.fields[0]).toMatchObject({ key: 'reviewModel', value: 'glm-5.3-flash', status: 'ok', okKind: 'configured' })
    expect(result.fields[1]).toMatchObject({ key: 'codingModel', okKind: 'unset' })
  })

  it('main executor with non-empty model → warn, okKind = ineffective', () => {
    const result = assessSubagentModelConfig({ reviewModel: 'glm-5.3-flash' })
    expect(result.status).toBe('warn')
    expect(result.fields[0]).toMatchObject({ key: 'reviewModel', status: 'warn', okKind: 'ineffective' })
  })

  it('main executor with non-empty reasoning effort only → warn', () => {
    const result = assessSubagentModelConfig({ codingReasoningEffort: 'low' })
    expect(result.status).toBe('warn')
    expect(result.fields[1]).toMatchObject({ key: 'codingModel', status: 'warn', okKind: 'ineffective' })
  })

  it('invalid executor value → warn and treated as main', () => {
    const result = assessSubagentModelConfig({ reviewExecutor: 'auto' as never })
    expect(result.status).toBe('warn')
    expect(result.executors[0]).toMatchObject({ key: 'reviewExecutor', kind: 'main', invalid: true, rawValue: 'auto' })
  })

  it('removed fields still present in config → reported in removedFields', () => {
    const result = assessSubagentModelConfig({
      reviewModelB: 'legacy',
      reviewReasoningEffortB: 'low',
    } as never)
    expect(result.removedFields).toEqual(['reviewModelB', 'reviewReasoningEffortB'])
  })

  it('configured value outside any spawnable list still passes (无清单强校验)', () => {
    const result = assessSubagentModelConfig({ reviewExecutor: 'subagent', reviewModel: 'deepseek-v4-flash' })
    expect(result.status).toBe('ok')
    expect(result.fields[0]).toMatchObject({ status: 'ok', okKind: 'configured' })
  })

  it('valid spawnableModels → ok, spawnState = ok', () => {
    const result = assessSubagentModelConfig({ reviewExecutor: 'subagent', spawnableModels: ['glm-5.3-flash'] })
    expect(result.status).toBe('ok')
    expect(result.spawnState).toBe('ok')
  })

  it('malformed spawnableModels (string) → warn even when model fields would pass', () => {
    const result = assessSubagentModelConfig({ spawnableModels: 'bad' as any })
    expect(result.status).toBe('warn')
    expect(result.spawnState).toBe('invalid')
  })

  it('explicit empty spawnableModels array → warn (distinct from unset)', () => {
    const result = assessSubagentModelConfig({ spawnableModels: [] })
    expect(result.status).toBe('warn')
    expect(result.spawnState).toBe('empty')
  })

  it('blank field values are treated as unset', () => {
    const result = assessSubagentModelConfig({ reviewModel: '  ', codingModel: undefined })
    expect(result.fields.every(f => f.okKind === 'unset')).toBe(true)
    expect(result.status).toBe('ok')
  })

  it('shows matching reasoning effort values without changing ok status for subagent executor', () => {
    const result = assessSubagentModelConfig({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewModel: 'glm-5.3-flash',
      codingModel: 'deepseek-v4.1-flash',
      reviewReasoningEffort: ' low ',
      codingReasoningEffort: 'max',
    })
    expect(result.status).toBe('ok')
    expect(result.fields[0]).toMatchObject({ reasoningEffortKey: 'reviewReasoningEffort', reasoningEffort: 'low' })
    expect(result.fields[1]).toMatchObject({ reasoningEffortKey: 'codingReasoningEffort', reasoningEffort: 'max' })
  })

  it('treats blank reasoning effort as unset and keeps custom values without enum validation', () => {
    const result = assessSubagentModelConfig({
      reviewExecutor: 'subagent',
      codingExecutor: 'subagent',
      reviewReasoningEffort: '   ',
      codingReasoningEffort: 'not-a-standard-tier',
    })
    expect(result.fields[0].reasoningEffort).toBeUndefined()
    expect(result.fields[1].reasoningEffort).toBe('not-a-standard-tier')
    expect(result.status).toBe('ok')
  })
})
