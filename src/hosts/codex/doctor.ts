import type { ExecutorKind, LyConfig } from '../../types'
import type { HostDoctorCheck, HostInspectContext } from '../../utils/host-adapters'
import fs from 'fs-extra'
import { join } from 'pathe'
import { i18n } from '../../i18n'
import { sanitizeExecutor, sanitizeModelField, sanitizeReasoningEffort, sanitizeReviewModel, sanitizeSpawnableModels } from '../../utils/config'
import { listPrefixedDirs } from '../../utils/fs-helpers'
import { readCodexCurrentModel } from './provider'

// ═══════════════════════════════════════════════════════
// codex 宿主体检项：命令产物、角色词、子代理模型配置（提示型）
// ═══════════════════════════════════════════════════════

export interface SubagentModelFieldResult {
  key: string
  /** 配置值（清洗后）；undefined = 留空 */
  value?: string
  status: 'ok' | 'warn'
  /** 判定原因：'unset' 留空 | 'configured' 已配置且生效 | 'ineffective' 已配置但执行者为 main（不生效） */
  okKind: 'unset' | 'configured' | 'ineffective'
  /** 与该模型字段一一对应的推理档字段名 */
  reasoningEffortKey: string
  /** 推理档值（清洗后）；undefined = 未配置（不传 reasoning_effort） */
  reasoningEffort?: string
}

export interface SubagentExecutorResult {
  key: 'reviewExecutor' | 'codingExecutor'
  /** 解析后的执行者；非法取值按 'main' 处理 */
  kind: ExecutorKind
  /** 原值非空但不是合法取值 */
  invalid: boolean
  /** 原始配置值（用于 WARN 展示） */
  rawValue?: string
}

export interface SubagentModelConfigResult {
  /** 总体状态：warn（spawnableModels 形态异常 / 执行者非法 / 模型字段在 main 路径下不生效）> ok */
  status: 'ok' | 'warn'
  executors: SubagentExecutorResult[]
  fields: SubagentModelFieldResult[]
  /** spawnableModels 字段形态（empty/invalid 时对总体输出 WARN，区别于未配置的静默通过） */
  spawnState: 'unset' | 'ok' | 'empty' | 'invalid'
  /** 配置中仍存在的已移除字段名（reviewModelB / reviewReasoningEffortB） */
  removedFields: string[]
}

/** 解析执行者字段：合法值直通；未配置/空白 → main；非空非法值 → main + invalid 标记 */
function resolveExecutor(value: unknown): { kind: ExecutorKind, invalid: boolean } {
  const cleaned = sanitizeExecutor(value)
  if (cleaned)
    return { kind: cleaned, invalid: false }
  const invalid = typeof value === 'string' && value.trim() !== ''
  return { kind: 'main', invalid }
}

/**
 * 子代理模型配置审查（doctor 第 7 项核心判定，独立导出便于单测）：
 * 执行者字段只做提示——main / subagent 均通过；非法取值 WARN 并按 main 处理。
 * 模型与推理档字段在执行者为 subagent 时只做提示不做清单强校验（留空 = 继承当前会话模型，
 * 非空 = 已配置）；执行者为 main 时若对应字段非空则 WARN（该字段不生效）。
 * spawnableModels 字段显式存在但格式非法/清洗后为空 → 总体 WARN。
 * reviewModelB / reviewReasoningEffortB 已移除，存量配置出现时输出提示。
 */
export function assessSubagentModelConfig(codexHost: LyConfig['host']): SubagentModelConfigResult {
  const spawn = sanitizeSpawnableModels(codexHost?.spawnableModels)

  const reviewExecutor = resolveExecutor(codexHost?.reviewExecutor)
  const codingExecutor = resolveExecutor(codexHost?.codingExecutor)

  const buildField = (input: {
    key: string
    value?: string
    reasoningEffortKey: string
    reasoningEffort?: string
    executorKind: ExecutorKind
  }): SubagentModelFieldResult => {
    const ineffective = input.executorKind === 'main'
    const hasValue = Boolean(input.value || input.reasoningEffort)
    return {
      key: input.key,
      value: input.value,
      status: ineffective && hasValue ? 'warn' : 'ok',
      okKind: hasValue ? (ineffective ? 'ineffective' : 'configured') : 'unset',
      reasoningEffortKey: input.reasoningEffortKey,
      reasoningEffort: input.reasoningEffort,
    }
  }

  const fields: SubagentModelFieldResult[] = [
    buildField({
      key: 'reviewModel',
      value: sanitizeReviewModel(codexHost?.reviewModel),
      reasoningEffortKey: 'reviewReasoningEffort',
      reasoningEffort: sanitizeReasoningEffort(codexHost?.reviewReasoningEffort),
      executorKind: reviewExecutor.kind,
    }),
    buildField({
      key: 'codingModel',
      value: sanitizeModelField(codexHost?.codingModel),
      reasoningEffortKey: 'codingReasoningEffort',
      reasoningEffort: sanitizeReasoningEffort(codexHost?.codingReasoningEffort),
      executorKind: codingExecutor.kind,
    }),
  ]

  const executors: SubagentExecutorResult[] = [
    {
      key: 'reviewExecutor',
      kind: reviewExecutor.kind,
      invalid: reviewExecutor.invalid,
      rawValue: typeof codexHost?.reviewExecutor === 'string' ? codexHost.reviewExecutor : undefined,
    },
    {
      key: 'codingExecutor',
      kind: codingExecutor.kind,
      invalid: codingExecutor.invalid,
      rawValue: typeof codexHost?.codingExecutor === 'string' ? codexHost.codingExecutor : undefined,
    },
  ]

  const raw = codexHost as Record<string, unknown> | undefined
  const removedFields = ['reviewModelB', 'reviewReasoningEffortB'].filter(key => raw?.[key] !== undefined)

  const spawnWarn = spawn.state === 'empty' || spawn.state === 'invalid'
  const fieldWarn = fields.some(f => f.status === 'warn')
  const executorWarn = executors.some(e => e.invalid)
  return {
    status: spawnWarn || fieldWarn || executorWarn ? 'warn' : 'ok',
    executors,
    fields,
    spawnState: spawn.state,
    removedFields,
  }
}

/** 第 7 项检查详情（单行）：逐字段提示 + spawnableModels 形态 WARN */
function buildSubagentModelCheckDetail(result: SubagentModelConfigResult): string {
  const parts: string[] = []

  for (const e of result.executors) {
    parts.push(e.invalid
      ? i18n.t('doctor:modelConfig.warnInvalidExecutor', { key: e.key, value: e.rawValue ?? '' })
      : i18n.t(e.kind === 'main' ? 'doctor:modelConfig.executorMain' : 'doctor:modelConfig.executorSubagent', { key: e.key }))
  }

  for (const f of result.fields) {
    const modelPart = f.value
      ? (f.okKind === 'ineffective'
          ? i18n.t('doctor:modelConfig.warnIneffective', { key: f.key, model: f.value })
          : i18n.t('doctor:modelConfig.okConfigured', { key: f.key, model: f.value }))
      : i18n.t('doctor:modelConfig.okUnset', { key: f.key })
    const reasoningPart = f.reasoningEffort
      ? i18n.t('doctor:modelConfig.okReasoningConfigured', { key: f.reasoningEffortKey, effort: f.reasoningEffort })
      : i18n.t('doctor:modelConfig.okReasoningUnset', { key: f.reasoningEffortKey })
    parts.push(modelPart, reasoningPart)
  }

  for (const key of result.removedFields)
    parts.push(i18n.t('doctor:modelConfig.removedNote', { key }))

  if (result.spawnState === 'empty' || result.spawnState === 'invalid')
    parts.push(i18n.t('doctor:modelConfig.warnInvalid'))
  return parts.join('; ')
}

/** 第 7 项补充提示（附在检查列表后）：agent 模型需额外配置 + 示例验证 prompt */
function buildSubagentModelHintLines(currentModel?: string): string[] {
  const lines = [i18n.t('doctor:modelConfig.agentNeedConfig')]
  if (currentModel)
    lines.push(i18n.t('doctor:modelConfig.inheritNote', { model: currentModel }))
  lines.push(i18n.t('doctor:modelConfig.verifyHint'))
  return lines
}

/** codex 宿主体检：命令（lyx-* SKILL.md）、角色词（ROLE_FILE 目标）、子代理模型配置 */
export async function codexDoctorChecks(ctx: HostInspectContext): Promise<HostDoctorCheck[]> {
  const checks: HostDoctorCheck[] = []

  const cmdCount = (await listPrefixedDirs(ctx.paths.skillsDir, 'lyx-')).length
  checks.push({
    label: 'Commands',
    status: cmdCount > 0 ? 'ok' : 'fail',
    detail: `${cmdCount} installed (${ctx.paths.skillsDir}/lyx-*/)`,
  })

  const roleDir = join(ctx.paths.promptsDir, 'codex')
  const roleFiles = (await fs.pathExists(roleDir))
    ? (await fs.readdir(roleDir)).filter(f => f.endsWith('.md'))
    : []
  checks.push({
    label: 'Roles',
    status: roleFiles.length >= 2 ? 'ok' : roleFiles.length > 0 ? 'warn' : 'fail',
    detail: roleFiles.length > 0 ? roleFiles.join(', ') : `None (${roleDir}/)`,
  })

  // 子代理模型配置（提示型）：留空 = 继承当前会话模型；非空 = 已配置（不做清单强校验）
  const modelCheck = assessSubagentModelConfig(ctx.config as LyConfig['host'])
  checks.push({
    label: i18n.t('doctor:modelConfig.label'),
    status: modelCheck.status,
    detail: buildSubagentModelCheckDetail(modelCheck),
    hints: buildSubagentModelHintLines(await readCodexCurrentModel()),
  })

  return checks
}
