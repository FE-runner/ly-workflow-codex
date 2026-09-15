import type { InstallResult } from '../types'
import type { HostAdapter, HostAdapterContext } from './host-adapters'
import { homedir } from 'node:os'
import fs from 'fs-extra'
import { basename, join } from 'pathe'
import { getLyDir, hasCoexistingLegacyLyProducts, LY_PROMPTS_DIR } from './config'
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
  /** codex 宿主显式 spawn 可用模型清单（LyConfig.codexHost.spawnableModels） */
  spawnableModels?: string[]
  /** 共享角色词目录（默认 ~/.ly/prompts/） */
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
 * → 共享角色词位置 ~/.ly/prompts/codex/（codex 审查命令 ROLE_FILE 指向这里）。
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

/**
 * 旧位置角色词迁移：~/.claude/.ly/prompts/ → ~/.ly/prompts/（内容移动 + 旧目录清理）。
 * 失败不抛出（返回 error 字段，调用方报告但不阻断安装主流程）。
 */
export interface PromptsMigrationResult {
  migrated: boolean
  from?: string
  to?: string
  error?: string
}

export async function migrateLegacyPrompts(options?: { homeDir?: string, promptsDir?: string }): Promise<PromptsMigrationResult> {
  const home = options?.homeDir ?? homedir()
  const oldDir = join(home, '.claude', '.ly', 'prompts')
  const newDir = options?.promptsDir || LY_PROMPTS_DIR
  if (!(await fs.pathExists(oldDir))) {
    return { migrated: false }
  }
  try {
    // 共存场景不搬走：~/.claude/ 下仍有活跃 ly-workflow 产物时，角色词属于他方
    if (await hasCoexistingLegacyLyProducts(home)) {
      console.warn(`[lycx] 检测到 ${join(home, '.claude')} 仍被 ly-workflow 使用（共存场景），跳过角色词迁移，保留他方在用文件`)
      return { migrated: false, from: oldDir, to: newDir }
    }
    await fs.ensureDir(newDir)
    const entries = await fs.readdir(oldDir)
    for (const entry of entries) {
      if (entry === '.DS_Store')
        continue
      const src = join(oldDir, entry)
      const dst = join(newDir, entry)
      // 目标已存在时不覆盖：迁移只在目标缺失时移动（低-8）
      if (await fs.pathExists(dst))
        continue
      await fs.move(src, dst, { overwrite: false })
    }
    await fs.remove(oldDir)
    return { migrated: true, from: oldDir, to: newDir }
  }
  catch (error) {
    return { migrated: false, from: oldDir, to: newDir, error: String(error) }
  }
}

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
      spawnableModels: config.spawnableModels,
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

  // ── Shared assets: role prompts at the neutral location (~/.ly/prompts/) ──
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
  /** 是否清除了共享角色词子目录 ~/.ly/prompts/codex/（父目录与其余子目录保留） */
  removedSharedPrompts: boolean
  /** 共享配置 ~/.ly/config.toml 是否保留（保守策略：一律保留，仅提示） */
  configTomlKept: boolean
  errors: string[]
}

/**
 * Uninstall workflows（codex 单宿主）：
 * - 移除 ~/.agents/skills/ly-* skill 目录，并清理旧安装位 ~/.codex/prompts/ly-*.md 残留
 * - 仅移除共享角色词子目录 ~/.ly/prompts/codex/（本包归属产物；父目录与其余子目录保留）
 * - 保留共享配置 ~/.ly/config.toml（~/.ly 为 ly-workflow 共享命名空间，含 worktrees 等真实数据）
 * - 触发 codex 侧残留清理（AGENTS.md 区块 / config.toml 旧区块 / 旧 agents）
 */
export async function uninstallWorkflows(
  installDir: string,
  options?: {
    legacyCleanupDirs?: { codexDir?: string, homeDir?: string }
    lyPromptsDir?: string
    /** codex skills 安装目录（默认 ~/.agents/skills/，测试可注入） */
    codexSkillsDir?: string
    /** 共享配置目录（默认 ~/.ly，测试可注入） */
    lyDir?: string
  },
): Promise<UninstallResult> {
  const result: UninstallResult = {
    success: true,
    removedSkills: [],
    removedLegacyPrompts: [],
    removedSharedPrompts: false,
    configTomlKept: false,
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

  // ── 共享角色词：仅删本包归属的 ~/.ly/prompts/codex/ 子目录，严禁整删 ~/.ly/prompts/ 或 ~/.ly/ ──
  const sharedPromptsDir = options?.lyPromptsDir || LY_PROMPTS_DIR
  const sharedCodexPromptsDir = join(sharedPromptsDir, 'codex')
  if (await fs.pathExists(sharedCodexPromptsDir)) {
    try {
      await fs.remove(sharedCodexPromptsDir)
      result.removedSharedPrompts = true
    }
    catch (error) {
      result.errors.push(`Failed to remove shared codex prompts directory: ${error}`)
    }
  }

  // ── 共享配置：保守保留 + 提示（~/ly 含 worktrees 等第三方真实数据，卸载不整删、不动 config.toml）──
  const lyDir = options?.lyDir || getLyDir()
  const configToml = join(lyDir, 'config.toml')
  if (await fs.pathExists(configToml)) {
    result.configTomlKept = true
    console.warn('[lycx] 保留共享配置 ~/.ly/config.toml：~/.ly 为 ly-workflow 共享命名空间（含 worktrees/ 等真实数据），卸载仅清理本包归属产物。如需清除该配置，请人工确认后自行处理。')
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
