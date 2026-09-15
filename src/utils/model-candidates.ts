import ansis from 'ansis'
import { i18n } from '../i18n'

/** 模型字段 list 的"不设置（留空）"哨兵值（NUL 前缀保证绝不与任何模型 id 冲突） */
export const MODEL_CHOICE_UNSET = '\u0000lyx:unset'

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
 * 候选 = [默认继承当前会话模型（留空）] + spawnableModels 生效清单；
 * 既有值非空且 ∈ 清单 → 默认该项；非空但 ∉ 清单 → 附加"保留当前值（不在可用列表，警告）"项并默认该项
 * （SHALL NOT 静默丢弃或覆盖既有值）；无既有值或空白 → 默认"留空"。
 */
export function buildModelFieldChoices(input: { models: string[], current?: string }): ModelFieldChoices {
  const { models, current } = input
  const currentClean = current?.trim()
  const hasCurrent = currentClean !== undefined && currentClean !== ''
  const inList = hasCurrent && models.includes(currentClean!)

  const choices: ModelFieldChoice[] = [
    { name: ansis.gray(i18n.t('init:model.unsetChoice')), value: MODEL_CHOICE_UNSET },
    ...models.map(id => ({ name: id, value: id })),
  ]
  let defaultChoice = MODEL_CHOICE_UNSET
  if (hasCurrent) {
    if (inList) {
      defaultChoice = currentClean!
    }
    else {
      choices.push({
        name: ansis.yellow(i18n.t('init:model.keepCurrentChoice', { model: currentClean! })),
        value: currentClean!,
      })
      defaultChoice = currentClean!
    }
  }
  return { choices, defaultChoice }
}
