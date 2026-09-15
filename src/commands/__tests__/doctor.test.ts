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

  it('configured spawnableModels is the base; configured field values always merge into the effective list', () => {
    expect(assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'] }).listSource).toBe('configured')
    expect(assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'] }).effectiveModels).toEqual(['glm-5.3-flash'])
    // reviewModel 在用户清单内 → ok；清单外配置值（含自定义输入）→ 并入生效清单同样 ok
    expect(assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'], reviewModel: 'glm-5.3-flash' }).status).toBe('ok')
    const outOfBase = assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'], reviewModel: 'gpt-5.6-luna' })
    expect(outOfBase.status).toBe('ok')
    expect(outOfBase.effectiveModels).toEqual(['glm-5.3-flash', 'gpt-5.6-luna'])
  })

  it('configured model value without explicit spawnableModels → merged into the effective list (ok)', () => {
    const result = assessSubagentModelConfig({ reviewModel: 'deepseek-v4-flash' })
    expect(result.status).toBe('ok')
    expect(result.effectiveModels).toContain('deepseek-v4-flash')
    expect(result.fields[0]).toMatchObject({ key: 'reviewModel', value: 'deepseek-v4-flash', status: 'ok', okKind: 'in-list' })
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

  it('malformed spawnableModels with a configured field → field merges (ok), overall WARN stays', () => {
    const result = assessSubagentModelConfig({ spawnableModels: 'bad' as any, reviewModel: 'deepseek-v4-flash' })
    expect(result.status).toBe('warn')
    expect(result.spawnState).toBe('invalid')
    expect(result.fields[0].status).toBe('ok')
  })

  it('inherited current-session model is merged into the effective list when spawnableModels is unset', () => {
    // 主会话模型可检测到 → 合并入生效清单（宽松路径），无警告
    const inList = assessSubagentModelConfig(undefined, { currentModel: 'deepseek-v4-flash' })
    expect(inList.status).toBe('ok')
    expect(inList.effectiveModels).toContain('deepseek-v4-flash')
    expect(inList.inheritedModel).toBeUndefined()
    // 主会话模型未检测到 → ok，不提示
    expect(assessSubagentModelConfig(undefined, { currentModel: undefined }).status).toBe('ok')
    expect(assessSubagentModelConfig(undefined, {}).status).toBe('ok')
  })

  it('inherited current-session model not in an explicit spawnableModels list → warn (strict path)', () => {
    const warnResult = assessSubagentModelConfig({ spawnableModels: ['glm-5.3-flash'] }, { currentModel: 'deepseek-v4-flash' })
    expect(warnResult.status).toBe('warn')
    expect(warnResult.effectiveModels).toEqual(['glm-5.3-flash'])
    expect(warnResult.inheritedModel).toEqual({ model: 'deepseek-v4-flash' })
  })

  it('does not warn on unset inheritance when every field is explicitly in-list', () => {
    const result = assessSubagentModelConfig(
      { reviewModel: 'gpt-5.6-luna', reviewModelB: 'gpt-5.6-luna', codingModel: 'gpt-5.6-luna' },
      { currentModel: 'deepseek-v4-flash' },
    )
    expect(result.status).toBe('ok')
    expect(result.inheritedModel).toBeUndefined()
  })

  it('configured field + same current model (unset spawnableModels) → both merged, ok', () => {
    const result = assessSubagentModelConfig(
      { reviewModel: 'deepseek-v4-flash' },
      { currentModel: 'deepseek-v4-flash' },
    )
    expect(result.status).toBe('ok')
    expect(result.fields[0].okKind).toBe('in-list')
  })
})
