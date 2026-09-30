import type { ExecutorKind } from '../types'
import ansis from 'ansis'
import inquirer from 'inquirer'
import { i18n } from '../i18n'
import { sanitizeModelField, sanitizeReviewModel } from '../utils/config'
import {
  buildModelFieldChoices,
  buildReasoningEffortChoices,
  MODEL_CHOICE_CUSTOM,
  MODEL_CHOICE_UNSET,
  REASONING_CHOICE_CUSTOM,
  REASONING_CHOICE_UNSET,
} from '../utils/model-candidates'

// ═══════════════════════════════════════════════════════
// 子代理配置采集（init 与 menu 共用；两宿主同口径）
// 采集面：执行者二连 → 模型二连 → 推理档二连。
// 宿主差异只有两处，均由调用方传入：① 执行者提示文案键；② 推理档建议档位清单（宿主适配层提供）。
// 共享层不出现宿主名分支。
// ═══════════════════════════════════════════════════════

/** 采集结果：执行者二连 + 模型二连 + 推理档二连（undefined = 未配置） */
export interface SubagentConfigCollected {
  reviewExecutor?: ExecutorKind
  codingExecutor?: ExecutorKind
  reviewModel?: string
  codingModel?: string
  reviewReasoningEffort?: string
  codingReasoningEffort?: string
}

// 模型字段的驱动元数据（i18n 键 + 持久化清洗归属：reviewModel 白名单、codingModel 仅 trim）。
// 仅在对应执行者为 subagent 时提示采集；main 路径下保留既有值但不采集。
const MODEL_FIELDS = [
  { key: 'reviewModel', executorKey: 'reviewExecutor', labelKey: 'init:model.reviewModelA', sanitize: sanitizeReviewModel },
  { key: 'codingModel', executorKey: 'codingExecutor', labelKey: 'init:model.codingModel', sanitize: sanitizeModelField },
] as const

// 推理档覆盖字段的驱动元数据（与对应执行者 / 模型字段配对）
const REASONING_FIELDS = [
  { key: 'reviewReasoningEffort', executorKey: 'reviewExecutor', labelKey: 'init:reasoning.reviewLabel' },
  { key: 'codingReasoningEffort', executorKey: 'codingExecutor', labelKey: 'init:reasoning.codingLabel' },
] as const

// 执行者字段的驱动元数据（候选固定为 main / subagent，默认 main）
const EXECUTOR_FIELDS = [
  { key: 'reviewExecutor', labelKey: 'init:executor.reviewExecutor' },
  { key: 'codingExecutor', labelKey: 'init:executor.codingExecutor' },
] as const

/**
 * 执行者字段 list 选择：候选 = 主 agent 直接执行（默认）/ spawn 独立子代理。
 * 未配置或既有值非法时默认选中 main。
 */
async function pickExecutorField(input: {
  field: typeof EXECUTOR_FIELDS[number]
  current?: ExecutorKind
}): Promise<ExecutorKind> {
  const { field, current } = input
  const { pick } = await inquirer.prompt([{
    type: 'list',
    name: 'pick',
    message: i18n.t(field.labelKey),
    choices: [
      { name: i18n.t('init:executor.main'), value: 'main' },
      { name: i18n.t('init:executor.subagent'), value: 'subagent' },
    ],
    default: current ?? 'main',
  }])
  return pick === 'subagent' ? 'subagent' : 'main'
}

/**
 * 模型字段 list 选择（候选 = 默认继承（留空）+ 自定义输入 + 既有值）：
 * 候选构造与默认值语义由 `buildModelFieldChoices` 统一提供——模型指定只保留两种方式：留空
 * （继承当前会话模型）或自定义输入任意模型名（能否 spawn 由宿主实际能力决定，配置仅为提示）。
 * 既有值非空 → 附该项并默认；无既有值或空白 → 默认"留空"。
 */
async function pickModelField(input: {
  field: typeof MODEL_FIELDS[number]
  current?: string
}): Promise<string | undefined> {
  const { field, current } = input
  const { choices, defaultChoice } = buildModelFieldChoices({ current })

  const { pick } = await inquirer.prompt([{
    type: 'list',
    name: 'pick',
    message: i18n.t(field.labelKey),
    choices,
    default: defaultChoice,
    pageSize: 15,
  }])

  if (pick === MODEL_CHOICE_UNSET)
    return undefined
  if (pick === MODEL_CHOICE_CUSTOM) {
    // 自定义输入：保留自由输入方式（不做清单限制）；留空视为取消（回退默认"留空"）
    const { custom } = await inquirer.prompt([{
      type: 'input',
      name: 'custom',
      message: i18n.t('init:model.customPrompt'),
    }])
    const model = custom?.trim()
    return model || undefined
  }
  return typeof pick === 'string' ? pick.trim() : undefined
}

/**
 * 推理档覆盖选择：候选 = 不覆盖 + 该宿主的建议档位 + 自定义输入 + 既有值。
 * 返回 undefined 表示不覆盖（清除字段）；自定义输入留空同样等价于不覆盖。
 */
async function pickReasoningEffortField(input: {
  field: typeof REASONING_FIELDS[number]
  current?: string
  suggestions: readonly string[]
}): Promise<string | undefined> {
  const { field, current, suggestions } = input
  const { choices, defaultChoice } = buildReasoningEffortChoices({ current, suggestions })

  const { pick } = await inquirer.prompt([{
    type: 'list',
    name: 'pick',
    message: i18n.t(field.labelKey),
    choices,
    default: defaultChoice,
    pageSize: 15,
  }])

  if (pick === REASONING_CHOICE_UNSET)
    return undefined
  if (pick === REASONING_CHOICE_CUSTOM) {
    const { custom } = await inquirer.prompt([{
      type: 'input',
      name: 'custom',
      message: i18n.t('init:reasoning.customPrompt'),
    }])
    const value = custom?.trim()
    return value || undefined
  }
  return typeof pick === 'string' ? pick.trim() : undefined
}

/**
 * 交互采集子代理配置：执行者二连 → 模型二连 → 推理档二连。
 *
 * - 模型与推理档**仅在对应执行者为 `subagent`** 时提示采集；执行者为 `main` 时保留既有值但不采集
 *   （既有值原样回填，`lycx doctor` 会对"不生效"输出 WARN）。
 * - `executorHintKey`：执行者步骤的提示文案键（两宿主各自的上下文说明）。
 * - `suggestions`：该宿主的推理档建议清单，由宿主适配层提供，仅作候选提示、不做枚举强校验。
 * - `defaults`：既有配置值，作为每个字段的默认选中项（未触碰即保留）。
 */
export async function collectSubagentConfig(options: {
  defaults: SubagentConfigCollected
  executorHintKey: string
  suggestions: readonly string[]
}): Promise<SubagentConfigCollected> {
  const { defaults, executorHintKey, suggestions } = options
  const collected: SubagentConfigCollected = {}

  // ── 执行者二连 ──
  console.log()
  console.log(ansis.cyan.bold(`  ${i18n.t('init:executor.title')}`))
  console.log()
  console.log(ansis.gray(`  ${i18n.t(executorHintKey)}`))
  console.log()
  for (const field of EXECUTOR_FIELDS) {
    collected[field.key] = await pickExecutorField({
      field,
      current: defaults[field.key],
    })
  }

  // ── 模型二连（仅在对应执行者为 subagent 时提示；main 下保留既有值但不采集）──
  console.log()
  console.log(ansis.cyan.bold(`  🧠 ${i18n.t('init:model.trioTitle')}`))
  console.log()
  console.log(ansis.gray(`  ${i18n.t('init:model.trioCandidatesHint')}`))
  console.log()
  for (const field of MODEL_FIELDS) {
    if (collected[field.executorKey] !== 'subagent') {
      collected[field.key] = defaults[field.key]?.trim() || undefined
      continue
    }
    const current = defaults[field.key]?.trim() || undefined
    const raw = await pickModelField({ field, current })
    collected[field.key] = field.sanitize(raw)
  }

  // ── 推理档二连（仅在对应执行者为 subagent 时提示；main 下保留既有值）──
  for (const field of REASONING_FIELDS) {
    if (collected[field.executorKey] !== 'subagent') {
      collected[field.key] = defaults[field.key]?.trim() || undefined
      continue
    }
    collected[field.key] = await pickReasoningEffortField({
      field,
      current: defaults[field.key],
      suggestions,
    })
  }

  return collected
}
