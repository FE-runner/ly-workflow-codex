import type { InstallResult } from '../types'
import type { HostAdapter, HostAdapterConfig, HostAdapterContext, HostId, HostPaths, HostUninstallReport } from './host-adapters'
import fs from 'fs-extra'
import { basename, join } from 'pathe'
import { FALLBACK_HOSTS, getAdapter } from './host-adapters'
import { getWorkflowById } from './installer-data'
import { PACKAGE_ROOT, replaceHomePathsInTemplate } from './installer-template'

// ═══════════════════════════════════════════════════════
// Re-exports — all consumers import from './installer'
// These re-exports preserve backward compatibility.
// ═══════════════════════════════════════════════════════

export { injectConfigVariables } from '../hosts/codex/adapter'
export {
  getAllCommandIds,
  getCoreCommandIds,
  getWorkflowById,
  getWorkflowConfigs,
  getWorkflowPreset,
  WORKFLOW_PRESETS,
} from './installer-data'

export type { WorkflowPreset } from './installer-data'

// ═══════════════════════════════════════════════════════
// Install context — shared across sub-functions
// ═══════════════════════════════════════════════════════

/**
 * installWorkflows 的配置入参。
 * hostPaths 供测试注入，缺省用各宿主适配器的默认路径。
 */
export interface InstallWorkflowsConfig {
  /** 本次安装的宿主集合；缺省为兜底集合（FALLBACK_HOSTS） */
  hosts?: HostId[]
  /** 各宿主的模板渲染配置（宿主配置节切片） */
  hostConfig?: Partial<Record<HostId, HostAdapterConfig>>
  /** 各宿主的产物路径覆盖（测试注入） */
  hostPaths?: Partial<Record<HostId, Partial<HostPaths>>>
}

type InstallContext = HostAdapterContext

function emptyResult(): InstallResult {
  return {
    success: true,
    installedCommands: [],
    installedPrompts: [],
    skippedCommands: [],
    errors: [],
    configPath: '',
  }
}

/** 解析某宿主的产物路径：适配器默认值 + 调用方覆盖 */
export function resolveHostPaths(adapter: HostAdapter, overrides?: Partial<HostPaths>): HostPaths {
  return { ...adapter.defaultPaths(), ...(overrides ?? {}) }
}

// ═══════════════════════════════════════════════════════
// Install sub-steps
// ═══════════════════════════════════════════════════════

/**
 * Install SKILL.md files for one host adapter:
 * <sourceDir>/<cmd>.md → <targetDir>/<filePrefix><cmd>/SKILL.md
 */
async function installCommandFiles(
  ctx: InstallContext,
  workflowIds: string[],
  adapter: HostAdapter,
): Promise<void> {
  const target = adapter.promptsTarget(ctx)
  const filePrefix = target.filePrefix ?? ''

  // 发布包缺少命令模板目录：如实报告失败，SHALL NOT 用占位 SKILL.md 冒充安装成功
  if (!(await fs.pathExists(target.sourceDir))) {
    ctx.result.errors.push(`Command template directory not found: ${target.sourceDir} (incomplete package?)`)
    ctx.result.success = false
    return
  }

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
            content = adapter.renderTemplate(content, ctx, cmd)
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

/** 单宿主安装：命令产物 → 宿主附加产物 → 安装后校验 → 产出校验 */
async function installHost(
  adapter: HostAdapter,
  workflowIds: string[],
  base: { installDir: string, force: boolean, templateDir: string },
  config: InstallWorkflowsConfig,
): Promise<InstallResult> {
  const ctx: InstallContext = {
    ...base,
    paths: resolveHostPaths(adapter, config.hostPaths?.[adapter.id]),
    config: config.hostConfig?.[adapter.id] ?? {},
    result: emptyResult(),
  }

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

  ctx.result.configPath = ctx.paths.skillsDir
  return ctx.result
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
  const hosts = config.hosts && config.hosts.length > 0 ? [...new Set(config.hosts)] : FALLBACK_HOSTS
  const templateDir = join(PACKAGE_ROOT, 'templates')
  const result = emptyResult()

  // ── Pre-flight: validate template directory exists ──
  // This is the #1 root cause of "silent install failure" on Windows:
  // if PACKAGE_ROOT resolved wrong, templateDir doesn't exist and every
  // sub-step silently returns empty results while reporting success.
  if (!(await fs.pathExists(templateDir))) {
    const errorMsg = `Template directory not found: ${templateDir} (PACKAGE_ROOT=${PACKAGE_ROOT}). `
      + `This usually means the npm package is incomplete or the cache is corrupted. `
      + `Try: npm cache clean --force && npx lycx@latest`
    result.errors.push(errorMsg)
    result.success = false
    return result
  }

  // ── 逐宿主安装：结果按宿主记录，聚合字段为全部宿主之和 ──
  result.hosts = {}
  for (const id of hosts) {
    const hostResult = await installHost(getAdapter(id), workflowIds, { installDir, force, templateDir }, config)
    result.hosts[id] = hostResult
    result.success &&= hostResult.success
    result.installedCommands.push(...hostResult.installedCommands)
    result.installedPrompts.push(...hostResult.installedPrompts)
    result.skippedCommands!.push(...(hostResult.skippedCommands ?? []))
    result.errors.push(...hostResult.errors)
    if (!result.configPath)
      result.configPath = hostResult.configPath
  }

  return result
}

// ═══════════════════════════════════════════════════════
// Uninstall
// ═══════════════════════════════════════════════════════

export interface UninstallResult extends HostUninstallReport {
  /** 按宿主分别记录（自 add-claude-host 起）；上面的聚合字段为全部宿主之和 */
  hosts?: Partial<Record<HostId, HostUninstallReport>>
}

export interface UninstallWorkflowsOptions {
  /** 本次卸载的宿主集合；缺省为兜底集合（FALLBACK_HOSTS） */
  hosts?: HostId[]
  /** 各宿主的产物路径覆盖（测试注入） */
  hostPaths?: Partial<Record<HostId, Partial<HostPaths>>>
  legacyCleanupDirs?: { codexDir?: string, homeDir?: string }
}

function emptyUninstallReport(): HostUninstallReport {
  return { success: true, removedSkills: [], removedLegacyPrompts: [], removedPrompts: false, errors: [] }
}

/**
 * Uninstall workflows（按宿主逐个卸载）：
 * - 移除该宿主的命令产物（适配器 uninstallList）
 * - 执行宿主专属附加卸载（旧安装位残留、角色词、子代理定义等）
 * - 删除本包在该宿主下的私有目录（lyDir）——该目录是本包私有产物，可无条件删除
 * - 不碰 worktrees/：worktree 目录沿用共用的 ~/.ly/worktrees/，卸载不删除
 */
export async function uninstallWorkflows(
  installDir: string,
  options: UninstallWorkflowsOptions = {},
): Promise<UninstallResult> {
  const hosts = options.hosts && options.hosts.length > 0 ? [...new Set(options.hosts)] : FALLBACK_HOSTS
  const result: UninstallResult = { ...emptyUninstallReport(), hosts: {} }

  for (const id of hosts) {
    const adapter = getAdapter(id)
    const report = emptyUninstallReport()
    const ctx: HostAdapterContext = {
      installDir,
      force: false,
      templateDir: '',
      paths: resolveHostPaths(adapter, options.hostPaths?.[id]),
      config: {},
      result: emptyResult(),
    }

    // ── 命令产物 ──
    try {
      for (const file of await adapter.uninstallList(ctx)) {
        await fs.remove(file)
        report.removedSkills.push(basename(file))
      }
    }
    catch (error) {
      report.errors.push(`Failed to remove ${id} skills: ${error}`)
      report.success = false
    }

    // ── 宿主专属附加卸载 ──
    await adapter.uninstallExtras?.(ctx, report, { legacyCleanupDirs: options.legacyCleanupDirs })

    // ── 本包私有目录：整体删除（worktrees/ 不在此处，卸载不碰） ──
    try {
      await fs.remove(ctx.paths.lyDir)
    }
    catch (error) {
      report.errors.push(`Failed to remove ${ctx.paths.lyDir}: ${error}`)
      report.success = false
    }

    result.hosts![id] = report
    result.success &&= report.success
    result.removedSkills.push(...report.removedSkills)
    result.removedLegacyPrompts.push(...report.removedLegacyPrompts)
    result.removedPrompts ||= report.removedPrompts
    result.errors.push(...report.errors)
  }

  return result
}
