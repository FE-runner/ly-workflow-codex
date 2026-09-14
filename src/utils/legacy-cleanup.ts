import { readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
/**
 * legacy-cleanup — codex 侧残留清理。
 *
 * 清理范围（存在才清，不存在跳过；单项失败记录不阻断）：
 * - ~/.codex/AGENTS.md 中 LY 管理区块
 * - ~/.codex/config.toml 中旧版 ly 写入的注释行与 [features.multi_agent_v2] 表
 * - ~/.codex/agents/ly-*.toml 旧代理残留
 *
 * 目标目录均可注入（codexDir/homeDir），默认基于真实 homedir() 计算以便测试隔离。
 */
import fs from 'fs-extra'

export interface CleanupResult {
  cleaned: string[]
  skipped: string[]
  failed: string[]
}

export interface CleanupOptions {
  codexDir?: string
  homeDir?: string
}

interface Dirs {
  codexDir: string
}

async function removePath(target: string): Promise<void> {
  await fs.remove(target)
}

/** AGENTS.md：剥 LY 管理区块（兼容 `<!-- LY:START` 与 `<!-- LY:START --` 两种起始标记） */
async function cleanupCodexAgentsMd(result: CleanupResult, dirs: Dirs): Promise<void> {
  const filePath = join(dirs.codexDir, 'AGENTS.md')
  if (!(await fs.pathExists(filePath))) {
    result.skipped.push('~/.codex/AGENTS.md (not found)')
    return
  }
  try {
    const content = await readFile(filePath, 'utf-8')
    const stripped = content.replace(/<!-- LY:START[\s\S]*?-- LY:END -->\n?/g, '')
    if (stripped !== content) {
      const tmpPath = `${filePath}.tmp`
      await writeFile(tmpPath, stripped)
      await fs.move(tmpPath, filePath, { overwrite: true })
      result.cleaned.push('~/.codex/AGENTS.md (LY blocks stripped)')
    }
    else {
      result.skipped.push('~/.codex/AGENTS.md (no LY blocks)')
    }
  }
  catch (error) {
    result.failed.push(`~/.codex/AGENTS.md: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * config.toml 旧区块：精确行处理——
 * 仅当文件含 ly 写入标记（`# ly-workflow ...` / `# Installed by: npx ly-workflow...` /
 * `# Added by ly-workflow-codex ...` 注释行）时才动文件——
 * 删文件头部 ly 标记注释行 + `[features.multi_agent_v2]` 表（含其后至下一个 `[` 或 EOF 的键值行）。
 * 无标记则整文件跳过并报告，绝不按表名盲删（表可能是其他工具/用户写的）。
 */
async function cleanupCodexConfigTomlLyBlocks(result: CleanupResult, dirs: Dirs): Promise<void> {
  const filePath = join(dirs.codexDir, 'config.toml')
  if (!(await fs.pathExists(filePath))) {
    result.skipped.push('~/.codex/config.toml (not found)')
    return
  }
  try {
    const content = await readFile(filePath, 'utf-8')
    const hasLyMarker = /^\s*#\s*(?:ly-workflow\b|Installed by: npx ly-workflow\b|Added by ly-workflow-codex\b)/m.test(content)
    if (!hasLyMarker) {
      result.skipped.push('~/.codex/config.toml (no ly-workflow write markers)')
      return
    }
    const lines = content.split('\n')
    const out: string[] = []
    let removed = false
    let inLyTable = false
    let headerZone = true // 仅文件头部（首个非空非注释行之前）匹配 ly-workflow 注释行
    for (const line of lines) {
      const trimmed = line.trim()
      if (headerZone && trimmed.startsWith('#')) {
        if (/^#\s*ly-workflow/.test(trimmed) || /^#\s*Installed by: npx ly-workflow/.test(trimmed) || /^#\s*Added by ly-workflow-codex/.test(trimmed)) {
          removed = true
          continue
        }
        out.push(line)
        continue
      }
      if (trimmed !== '')
        headerZone = false
      if (inLyTable) {
        if (trimmed.startsWith('[')) {
          inLyTable = false // 下一个表开始，该行按正常逻辑处理
        }
        else {
          removed = true
          continue
        }
      }
      if (trimmed.startsWith('[features.multi_agent_v2]')) {
        removed = true
        inLyTable = true
        continue
      }
      out.push(line)
    }
    if (removed) {
      const tmpPath = `${filePath}.tmp`
      await writeFile(tmpPath, out.join('\n'))
      await fs.move(tmpPath, filePath, { overwrite: true })
      result.cleaned.push('~/.codex/config.toml (LY blocks stripped)')
    }
    else {
      result.skipped.push('~/.codex/config.toml (no LY blocks)')
    }
  }
  catch (error) {
    result.failed.push(`~/.codex/config.toml: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 旧 codex agents 残留（~/.codex/agents/ly-*.toml） */
async function cleanupCodexAgents(result: CleanupResult, dirs: Dirs): Promise<void> {
  const agentsDir = join(dirs.codexDir, 'agents')
  if (!(await fs.pathExists(agentsDir))) {
    result.skipped.push('~/.codex/agents (not found)')
    return
  }
  try {
    let lyFiles = 0
    for (const file of await readdir(agentsDir)) {
      if (!(file.startsWith('ly-') && file.endsWith('.toml')))
        continue
      lyFiles++
      const filePath = join(agentsDir, file)
      const content = await readFile(filePath, 'utf-8')
      // 仅删含 ly 写入标记的 ly-*.toml；无标记（用户自定义同名文件）跳过并报告
      if (!/ly-workflow|Installed by: npx ly-workflow|Added by ly-workflow-codex/.test(content)) {
        result.skipped.push(`~/.codex/agents/${file} (no ly-workflow write marker)`)
        continue
      }
      try {
        await removePath(join(agentsDir, file))
        result.cleaned.push(`~/.codex/agents/${file}`)
      }
      catch (error) {
        result.failed.push(`~/.codex/agents/${file}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (lyFiles === 0)
      result.skipped.push('~/.codex/agents (no ly-*.toml)')
  }
  catch (error) {
    result.failed.push(`~/.codex/agents: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function cleanupLegacyArtifacts(options?: CleanupOptions): Promise<CleanupResult> {
  const result: CleanupResult = { cleaned: [], skipped: [], failed: [] }
  const dirs: Dirs = {
    codexDir: options?.codexDir ?? join(homedir(), '.codex'),
  }

  await cleanupCodexAgentsMd(result, dirs)
  await cleanupCodexConfigTomlLyBlocks(result, dirs)
  await cleanupCodexAgents(result, dirs)

  return result
}

/** 汇总打印清理结果（供 update/uninstall/init 主流程调用）：清理/跳过/失败 逐项报告 */
export function reportCleanupResult(result: CleanupResult): void {
  if (result.cleaned.length > 0) {
    console.log(`  ✓ 残留清理 cleaned: ${result.cleaned.length} 项`)
    for (const item of result.cleaned) console.log(`    - ${item}`)
  }
  if (result.skipped.length > 0) {
    console.log(`  - 残留清理 skipped: ${result.skipped.length} 项（不存在或无需处理）`)
    for (const item of result.skipped) console.log(`    - ${item}`)
  }
  if (result.failed.length > 0) {
    console.log('  ⚠ 残留清理失败（不阻断）:')
    for (const item of result.failed) console.log(`    - ${item}`)
  }
}
