import { beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../i18n'
import { buildModelFieldChoices, MODEL_CHOICE_CUSTOM, MODEL_CHOICE_UNSET } from '../model-candidates'

beforeAll(async () => {
  await initI18n('zh-CN')
})

// codex-model-config：模型字段候选（留空 + 自定义输入 + 既有值），无清单字面量。
describe('buildModelFieldChoices (codex-model-config)', () => {
  it('no current value → candidates = unset + custom-input, default = unset', () => {
    const { choices, defaultChoice } = buildModelFieldChoices({ current: undefined })
    expect(choices.map(c => c.value)).toEqual([MODEL_CHOICE_UNSET, MODEL_CHOICE_CUSTOM])
    expect(defaultChoice).toBe(MODEL_CHOICE_UNSET)
  })

  it('current value → appended after the custom-input option and becomes default', () => {
    const { choices, defaultChoice } = buildModelFieldChoices({ current: ' gpt-5.6-luna ' })
    expect(choices.map(c => c.value)).toEqual([MODEL_CHOICE_UNSET, MODEL_CHOICE_CUSTOM, 'gpt-5.6-luna'])
    expect(defaultChoice).toBe('gpt-5.6-luna')
  })

  it('different current value (custom/out-of-list) → appended and defaulted as-is', () => {
    const { choices, defaultChoice } = buildModelFieldChoices({ current: 'deepseek-v4-flash' })
    expect(choices.map(c => c.value)).toEqual([MODEL_CHOICE_UNSET, MODEL_CHOICE_CUSTOM, 'deepseek-v4-flash'])
    expect(defaultChoice).toBe('deepseek-v4-flash')
  })

  it('blank current value is treated as unset', () => {
    const { choices, defaultChoice } = buildModelFieldChoices({ current: '   ' })
    expect(choices.map(c => c.value)).toEqual([MODEL_CHOICE_UNSET, MODEL_CHOICE_CUSTOM])
    expect(defaultChoice).toBe(MODEL_CHOICE_UNSET)
  })
})
