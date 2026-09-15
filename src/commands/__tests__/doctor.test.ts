import { describe, expect, it } from 'vitest'
import { assessSubagentModelConfig } from '../doctor'

// codex-model-config：doctor 第 7 项"Codex 子代理模型配置"核心判定的纯函数单测（提示型）。
// 覆盖：清空配置→ok / 已配置（含清单外、自定义输入）→ok 仅提示 / spawnableModels 格式非法→warn。
describe('assessSubagentModelConfig (codex-model-config)', () => {
  it('all three model fields unset → ok, spawn state = unset', () => {
    const result = assessSubagentModelConfig(undefined)
    expect(result.status).toBe('ok')
    expect(result.spawnState).toBe('unset')
    expect(result.fields.every(f => f.status === 'ok' && f.okKind === 'unset')).toBe(true)
  })

  it('configured field values → ok with okKind = configured (提示型，不做清单校验)', () => {
    const result = assessSubagentModelConfig({ reviewModel: 'glm-5.3-flash', reviewModelB: 'gpt-5.6-luna' })
    expect(result.status).toBe('ok')
    expect(result.fields[0]).toMatchObject({ key: 'reviewModel', value: 'glm-5.3-flash', status: 'ok', okKind: 'configured' })
    expect(result.fields[1]).toMatchObject({ key: 'reviewModelB', value: 'gpt-5.6-luna', status: 'ok', okKind: 'configured' })
    expect(result.fields[2]).toMatchObject({ key: 'codingModel', okKind: 'unset' })
  })

  it('configured value outside any spawnable list still passes (无清单强校验)', () => {
    const result = assessSubagentModelConfig({ reviewModel: 'deepseek-v4-flash' })
    expect(result.status).toBe('ok')
    expect(result.fields[0]).toMatchObject({ status: 'ok', okKind: 'configured' })
  })

  it('valid spawnableModels → ok, spawnState = ok', () => {
    const result = assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'] })
    expect(result.status).toBe('ok')
    expect(result.spawnState).toBe('ok')
  })

  it('malformed spawnableModels (string) → warn even when model fields would pass', () => {
    const result = assessSubagentModelConfig({ spawnableModels: 'bad' as any })
    expect(result.status).toBe('warn')
    expect(result.spawnState).toBe('invalid')
    expect(result.fields.every(f => f.status === 'ok')).toBe(true)
  })

  it('explicit empty spawnableModels array → warn (distinct from unset)', () => {
    const result = assessSubagentModelConfig({ spawnableModels: [] })
    expect(result.status).toBe('warn')
    expect(result.spawnState).toBe('empty')
  })

  it('blank field values are treated as unset', () => {
    const result = assessSubagentModelConfig({ reviewModel: '  ', reviewModelB: '', codingModel: undefined })
    expect(result.fields.every(f => f.okKind === 'unset')).toBe(true)
    expect(result.status).toBe('ok')
  })
})
