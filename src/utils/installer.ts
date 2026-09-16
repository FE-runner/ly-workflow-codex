import type { InstallResult } from '../types'
import type { HostAdapter, HostAdapterContext } from './host-adapters'
import { execFileSync } from 'node:child_process'
import fs from 'fs-extra'
import { basename, join } from 'pathe'
import { getLyDir, LY_PROMPTS_DIR } from './config'
import { ADAPTERS } from './host-adapters'
import { getWorkflowById } from './installer-data'
import { injectConfigVariables, PACKAGE_ROOT, replaceHomePathsInTemplate } from './installer-template'
import { AGENTS_SKILLS_DIR, CODE_PROMPTS_DIR } from './package-meta'

// ═══════════════════════════════════════════════════════
// Re-exports — all consumers import from './installer'
// These re-exports preserve backward compatibility.
// ═══════════════════════════════════════════════════════

export {
  getAllCommandIds,
  getCoreCommandIds,
  getWorkflowById,
  getWorkflowConfigs,
  getWorkflowPreset,
  WORKFLOW_PRESETS,
} from './installer-data'
export type { WorkflowPreset } from './installer-data'

export { injectConfigVariables } from './installer-template'

// ═══════════════════════════════════════════════════════
// Install context — shared across sub-functions
// ═══════════════════════════════════════════════════════

/**
 * installWorkflows 的配置入参。
 * promptsDir / codexSkillsDir 供测试注入，缺省用真实 homedir 路径。
 */
export interface InstallWorkflowsConfig {
  /** codex 宿主审查模型（LyConfig.codexHost.reviewModel） */
  reviewModel?: string
  /** 角色词目录（默认 ~/.codex/lyx/prompts/） */
  promptsDir?: string
  /** codex skills 安装目录（默认 ~/.agents/skills/，测试可注入） */
  codexSkillsDir?: string
}

type InstallContext = HostAdapterContext

// ═══════════════════════════════════════════════════════
// Shared file-copy helper
// ═══════════════════════════════════════════════════════

/**
 * Copy .md templates from srcDir → destDir with optional variable injection.
 * Returns list of installed file stems (filename without .md).
 */
async function copyMdTemplates(
  ctx: InstallContext,
  srcDir: string,
  destDir: string,
  options: { inject?: boolean } = {},
): Promise<string[]> {
  const installed: string[] = []
  if (!(await fs.pathExists(srcDir))) {
    // Log warning — helps diagnose "0 prompts installed" issues
    console.error(`[lycx] Template source directory not found: ${srcDir}`)
    return installed
  }

  await fs.ensureDir(destDir)
  const files = await fs.readdir(srcDir)
  for (const file of files) {
    if (!file.endsWith('.md'))
      continue
    const destFile = join(destDir, file)
    if (ctx.force || !(await fs.pathExists(destFile))) {
      let content = await fs.readFile(join(srcDir, file), 'utf-8')
      if (options.inject)
        content = injectConfigVariables(content, ctx.config)
      content = replaceHomePathsInTemplate(content, ctx.installDir)
      await fs.writeFile(destFile, content, 'utf-8')
      installed.push(file.replace('.md', ''))
    }
  }
  return installed
}

// ═══════════════════════════════════════════════════════
// Install sub-steps
// ═══════════════════════════════════════════════════════

/**
 * Install SKILL.md files for the codex host adapter.
 * codex:  templates/skills-codex/<cmd>.md → ~/.agents/skills/ly-<cmd>/SKILL.md
 */
async function installCommandFiles(
  ctx: InstallContext,
  workflowIds: string[],
  adapter: HostAdapter,
): Promise<void> {
  const target = adapter.promptsTarget(ctx)
  const filePrefix = target.filePrefix ?? ''
  await fs.ensureDir(target.targetDir)

  for (const workflowId of workflowIds) {
    const workflow = getWorkflowById(workflowId)
    if (!workflow) {
      ctx.result.errors.push(`Unknown workflow: ${workflowId}`)
      continue
    }

    for (const cmd of workflow.commands) {
      const srcFile = join(target.sourceDir, `${cmd}.md`)
      const destDir = join(target.targetDir, `${filePrefix}${cmd}`)
      const destFile = join(destDir, 'SKILL.md')

      try {
        if (await fs.pathExists(srcFile)) {
          if (ctx.force || !(await fs.pathExists(destFile))) {
            let content = await fs.readFile(srcFile, 'utf-8')
            content = adapter.renderTemplate(content, ctx)
            content = replaceHomePathsInTemplate(content, ctx.installDir)
            await fs.ensureDir(destDir)
            await fs.writeFile(destFile, content, 'utf-8')
            ctx.result.installedCommands.push(cmd)
          }
          else {
            // 非 force 且目标已存在：不覆盖、不计数（修复"假成功"），记入 skipped 供共存提示
            ctx.result.skippedCommands ??= []
            ctx.result.skippedCommands.push(cmd)
          }
        }
        else {
          const placeholder = `---
name: ${filePrefix}${cmd}
description: "${workflow.descriptionEn}"
---

# ${filePrefix}${cmd}

${workflow.description}
`
          await fs.ensureDir(destDir)
          await fs.writeFile(destFile, placeholder, 'utf-8')
          ctx.result.installedCommands.push(cmd)
        }
      }
      catch (error) {
        ctx.result.errors.push(`Failed to install ${cmd}: ${error}`)
        ctx.result.success = false
      }
    }
  }
}

/**
 * Install expert prompt .md files from templates/prompts/codex/
 * → 角色词位置 ~/.codex/lyx/prompts/codex/（codex 审查命令 ROLE_FILE 指向这里）。
 */
async function installPromptFiles(ctx: InstallContext): Promise<void> {
  const srcDir = join(ctx.templateDir, 'prompts', 'codex')
  if (!(await fs.pathExists(srcDir))) {
    ctx.result.errors.push(`Prompts template directory not found: ${srcDir}`)
    return
  }

  try {
    const installed = await copyMdTemplates(
      ctx,
      srcDir,
      join(ctx.promptsDir, 'codex'),
    )
    for (const name of installed) {
      ctx.result.installedPrompts.push(`codex/${name}`)
    }
  }
  catch (error) {
    ctx.result.errors.push(`Failed to install codex prompts: ${error}`)
    ctx.result.success = false
  }
}

// ═══════════════════════════════════════════════════════
// Public API: install / uninstall
// ═══════════════════════════════════════════════════════


export async function installWorkflows(
  workflowIds: string[],
  installDir: string,
  force = false,
  config: InstallWorkflowsConfig = {},
): Promise<InstallResult> {
  const ctx: InstallContext = {
    installDir,
    force,
    config: {
      reviewModel: config.reviewModel,
    },
    templateDir: join(PACKAGE_ROOT, 'templates'),
    promptsDir: config.promptsDir || LY_PROMPTS_DIR,
    codexSkillsDir: config.codexSkillsDir || AGENTS_SKILLS_DIR,
    result: {
      success: true,
      installedCommands: [],
      installedPrompts: [],
      skippedCommands: [],
      errors: [],
      configPath: '',
    },
  }

  // ── Pre-flight: validate template directory exists ──
  // This is the #1 root cause of "silent install failure" on Windows:
  // if PACKAGE_ROOT resolved wrong, templateDir doesn't exist and every
  // sub-step silently returns empty results while reporting success.
  if (!(await fs.pathExists(ctx.templateDir))) {
    const errorMsg = `Template directory not found: ${ctx.templateDir} (PACKAGE_ROOT=${PACKAGE_ROOT}). `
      + `This usually means the npm package is incomplete or the cache is corrupted. `
      + `Try: npm cache clean --force && npx lycx@latest`
    ctx.result.errors.push(errorMsg)
    ctx.result.success = false
    return ctx.result
  }

  // ── Role prompts at the private location (~/.codex/lyx/prompts/) ──
  await fs.ensureDir(ctx.promptsDir)
  await installPromptFiles(ctx)

  // ── codex host install ──
  const adapter = ADAPTERS.codex
  await installCommandFiles(ctx, workflowIds, adapter)
  await adapter.installExtras?.(ctx)
  await adapter.verify?.(ctx)

  // ── Post-flight: validate installation produced results ──
  const skippedCount = ctx.result.skippedCommands?.length ?? 0
  if (ctx.result.installedCommands.length === 0 && ctx.result.errors.length === 0) {
    if (skippedCount > 0) {
      // 全部目标已存在（非 force 跳过）→ 不视为失败，打印共存提示
      console.warn(`[lycx] ${skippedCount} 个命令文件已存在（非 force 跳过，疑似 ly-workflow 旧安装残留），未覆盖。如确认需要覆盖，请用 --force 重装，或人工确认后保留。`)
    }
    else {
      ctx.result.errors.push(
        `No commands were installed (expected ${workflowIds.length}). `
        + `Template dir: ${ctx.templateDir}. `
        + `This may indicate a corrupted package or file permission issue.`,
      )
      ctx.result.success = false
    }
  }

  ctx.result.configPath = ctx.codexSkillsDir
  return ctx.result
}

// ═══════════════════════════════════════════════════════
// Uninstall
// ═══════════════════════════════════════════════════════

export interface UninstallResult {
  success: boolean
  /** 移除的 ~/.agents/skills/lyx-* skill 目录名 */
  removedSkills: string[]
  /** 清理的旧安装位残留 ~/.codex/prompts/ly-*.md 文件名 */
  removedLegacyPrompts: string[]
  /** 是否清除了角色词子目录 ~/.codex/lyx/prompts/codex/（父目录与其余子目录保留） */
  removedPrompts: boolean
  /** 是否因 worktrees/ 下存在未清理的实际 git worktree 而保留了该子目录（无存活 worktree 时为 false，此时 config.toml/prompts/worktrees 均已删除） */
  worktreesKept: boolean
  errors: string[]
}

/**
 * 递归检测某目录树下是否存在有效的 git worktree（候选目录自身或其内部任一目录命中
 * `git rev-parse --git-dir` 即视为存活）。不能只检测第一层子目录——worktree 实际路径可能是
 * `<项目名>/<开发分支名>` 这样的多层路径，`<项目名>` 容器目录本身不是 git 仓库。
 * 读取/执行异常时保守返回 true（视为存在，跳过删除，不冒险误删）。
 */
async function hasLiveWorktree(dir: string): Promise<boolean> {
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  }
  catch {
    return false
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      const stat = await fs.stat(full)
      if (!stat.isDirectory())
        continue
      try {
        execFileSync('git', ['-C', full, 'rev-parse', '--git-dir'], { stdio: 'ignore' })
        return true
      }
      catch {
        // full 本身不是有效 git 目录，继续检测其子目录
      }
      if (await hasLiveWorktree(full))
        return true
    }
    catch {
      return true
    }
  }
  return false
}

/**
 * Uninstall workflows（codex 单宿主）：
 * - 移除 ~/.agents/skills/ly-* skill 目录，并清理旧安装位 ~/.codex/prompts/ly-*.md 残留
 * - 移除角色词子目录 ~/.codex/lyx/prompts/codex/（本包归属产物；父目录与其余子目录保留）
 * - 真正删除 ~/.codex/lyx/config.toml 与 ~/.codex/lyx/prompts/codex/（该目录已是本包私有产物）；
 *   ~/.codex/lyx/worktrees/ 下存在存活 git worktree 时警告并保留该子目录，否则随其余内容一并清理
 * - 触发 codex 侧残留清理（AGENTS.md 区块 / config.toml 旧区块 / 旧 agents）
 */
export async function uninstallWorkflows(
  installDir: string,
  options?: {
    legacyCleanupDirs?: { codexDir?: string, homeDir?: string }
    lyPromptsDir?: string
    /** codex skills 安装目录（默认 ~/.agents/skills/，测试可注入） */
    codexSkillsDir?: string
    /** 配置目录（默认 ~/.codex/lyx，测试可注入） */
    lyDir?: string
  },
): Promise<UninstallResult> {
  const result: UninstallResult = {
    success: true,
    removedSkills: [],
    removedLegacyPrompts: [],
    removedPrompts: false,
    worktreesKept: false,
    errors: [],
  }

  // ── codex 宿主产物：~/.agents/skills/lyx-* skill 目录 ──
  const codexSkillsDir = options?.codexSkillsDir || AGENTS_SKILLS_DIR
  const stubCtx: HostAdapterContext = {
    installDir,
    force: false,
    templateDir: '',
    promptsDir: options?.lyPromptsDir || LY_PROMPTS_DIR,
    codexSkillsDir,
    config: {},
    result: {
      success: true,
      installedCommands: [],
      installedPrompts: [],
      errors: [],
      configPath: '',
    },
  }
  try {
    const files = await ADAPTERS.codex.uninstallList(stubCtx)
    for (const file of files) {
      await fs.remove(file)
      result.removedSkills.push(basename(file))
    }
  }
  catch (error) {
    result.errors.push(`Failed to remove codex skills: ${error}`)
    result.success = false
  }

  // ── 旧安装位残留：~/.agents/skills/ly-* 目录（lyx- 前缀启用前形态）+ ~/.codex/prompts/ly-*.md（v0.2.0 前产物），升级清理 ──
  try {
    if (await fs.pathExists(AGENTS_SKILLS_DIR)) {
      const entries = await fs.readdir(AGENTS_SKILLS_DIR)
      for (const entry of entries) {
        if (!entry.startsWith('ly-'))
          continue
        const full = join(AGENTS_SKILLS_DIR, entry)
        if ((await fs.stat(full)).isDirectory()) {
          await fs.remove(full)
          result.removedLegacyPrompts.push(`${entry}/SKILL.md`)
        }
      }
    }
  }
  catch (error) {
    result.errors.push(`Failed to clean legacy ly-* skills: ${error}`)
  }

  try {
    if (await fs.pathExists(CODE_PROMPTS_DIR)) {
      const files = await fs.readdir(CODE_PROMPTS_DIR)
      for (const file of files) {
        if (!file.startsWith('ly-') || !file.endsWith('.md'))
          continue
        const full = join(CODE_PROMPTS_DIR, file)
        if ((await fs.stat(full)).isFile()) {
          await fs.remove(full)
          result.removedLegacyPrompts.push(file)
        }
      }
    }
  }
  catch (error) {
    result.errors.push(`Failed to clean legacy codex prompts: ${error}`)
  }

  // ── 角色词：仅删本包归属的 ~/.codex/lyx/prompts/codex/ 子目录，父目录与其余子目录保留；本就不存在则跳过，不报错 ──
  const codexPromptsDir = options?.lyPromptsDir || LY_PROMPTS_DIR
  const codexPromptsSubDir = join(codexPromptsDir, 'codex')
  if (await fs.pathExists(codexPromptsSubDir)) {
    try {
      await fs.remove(codexPromptsSubDir)
      result.removedPrompts = true
    }
    catch (error) {
      result.errors.push(`Failed to remove codex prompts directory: ${error}`)
    }
  }

  // ── 配置与 worktrees：config.toml 无条件删除（本就不存在则跳过，不报错）；
  //    worktrees/ 下存在存活 git worktree 则整体保留并警告，否则随 ~/.codex/lyx/ 一并删除 ──
  const lyDir = options?.lyDir || getLyDir()
  const configToml = join(lyDir, 'config.toml')
  const worktreesDir = join(lyDir, 'worktrees')
  let liveWorktree = false
  try {
    if (await fs.pathExists(worktreesDir))
      liveWorktree = await hasLiveWorktree(worktreesDir)
  }
  catch (error) {
    liveWorktree = true
    result.errors.push(`Worktree liveness check failed, conservatively kept worktrees/: ${error}`)
  }

  if (liveWorktree) {
    result.worktreesKept = true
    try {
      if (await fs.pathExists(configToml))
        await fs.remove(configToml)
    }
    catch (error) {
      result.errors.push(`Failed to remove config.toml: ${error}`)
    }
    console.warn('[lycx] 检测到 ~/.codex/lyx/worktrees/ 下存在未清理的实际 git worktree，已保留该目录；请先运行 `lycx worktree remove` 清理后再手动删除 ~/.codex/lyx/')
  }
  else {
    try {
      await fs.remove(lyDir)
    }
    catch (error) {
      result.errors.push(`Failed to remove ~/.codex/lyx/: ${error}`)
    }
  }

  // 残留清理：回收 codex 侧旧包残留（AGENTS.md 区块 / config.toml 旧区块 / 旧 agents，非阻断）
  try {
    const { cleanupLegacyArtifacts, reportCleanupResult } = await import('./legacy-cleanup')
    reportCleanupResult(await cleanupLegacyArtifacts(options?.legacyCleanupDirs))
  }
  catch (error) {
    result.errors.push(`Legacy cleanup failed (non-blocking): ${error}`)
  }

  return result
}
