import fs from 'fs-extra'
import { join } from 'pathe'

/** 由 lyx 命名空间包装并随 lyx 安装、缺失时由 init 补齐的内部 skill。 */
export const BUNDLED_SKILLS = ['lyx-ponytail', 'lyx-code-simplification'] as const

export interface InstallBundledSkillsResult {
  installed: string[]
  errors: string[]
}

/**
 * 安装 lyx 包装 skill：
 * - 缺失时安装
 * - `force=true` 时按当前包内容刷新
 * - 非 force 且目标已存在时保留现状
 */
export async function installBundledSkills(input: {
  templateDir: string
  skillsDir: string
  force: boolean
  render?: (content: string, name: string) => string
}): Promise<InstallBundledSkillsResult> {
  const result: InstallBundledSkillsResult = { installed: [], errors: [] }
  const sourceRoot = join(input.templateDir, 'bundled-skills')

  for (const name of BUNDLED_SKILLS) {
    const destFile = join(input.skillsDir, name, 'SKILL.md')
    if (!input.force && await fs.pathExists(destFile))
      continue

    const srcFile = join(sourceRoot, name, 'SKILL.md')
    try {
      if (!(await fs.stat(srcFile)).isFile())
        throw new Error(`bundled skill template is not a file: ${srcFile}`)
      await fs.ensureDir(join(destFile, '..'))
      const content = await fs.readFile(srcFile, 'utf-8')
      await fs.writeFile(destFile, input.render ? input.render(content, name) : content, 'utf-8')
      result.installed.push(name)
    }
    catch (error) {
      result.errors.push(`Failed to install bundled skill ${name}: ${error}`)
    }
  }

  return result
}

/** 返回宿主 skills 根中缺失或不可读的 lyx 包装 skill。 */
export async function listMissingBundledSkills(skillsDir: string): Promise<string[]> {
  const missing: string[] = []
  for (const name of BUNDLED_SKILLS) {
    try {
      if (!(await fs.stat(join(skillsDir, name, 'SKILL.md'))).isFile())
        missing.push(name)
    }
    catch {
      missing.push(name)
    }
  }
  return missing
}

/** 区分 lyx 生命周期命令与内部包装 skill；命令计数不应包含后者。 */
export function isBundledSkillDirName(name: string): boolean {
  return (BUNDLED_SKILLS as readonly string[]).includes(name)
}
