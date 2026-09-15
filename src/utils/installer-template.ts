import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import { dirname, join } from 'pathe'
import { ISSUES_URL } from './package-meta'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Find package root by looking for package.json up the directory tree.
 * Validates that the found root contains a templates/ directory.
 *
 * Increased depth from 5 → 10 to handle deeply nested npm cache paths
 * on Windows (e.g., AppData\Local\npm-cache\_npx\<hash>\node_modules\...).
 */
function findPackageRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(join(dir, 'package.json'))) {
      // Validate: package root must contain templates/ directory
      if (fs.existsSync(join(dir, 'templates'))) {
        return dir
      }
      // Found package.json but no templates/ — might be a parent workspace
      // Continue searching upward
    }
    const parent = dirname(dir)
    if (parent === dir)
      break // Reached filesystem root
    dir = parent
  }

  // Fallback: warn loudly — this is the root cause of "silent install failure"
  console.error(
    `[lycx] ⚠ PACKAGE_ROOT resolution failed: could not find package.json with templates/ directory.\n`
    + `  Start dir: ${startDir}\n`
    + `  Last checked: ${dir}\n`
    + `  This will cause commands/skills/prompts to not be installed.\n`
    + `  Please report this issue at: ${ISSUES_URL}`,
  )
  return startDir
}

export const PACKAGE_ROOT = findPackageRoot(__dirname)

/**
 * Replace template variables in content based on user configuration.
 * codex 单宿主（subagent 多 Agent 模式）：审查/实施模型经"模板指示 + 宿主能力"落实——
 * 模板正文写明各 subagent 取 `codexHost.reviewModel`/`reviewModelB`/`codingModel` 的哪个字段、
 * 未配置回退当前会话模型，无 shell 层模型参数，因此模板不含这些模型的渲染占位符。
 * 此处只处理历史占位符兼容：{{REVIEWER_MODEL}}/{{IMPLEMENTER_MODEL}} 统一渲染为 codex、
 * 实施者条件块折叠、liteMode 标志剥离（Web UI/ly-wrapper 已不存在）。
 */
export function injectConfigVariables(content: string, _config?: { reviewModel?: string }): string {
  let processed = content

  // Reviewer / implementer 占位符（历史模板兼容）：codex 单宿主统一渲染为 codex
  processed = processed.replace(/\{\{REVIEWER_MODEL\}\}/g, 'codex')
  processed = processed.replace(/\{\{IMPLEMENTER_MODEL\}\}/g, 'codex')
  // 实施者条件块（apply.md 历史形态）：单宿主不区分实施者分支，两个分支都折叠
  processed = processed.replace(/\n?<!--\s*LY:IF:IMPLEMENTER_EXTERNAL\s*-->[\s\S]*?<!--\s*LY:ENDIF\s*-->\n?/g, '')
  processed = processed.replace(/\n?<!--\s*LY:IF:IMPLEMENTER_CLAUDE\s*-->[\s\S]*?<!--\s*LY:ENDIF\s*-->\n?/g, '')
  // Lite mode 标志（ly-wrapper 已删除，恒为空）
  processed = processed.replace(/\{\{LITE_MODE_FLAG\}\}/g, '')

  return processed
}

/**
 * Replace ~ paths in template content with absolute paths.
 * Fixes Windows multi-user path resolution issues.
 *
 * IMPORTANT: Always use forward slashes (/) for cross-platform compatibility.
 * Windows Git Bash requires forward slashes in heredoc (backslashes get escaped).
 * PowerShell and CMD also support forward slashes for most commands.
 */
export function replaceHomePathsInTemplate(content: string, _installDir: string): string {
  // IMPORTANT: Always use forward slashes for cross-platform compatibility
  // Git Bash on Windows requires forward slashes in heredoc (backslashes get escaped)
  // PowerShell and CMD also support forward slashes for most commands
  const toForwardSlash = (path: string) => path.replace(/\\/g, '/')

  // codex 单宿主：模板中的 ~/ 展开为用户 home（如 ROLE_FILE: ~/.ly/prompts/...）
  return content.replace(/~\//g, `${toForwardSlash(homedir())}/`)
}
