import { describe, expect, it } from 'vitest'
import { SPAWNABLE_MODELS_DEFAULT } from '../../utils/config'
import { assessSubagentModelConfig } from '../doctor'

// codex-model-config：doctor 第 7 项"Codex 子代理模型配置"核心判定的纯函数单测。
// 覆盖四态：清空配置→ok / 清单内模型→ok / 清单外模型→fail / spawnableModels 格式非法→warn。
describe('assessSubagentModelConfig (codex-model-config)', () => {
  it('all three model fields unset → ok, list source = builtin default', () => {
    const result = assessSubagentModelConfig(undefined)
    expect(result.status).toBe('ok')
    expect(result.spawnState).toBe('unset')
    expect(result.listSource).toBe('builtin')
    expect(result.effectiveModels).toEqual([...SPAWNABLE_MODELS_DEFAULT])
    expect(result.fields.every(f => f.status === 'ok' && f.okKind === 'unset')).toBe(true)
  })

  it('in-list model values → ok with the field marked in-list, default list source = builtin', () => {
    const result = assessSubagentModelConfig({ reviewModel: 'gpt-5.6-luna' })
    expect(result.status).toBe('ok')
    expect(result.fields[0]).toMatchObject({ key: 'reviewModel', value: 'gpt-5.6-luna', status: 'ok', okKind: 'in-list' })
    expect(result.listSource).toBe('builtin')
  })

  it('configured spawnableModels list is the effective validation source', () => {
    expect(assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'] }).listSource).toBe('configured')
    expect(assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'] }).effectiveModels).toEqual(['glm-5.3-flash'])
    // reviewModel 在用户清单内 → ok；在用户清单外（即使是内置默认之一）→ fail
    expect(assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'], reviewModel: 'glm-5.3-flash' }).status).toBe('ok')
    expect(assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'], reviewModel: 'gpt-5.6-luna' }).status).toBe('fail')
  })

  it('out-of-list model value → fail with the offending field listed', () => {
    const result = assessSubagentModelConfig({ reviewModel: 'deepseek-v4-flash' })
    expect(result.status).toBe('fail')
    expect(result.fields[0]).toMatchObject({ key: 'reviewModel', value: 'deepseek-v4-flash', status: 'fail' })
  })

  it('malformed spawnableModels (string) → warn even when model fields would pass', () => {
    const result = assessSubagentModelConfig({ spawnableModels: 'bad' as any })
    expect(result.status).toBe('warn')
    expect(result.spawnState).toBe('invalid')
    expect(result.listSource).toBe('builtin')
    expect(result.fields.every(f => f.status === 'ok')).toBe(true)
  })

  it('explicit empty spawnableModels array → warn (distinct from unset)', () => {
    const result = assessSubagentModelConfig({ spawnableModels: [] })
    expect(result.status).toBe('warn')
    expect(result.spawnState).toBe('empty')
  })

  it('a field out of list takes priority over the spawnableModels WARN (fail wins)', () => {
    const result = assessSubagentModelConfig({ spawnableModels: 'bad' as any, reviewModel: 'deepseek-v4-flash' })
    expect(result.status).toBe('fail')
    expect(result.spawnState).toBe('invalid')
  })
})
