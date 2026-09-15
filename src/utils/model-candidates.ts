import ansis from 'ansis'
import { i18n } from '../i18n'

/** 模型字段 list 的"不设置（留空）"哨兵值（NUL 前缀保证绝不与任何模型 id 冲突） */
export const MODEL_CHOICE_UNSET = '\u0000lyx:unset'

/** 模型字段 list 的"自定义输入"哨兵值（NUL 前缀保证绝不与任何模型 id 冲突） */
export const MODEL_CHOICE_CUSTOM = '\u0000lyx:custom'

export interface ModelFieldChoice {
  name: string
  value: string
}

export interface ModelFieldChoices {
  choices: ModelFieldChoice[]
  defaultChoice: string
}

/**
 * 模型字段候选构造（init 模型三连与 menu 审查模型编辑共用，保证候选/默认语义一致）：
 * 候选 = [默认继承当前会话模型（留空）] + [自定义输入] + [既有值（若有）]；
 * 模型指定只保留两种方式：留空（继承当前会话模型）或自定义输入任意模型名
 * （能否 spawn 由宿主实际能力决定，配置仅为提示）。既有值非空 → 附该项并默认，
 * SHALL NOT 静默丢弃或覆盖；无既有值或空白 → 默认"留空"。
 */
export function buildModelFieldChoices(input: { current?: string }): ModelFieldChoices {
  const { current } = input
  const currentClean = current?.trim()
  const hasCurrent = currentClean !== undefined && currentClean !== ''

  const choices: ModelFieldChoice[] = [
    { name: ansis.gray(i18n.t('init:model.unsetChoice')), value: MODEL_CHOICE_UNSET },
    { name: ansis.cyan(i18n.t('init:model.customChoice')), value: MODEL_CHOICE_CUSTOM },
  ]
  let defaultChoice = MODEL_CHOICE_UNSET
  if (hasCurrent) {
    choices.push({ name: currentClean!, value: currentClean! })
    defaultChoice = currentClean!
  }
  return { choices, defaultChoice }
}
