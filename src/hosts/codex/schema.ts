// ═══════════════════════════════════════════════════════
// codex 宿主配置 schema 相关常量
// ═══════════════════════════════════════════════════════

/** 历史版本写入的宿主配置节名（读取时兼容，写入时归一为 [host]） */
export const CODEX_LEGACY_CONFIG_SECTION = 'codexHost'

/**
 * 内置默认 spawn 可用模型清单（当前环境实证值）：声明 Codex 宿主显式 spawn 子代理可用的模型，
 * `spawnableModels` 未配置、空白或清洗后为空时回退此清单。可用列表随环境漂移，
 * 用户可按实测维护 `spawnableModels` 覆盖（仅作提示参考，不作候选/校验来源）。
 */
export const SPAWNABLE_MODELS_DEFAULT = [
  'gpt-6-astra',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
] as const
