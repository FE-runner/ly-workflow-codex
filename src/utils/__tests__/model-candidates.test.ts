import { beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../i18n'
import {
  buildModelFieldChoices,
  buildReasoningEffortChoices,
  MODEL_CHOICE_CUSTOM,
  MODEL_CHOICE_UNSET,
  REASONING_CHOICE_CUSTOM,
  REASONING_CHOICE_UNSET,
  REASONING_EFFORT_SUGGESTIONS,
} from '../model-candidates'

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

// configure-subagent-reasoning-effort：推理档候选（不覆盖 + 建议档位 + 自定义 + 既有值），不做枚举强校验。
describe('buildReasoningEffortChoices (configure-subagent-reasoning-effort)', () => {
  it('no current value → candidates = unset + suggestions + custom-input, default = unset', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({ current: undefined })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
    ])
    expect(defaultChoice).toBe(REASONING_CHOICE_UNSET)
  })

  it('current suggestion value becomes default without duplicate candidate', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({ current: ' low ' })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
    ])
    expect(defaultChoice).toBe('low')
  })

  it('custom current value is appended as candidate and defaulted as-is', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({ current: 'custom-tier' })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
      'custom-tier',
    ])
    expect(defaultChoice).toBe('custom-tier')
  })

  it('blank current value is treated as unset', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({ current: '   ' })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
    ])
    expect(defaultChoice).toBe(REASONING_CHOICE_UNSET)
  })
})
