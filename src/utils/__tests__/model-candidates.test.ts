import { beforeAll, describe, expect, it } from 'vitest'
import { CLAUDE_REASONING_EFFORT_SUGGESTIONS } from '../../hosts/claude/adapter'
import { CODEX_REASONING_EFFORT_SUGGESTIONS } from '../../hosts/codex/adapter'
import { initI18n } from '../../i18n'
import {
  buildModelFieldChoices,
  buildReasoningEffortChoices,
  MODEL_CHOICE_CUSTOM,
  MODEL_CHOICE_UNSET,
  REASONING_CHOICE_CUSTOM,
  REASONING_CHOICE_UNSET,
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

// host-subagent-model-config：推理档候选（不覆盖 + 该宿主建议档位 + 自定义 + 既有值），不做枚举强校验。
// 建议清单由宿主适配层提供——共享层不再持有单一常量。
describe('buildReasoningEffortChoices (host-subagent-model-config)', () => {
  it('codex 宿主的建议清单保持 minimal / low / medium / high / max', () => {
    expect([...CODEX_REASONING_EFFORT_SUGGESTIONS]).toEqual(['minimal', 'low', 'medium', 'high', 'max'])
  })

  it('claude 宿主的建议清单为 low / medium / high / xhigh / max（无 minimal，含 xhigh）', () => {
    expect([...CLAUDE_REASONING_EFFORT_SUGGESTIONS]).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  })

  it('no current value → candidates = unset + host suggestions + custom-input, default = unset', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({
      current: undefined,
      suggestions: CODEX_REASONING_EFFORT_SUGGESTIONS,
    })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...CODEX_REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
    ])
    expect(defaultChoice).toBe(REASONING_CHOICE_UNSET)
  })

  it('claude 清单渲染进候选（xhigh 在列、minimal 不在列）', () => {
    const { choices } = buildReasoningEffortChoices({
      current: undefined,
      suggestions: CLAUDE_REASONING_EFFORT_SUGGESTIONS,
    })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
      REASONING_CHOICE_CUSTOM,
    ])
  })

  it('current suggestion value becomes default without duplicate candidate', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({
      current: ' low ',
      suggestions: CODEX_REASONING_EFFORT_SUGGESTIONS,
    })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...CODEX_REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
    ])
    expect(defaultChoice).toBe('low')
  })

  it('custom current value is appended as candidate and defaulted as-is', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({
      current: 'custom-tier',
      suggestions: CLAUDE_REASONING_EFFORT_SUGGESTIONS,
    })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...CLAUDE_REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
      'custom-tier',
    ])
    expect(defaultChoice).toBe('custom-tier')
  })

  it('既有值不在该宿主清单内时仍保留（minimal + claude 清单）', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({
      current: 'minimal',
      suggestions: CLAUDE_REASONING_EFFORT_SUGGESTIONS,
    })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...CLAUDE_REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
      'minimal',
    ])
    expect(defaultChoice).toBe('minimal')
  })

  it('blank current value is treated as unset', () => {
    const { choices, defaultChoice } = buildReasoningEffortChoices({
      current: '   ',
      suggestions: CODEX_REASONING_EFFORT_SUGGESTIONS,
    })
    expect(choices.map(c => c.value)).toEqual([
      REASONING_CHOICE_UNSET,
      ...CODEX_REASONING_EFFORT_SUGGESTIONS,
      REASONING_CHOICE_CUSTOM,
    ])
    expect(defaultChoice).toBe(REASONING_CHOICE_UNSET)
  })
})
