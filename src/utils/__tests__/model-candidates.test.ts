import { beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../i18n'
import { buildModelFieldChoices, MODEL_CHOICE_CUSTOM, MODEL_CHOICE_UNSET } from '../model-candidates'

beforeAll(async () => {
  await initI18n('zh-CN')
})

describe('buildModelFieldChoices (codex-model-config)', () => {
  const models = ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5']

  it('no current value → candidates = unset + list + custom-input, default = unset', () => {
    const { choices, defaultChoice } = buildModelFieldChoices({ models, current: undefined })
    expect(choices.map(c => c.value)).toEqual([MODEL_CHOICE_UNSET, ...models, MODEL_CHOICE_CUSTOM])
    expect(defaultChoice).toBe(MODEL_CHOICE_UNSET)
  })

  it('current value in list → default is that value (no extra keep entry)', () => {
    const { choices, defaultChoice } = buildModelFieldChoices({ models, current: ' gpt-5.6-luna ' })
    expect(defaultChoice).toBe('gpt-5.6-luna')
    expect(choices.filter(c => c.value === 'gpt-5.6-luna')).toHaveLength(1) // 清单内不重复附加
  })

  it('current value NOT in list → appends a keep-current (warning) entry after the custom-input option and defaults to it', () => {
    const { choices, defaultChoice } = buildModelFieldChoices({ models, current: 'deepseek-v4-flash' })
    expect(choices.map(c => c.value)).toEqual([MODEL_CHOICE_UNSET, ...models, MODEL_CHOICE_CUSTOM, 'deepseek-v4-flash'])
    expect(defaultChoice).toBe('deepseek-v4-flash')
    const keep = choices[choices.length - 1]
    expect(keep.name).toContain('保留当前值')
    expect(keep.name).toContain('deepseek-v4-flash')
  })

  it('blank current value is treated as unset', () => {
    const { defaultChoice } = buildModelFieldChoices({ models, current: '   ' })
    expect(defaultChoice).toBe(MODEL_CHOICE_UNSET)
  })
})
