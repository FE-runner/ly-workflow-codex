import type { HostDoctorCheck, HostInspectContext } from '../../utils/host-adapters'
import fs from 'fs-extra'
import { join } from 'pathe'
import { i18n } from '../../i18n'
import { sanitizeExecutor } from '../../utils/config'
import { listPrefixedDirs } from '../../utils/fs-helpers'
import { CLAUDE_AGENT_DEFINITIONS, renderAgentModelLines } from './adapter'
import { CLAUDE_AGENTS_DIR } from './paths'

// ═══════════════════════════════════════════════════════
// claude 宿主体检项：命令产物、子代理定义、子代理配置（执行者 + 定义侧取值来源 + 偏差）
// ═══════════════════════════════════════════════════════

/** 读取子代理定义 frontmatter 中的 model / effort 行（缺失返回 undefined） */
async function readAgentModelLines(file: string): Promise<string | undefined> {
  if (!(await fs.pathExists(file)))
    return undefined
  const match = (await fs.readFile(file, 'utf-8')).match(/^---\n([\s\S]*?)\n---/)
  if (!match)
    return undefined
  return match[1].split('\n').filter(l => /^(?:model|effort):/.test(l)).map(l => l.trim()).join('\n')
}

/**
 * 子代理定义偏差：已安装定义的 model / effort 与按当前配置渲染的期望值不一致的文件名。
 * 定义缺失不计入偏差（由"子代理定义"体检项报告缺失）。
 */
export async function claudeDefinitionDrift(ctx: HostInspectContext): Promise<string[]> {
  const agentsDir = ctx.paths.agentsDir ?? CLAUDE_AGENTS_DIR
  const config = ctx.config ?? {}
  const drift: string[] = []
  for (const def of CLAUDE_AGENT_DEFINITIONS) {
    const actual = await readAgentModelLines(join(agentsDir, def.file))
    if (actual === undefined)
      continue
    if (actual !== renderAgentModelLines(config[def.modelKey], config[def.effortKey]))
      drift.push(def.file)
  }
  return drift
}

export async function claudeDoctorChecks(ctx: HostInspectContext): Promise<HostDoctorCheck[]> {
  const checks: HostDoctorCheck[] = []
  const agentsDir = ctx.paths.agentsDir ?? CLAUDE_AGENTS_DIR

  const cmdCount = (await listPrefixedDirs(ctx.paths.skillsDir, 'lyx-')).length
  checks.push({
    label: 'Commands',
    status: cmdCount > 0 ? 'ok' : 'fail',
    detail: `${cmdCount} installed (${ctx.paths.skillsDir}/lyx-*/)`,
  })

  const present: string[] = []
  const missing: string[] = []
  for (const def of CLAUDE_AGENT_DEFINITIONS)
    ((await fs.pathExists(join(agentsDir, def.file))) ? present : missing).push(def.file.replace('.md', ''))
  checks.push({
    label: 'Agents',
    status: missing.length === 0 ? 'ok' : present.length > 0 ? 'warn' : 'fail',
    detail: missing.length === 0
      ? `${present.join(', ')} (${agentsDir}/)`
      : i18n.t('doctor:claude.agentsMissing', { list: missing.join(', '), dir: agentsDir }),
  })

  // 子代理配置：执行者字段 + 定义侧取值来源（继承 / 已指定）；未采集模型不算缺失
  const config = ctx.config ?? {}
  const parts: string[] = []
  let warn = false
  for (const key of ['reviewExecutor', 'codingExecutor'] as const) {
    const raw = config[key] as unknown
    const kind = sanitizeExecutor(raw)
    if (!kind && typeof raw === 'string' && raw.trim() !== '') {
      warn = true
      parts.push(i18n.t('doctor:modelConfig.warnInvalidExecutor', { key, value: raw }))
    }
    else {
      parts.push(i18n.t((kind ?? 'main') === 'main' ? 'doctor:modelConfig.executorMain' : 'doctor:modelConfig.executorSubagent', { key }))
    }
  }
  for (const def of CLAUDE_AGENT_DEFINITIONS) {
    const model = config[def.modelKey]?.trim()
    const effort = config[def.effortKey]?.trim()
    parts.push(i18n.t(model ? 'doctor:claude.modelSpecified' : 'doctor:claude.modelInherit', {
      agent: def.file.replace('.md', ''),
      model: model ?? '',
    }) + (effort ? ` effort=${effort}` : ''))
  }
  const drift = await claudeDefinitionDrift(ctx)
  if (drift.length > 0) {
    warn = true
    parts.push(i18n.t('doctor:claude.drift', { list: drift.join(', ') }))
  }
  checks.push({
    label: i18n.t('doctor:claude.label'),
    status: warn ? 'warn' : 'ok',
    detail: parts.join('; '),
  })

  return checks
}
