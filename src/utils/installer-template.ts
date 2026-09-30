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
 * 宿主无关的模板变量处理（共享层）：只处理与任何宿主都无关的历史占位符。
 * 宿主专属的占位符与渲染规则由各宿主适配器的 renderTemplate 负责。
 * - {{LITE_MODE_FLAG}}：ly-wrapper 已删除，恒剥离为空
 */
export function injectSharedVariables(content: string): string {
  return content.replace(/\{\{LITE_MODE_FLAG\}\}/g, '')
}

/**
 * 宿主片段注入（共享层机制，不认识任何具体宿主）：共享模板正文中的
 * `{{HOST_FRAGMENT:<name>}}` 替换为 `<fragmentsDir>/<command>/<name>.md` 的内容（去掉末尾换行）。
 * 片段缺失时抛错——宿主差异必须显式提供，SHALL NOT 静默留空。
 */
export function injectHostFragments(content: string, fragmentsDir: string, command: string): string {
  return content.replace(/\{\{HOST_FRAGMENT:([\w-]+)\}\}/g, (_match, name: string) => {
    const file = join(fragmentsDir, command, `${name}.md`)
    if (!fs.existsSync(file))
      throw new Error(`Host fragment missing: ${file}`)
    return fs.readFileSync(file, 'utf-8').replace(/\n+$/, '')
  })
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

  // 模板中的 ~/ 展开为用户 home（如角色词绝对路径）
  return content.replace(/~\//g, `${toForwardSlash(homedir())}/`)
}
