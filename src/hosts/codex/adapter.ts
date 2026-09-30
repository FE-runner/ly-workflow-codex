import type { HostAdapter, HostAdapterConfig, HostAdapterContext } from '../../utils/host-adapters'
import fs from 'fs-extra'
import { basename, join } from 'pathe'
import { listPrefixedDirs, listPrefixedFiles } from '../../utils/fs-helpers'
import { injectHostFragments, injectSharedVariables, replaceHomePathsInTemplate } from '../../utils/installer-template'
import { codexDoctorChecks } from './doctor'
import { AGENTS_SKILLS_DIR, CODE_PROMPTS_DIR, CODEX_HOME_DIR, LY_DIR, PROMPTS_DIR } from './paths'
import { CODEX_LEGACY_CONFIG_SECTION, SPAWNABLE_MODELS_DEFAULT } from './schema'

// ═══════════════════════════════════════════════════════
// codex 宿主模板渲染
// ═══════════════════════════════════════════════════════

/**
 * codex 宿主的历史占位符兼容渲染（由共享层迁入）：
 * {{REVIEWER_MODEL}}/{{IMPLEMENTER_MODEL}} 统一渲染为 codex、实施者条件块折叠、
 * {{SPAWNABLE_MODELS_DEFAULT}} 渲染为内置默认清单文本（当前模板正文已不再引用，保留兼容旧模板）。
 */
function renderCodexLegacyPlaceholders(content: string): string {
  let processed = content
  processed = processed.replace(/\{\{REVIEWER_MODEL\}\}/g, 'codex')
  processed = processed.replace(/\{\{IMPLEMENTER_MODEL\}\}/g, 'codex')
  processed = processed.replace(/\n?<!--\s*LY:IF:IMPLEMENTER_EXTERNAL\s*-->[\s\S]*?<!--\s*LY:ENDIF\s*-->\n?/g, '')
  processed = processed.replace(/\n?<!--\s*LY:IF:IMPLEMENTER_CLAUDE\s*-->[\s\S]*?<!--\s*LY:ENDIF\s*-->\n?/g, '')
  processed = processed.replace(/\{\{SPAWNABLE_MODELS_DEFAULT\}\}/g, SPAWNABLE_MODELS_DEFAULT.join(' / '))
  return processed
}

/**
 * @deprecated 历史入口：共享变量 + codex 历史占位符渲染。新代码经各宿主适配器的 renderTemplate 渲染。
 */
export function injectConfigVariables(content: string, _config?: { reviewModel?: string }): string {
  return renderCodexLegacyPlaceholders(injectSharedVariables(content))
}

/**
 * codex 宿主模板渲染：共享变量与历史占位符之后追加 {{REVIEW_MODEL}} 处理。
 * - 已配置 reviewModel → 全量替换为模型名
 * - 未配置 → 剥离 " -m {{REVIEW_MODEL}}" 参数（回退当前会话模型），其余占位渲染为空串
 *
 * 模型指定经"模板指示 + 宿主能力"落实——模板正文写明审查/coding subagent 的模型取哪个字段、
 * 未配置或空白回退当前会话模型，由宿主 spawn 能力执行，不依赖 shell 层模型参数；
 * {{REVIEW_MODEL}} 处理仅保留给历史模板/旧安装位升级残留的兼容渲染。
 */
export function renderCodexTemplate(content: string, config: HostAdapterConfig): string {
  let processed = injectConfigVariables(content, config)
  const model = config.reviewModel?.trim() || ''
  if (model) {
    processed = processed.replace(/\{\{REVIEW_MODEL\}\}/g, model)
  }
  else {
    processed = processed.replace(/ -m \{\{REVIEW_MODEL\}\}/g, '')
    processed = processed.replace(/\{\{REVIEW_MODEL\}\}/g, '')
  }
  return processed
}

/** 模板中展示的配置文件路径（安装期 ~/ 再展开为绝对路径） */
const CODEX_CONFIG_FILE_DISPLAY = '~/.codex/lyx/config.toml'

// ═══════════════════════════════════════════════════════
// codex adapter — SKILL.md 形态（Codex 官方 skill 机制）
// ═══════════════════════════════════════════════════════

/** codex 版审查命令模板依赖的角色词（ROLE_FILE 绝对路径目标） */
const CODEX_ROLE_FILE_TARGETS = ['reviewer.md', 'plan-reviewer.md']

/**
 * 角色词安装：templates/hosts/codex/prompts/*.md → <promptsDir>/codex/
 * （codex 审查命令 ROLE_FILE 以绝对路径指向这里）。
 */
async function installCodexRolePrompts(ctx: HostAdapterContext): Promise<void> {
  const srcDir = join(ctx.templateDir, 'hosts', 'codex', 'prompts')
  if (!(await fs.pathExists(srcDir))) {
    ctx.result.errors.push(`Prompts template directory not found: ${srcDir}`)
    return
  }

  try {
    const destDir = join(ctx.paths.promptsDir, 'codex')
    await fs.ensureDir(destDir)
    for (const file of await fs.readdir(srcDir)) {
      if (!file.endsWith('.md'))
        continue
      const destFile = join(destDir, file)
      if (ctx.force || !(await fs.pathExists(destFile))) {
        const content = replaceHomePathsInTemplate(await fs.readFile(join(srcDir, file), 'utf-8'), ctx.installDir)
        await fs.writeFile(destFile, content, 'utf-8')
        ctx.result.installedPrompts.push(`codex/${file.replace('.md', '')}`)
      }
    }
  }
  catch (error) {
    ctx.result.errors.push(`Failed to install codex prompts: ${error}`)
    ctx.result.success = false
  }
}

export const codexAdapter: HostAdapter = {
  id: 'codex',

  defaultPaths: () => ({
    skillsDir: AGENTS_SKILLS_DIR,
    lyDir: LY_DIR,
    promptsDir: PROMPTS_DIR,
  }),

  detectDir: () => CODEX_HOME_DIR,

  legacyConfigSections: [CODEX_LEGACY_CONFIG_SECTION],

  commandPrefix: '@',

  openspecTool: 'codex',

  openspecSkillRoots: cwd => [
    { scope: 'project', path: join(cwd, '.agents', 'skills') },
    { scope: 'project', path: join(cwd, '.codex', 'skills') },
    { scope: 'global', path: AGENTS_SKILLS_DIR },
    { scope: 'global', path: join(CODEX_HOME_DIR, 'skills') },
  ],

  promptsTarget: ctx => ({
    sourceDir: join(ctx.templateDir, 'skills'),
    targetDir: ctx.paths.skillsDir,
    filePrefix: 'lyx-',
  }),

  renderTemplate: (content, ctx, command) => renderCodexTemplate(
    injectHostFragments(content, join(ctx.templateDir, 'hosts', 'codex', 'fragments'), command)
      .replace(/\{\{LYX_CONFIG_FILE\}\}/g, CODEX_CONFIG_FILE_DISPLAY)
      .replace(/\{\{HOST_ID\}\}/g, 'codex'),
    ctx.config,
  ),

  uninstallList: async ctx => listPrefixedDirs(ctx.paths.skillsDir, 'lyx-'),

  installExtras: installCodexRolePrompts,

  verify: async (ctx) => {
    // codex 版模板 ROLE_FILE 以绝对路径指向私有位置（不建软链）——
    // 角色词缺失时审查命令无法工作，报安装错误
    for (const file of CODEX_ROLE_FILE_TARGETS) {
      const target = join(ctx.paths.promptsDir, 'codex', file)
      if (!(await fs.pathExists(target))) {
        ctx.result.errors.push(`codex ROLE_FILE target missing: ${target} (role prompts not installed)`)
        ctx.result.success = false
      }
    }
  },

  doctorChecks: codexDoctorChecks,

  // update 前备份：lyx-* 命令目录 + 旧 ly-* 开发形态残留 + 旧安装位 ~/.codex/prompts/ly-*.md
  backupList: async ctx => [
    ...(await listPrefixedDirs(ctx.paths.skillsDir, 'lyx-')),
    ...(await listPrefixedDirs(ctx.paths.skillsDir, 'ly-')),
    ...(await listPrefixedFiles(CODE_PROMPTS_DIR, 'ly-', '.md')),
  ],

  // 与 uninstallList + uninstallExtras 的实际动作一一对应（确认提示 SHALL 反映完整范围）
  describeUninstall: paths => [
    `删除 ${paths.skillsDir}/lyx-*/`,
    `删除旧安装残留 ${paths.skillsDir}/ly-*/ 与 ${CODE_PROMPTS_DIR}/ly-*.md`,
    `删除角色词 ${paths.promptsDir}/codex/`,
    `删除私有目录 ${paths.lyDir}/`,
    `修改 ${CODEX_HOME_DIR}/AGENTS.md（剥离 LY 管理区块）`,
    `修改 ${CODEX_HOME_DIR}/config.toml（移除旧版 ly 写入的注释行与 [features.multi_agent_v2]）`,
    `删除 ${CODEX_HOME_DIR}/agents/ly-*.toml 中含 ly 写入标记的旧代理（无标记的同名文件保留）`,
  ],

  uninstallExtras: async (ctx, report, options) => {
    // 旧安装位残留：<skillsDir>/ly-* 目录（lyx- 前缀启用前形态）
    try {
      for (const full of await listPrefixedDirs(ctx.paths.skillsDir, 'ly-')) {
        await fs.remove(full)
        report.removedLegacyPrompts.push(`${basename(full)}/SKILL.md`)
      }
    }
    catch (error) {
      report.errors.push(`Failed to clean legacy ly-* skills: ${error}`)
      report.success = false
    }

    // 旧安装位残留：~/.codex/prompts/ly-*.md（v0.2.0 前产物）
    try {
      for (const full of await listPrefixedFiles(CODE_PROMPTS_DIR, 'ly-', '.md')) {
        await fs.remove(full)
        report.removedLegacyPrompts.push(basename(full))
      }
    }
    catch (error) {
      report.errors.push(`Failed to clean legacy codex prompts: ${error}`)
      report.success = false
    }

    // 角色词：仅删本包归属的 <promptsDir>/codex/ 子目录；本就不存在则跳过，不报错
    const codexPromptsSubDir = join(ctx.paths.promptsDir, 'codex')
    if (await fs.pathExists(codexPromptsSubDir)) {
      try {
        await fs.remove(codexPromptsSubDir)
        report.removedPrompts = true
      }
      catch (error) {
        report.errors.push(`Failed to remove codex prompts directory: ${error}`)
        report.success = false
      }
    }

    // 残留清理：回收 codex 侧旧包残留（AGENTS.md 区块 / config.toml 旧区块 / 旧 agents，非阻断）
    try {
      const { cleanupLegacyArtifacts, reportCleanupResult } = await import('./legacy-cleanup')
      reportCleanupResult(await cleanupLegacyArtifacts(options.legacyCleanupDirs))
    }
    catch (error) {
      report.errors.push(`Legacy cleanup failed (non-blocking): ${error}`)
    }
  },
}
