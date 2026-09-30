import type { HostAdapter, HostAdapterConfig, HostAdapterContext } from '../../utils/host-adapters'
import fs from 'fs-extra'
import { basename, join } from 'pathe'
import { sanitizeModelField, sanitizeReasoningEffort } from '../../utils/config'
import { listPrefixedDirs, listPrefixedFiles } from '../../utils/fs-helpers'
import { injectHostFragments, injectSharedVariables } from '../../utils/installer-template'
import { CLAUDE_AGENTS_DIR, CLAUDE_HOME_DIR, CLAUDE_LY_DIR, CLAUDE_PROMPTS_DIR, CLAUDE_SKILLS_DIR } from './paths'

// ═══════════════════════════════════════════════════════
// claude 宿主（Claude Code）适配器
// - 命令：~/.claude/skills/lyx-<cmd>/SKILL.md
// - 子代理定义：~/.claude/agents/lyx-*.md（始终安装，执行者只决定是否使用）
// - 不写 Claude Code 自身的 provider / settings 配置
// ═══════════════════════════════════════════════════════

/** 模板中展示的配置文件路径（安装期 ~/ 再展开为绝对路径） */
const CLAUDE_CONFIG_FILE_DISPLAY = '~/.claude/lyx/config.toml'

/** 子代理定义 → 对应的模型 / 推理档配置字段 */
export const CLAUDE_AGENT_DEFINITIONS = [
  { file: 'lyx-plan-reviewer.md', modelKey: 'reviewModel', effortKey: 'reviewReasoningEffort' },
  { file: 'lyx-reviewer.md', modelKey: 'reviewModel', effortKey: 'reviewReasoningEffort' },
  { file: 'lyx-implementer.md', modelKey: 'codingModel', effortKey: 'codingReasoningEffort' },
] as const

/**
 * 命令调用写法改写（渲染期落实，模板正文不做宿主条件块）：
 * - `@lyx-<cmd>` → `/lyx-<cmd>`（Claude Code 的 skill 调用语法）
 * - `@openspec-<skill>` → `openspec-<skill>`（去掉 codex 的 mention 前缀，保留 skill 名）：
 *   委托语义是"读取该 skill 并按其流程执行"，Claude 侧由 Skill 工具调用同名 skill（调用方式写在
 *   claude 宿主的 skill 调用说明片段中）；SHALL NOT 改写为 OpenSpec 的 `/opsx:*` 命令
 *   （依赖前置检查只校验 skill 的可发现性）
 */
export function rewriteClaudeInvocations(content: string): string {
  return content
    // 调用方式说明行：codex 的 mention 语法 → slash 命令语法，并说明 OpenSpec skill 的调用方式
    .replace(
      /^> 调用方式：`@(lyx-[\w-]+)` mention 后跟随的自然语言即参数（如 `@lyx-[\w-]+` 带需求描述\/选项）；无参数时直接 `@lyx-[\w-]+`。$/gm,
      '> 调用方式：`/$1` 后跟随的自然语言即参数（如 `/$1 <需求描述/选项>`）；无参数时直接 `/$1`。正文中委托的 `openspec-*` skill 经 Skill 工具调用。',
    )
    .replace(/@lyx-/g, '/lyx-')
    .replace(/@openspec-([\w-]+)/g, 'openspec-$1')
}

/**
 * 子代理定义 frontmatter 的模型 / 推理档行：未配置、空白或非字符串（手改配置写错类型）
 * → `model: inherit`，不写 effort；SHALL NOT 因取值类型异常而抛错。
 */
export function renderAgentModelLines(model?: unknown, effort?: unknown): string {
  const lines = [`model: ${sanitizeModelField(model) ?? 'inherit'}`]
  const cleanedEffort = sanitizeReasoningEffort(effort)
  if (cleanedEffort)
    lines.push(`effort: ${cleanedEffort}`)
  return lines.join('\n')
}

/** 渲染单个子代理定义 */
export function renderAgentDefinition(content: string, config: HostAdapterConfig, def: typeof CLAUDE_AGENT_DEFINITIONS[number]): string {
  return content.replace(/\{\{AGENT_MODEL_LINES\}\}/g, renderAgentModelLines(config[def.modelKey], config[def.effortKey]))
}

export function renderClaudeTemplate(content: string, fragmentsDir: string, command: string): string {
  const withFragments = injectHostFragments(content, fragmentsDir, command)
    .replace(/\{\{LYX_CONFIG_FILE\}\}/g, CLAUDE_CONFIG_FILE_DISPLAY)
    .replace(/\{\{HOST_ID\}\}/g, 'claude')
  return rewriteClaudeInvocations(injectSharedVariables(withFragments))
}

/** 子代理定义安装：templates/hosts/claude/agents/*.md → <agentsDir>/（始终覆盖渲染，保证与当前配置一致） */
async function installAgentDefinitions(ctx: HostAdapterContext): Promise<void> {
  const srcDir = join(ctx.templateDir, 'hosts', 'claude', 'agents')
  const agentsDir = ctx.paths.agentsDir ?? CLAUDE_AGENTS_DIR
  if (!(await fs.pathExists(srcDir))) {
    ctx.result.errors.push(`Agent definitions template directory not found: ${srcDir}`)
    ctx.result.success = false
    return
  }
  try {
    await fs.ensureDir(agentsDir)
    for (const def of CLAUDE_AGENT_DEFINITIONS) {
      const src = join(srcDir, def.file)
      if (!(await fs.pathExists(src))) {
        ctx.result.errors.push(`Agent definition template missing: ${src}`)
        ctx.result.success = false
        continue
      }
      const rendered = renderAgentDefinition(await fs.readFile(src, 'utf-8'), ctx.config, def)
      await fs.writeFile(join(agentsDir, def.file), rendered, 'utf-8')
      ctx.result.installedPrompts.push(`claude/agents/${def.file.replace('.md', '')}`)
    }
  }
  catch (error) {
    ctx.result.errors.push(`Failed to install claude agent definitions: ${error}`)
    ctx.result.success = false
  }
}

export const claudeAdapter: HostAdapter = {
  id: 'claude',

  defaultPaths: () => ({
    skillsDir: CLAUDE_SKILLS_DIR,
    lyDir: CLAUDE_LY_DIR,
    promptsDir: CLAUDE_PROMPTS_DIR,
    agentsDir: CLAUDE_AGENTS_DIR,
  }),

  detectDir: () => CLAUDE_HOME_DIR,

  commandPrefix: '/',

  openspecTool: 'claude',

  openspecSkillRoots: cwd => [
    { scope: 'project', path: join(cwd, '.claude', 'skills') },
    { scope: 'global', path: CLAUDE_SKILLS_DIR },
  ],

  promptsTarget: ctx => ({
    sourceDir: join(ctx.templateDir, 'skills'),
    targetDir: ctx.paths.skillsDir,
    filePrefix: 'lyx-',
  }),

  renderTemplate: (content, ctx, command) =>
    renderClaudeTemplate(content, join(ctx.templateDir, 'hosts', 'claude', 'fragments'), command),

  uninstallList: async ctx => listPrefixedDirs(ctx.paths.skillsDir, 'lyx-'),

  installExtras: installAgentDefinitions,

  verify: async (ctx) => {
    const agentsDir = ctx.paths.agentsDir ?? CLAUDE_AGENTS_DIR
    for (const def of CLAUDE_AGENT_DEFINITIONS) {
      const target = join(agentsDir, def.file)
      if (!(await fs.pathExists(target))) {
        ctx.result.errors.push(`claude agent definition missing: ${target}`)
        ctx.result.success = false
      }
    }
  },

  doctorChecks: async (ctx) => {
    const { claudeDoctorChecks } = await import('./doctor')
    return claudeDoctorChecks(ctx)
  },

  definitionDrift: async (ctx) => {
    const { claudeDefinitionDrift } = await import('./doctor')
    return claudeDefinitionDrift(ctx)
  },

  // update 前备份：lyx-* 命令目录 + lyx-* 子代理定义
  backupList: async ctx => [
    ...(await listPrefixedDirs(ctx.paths.skillsDir, 'lyx-')),
    ...(await listPrefixedFiles(ctx.paths.agentsDir ?? CLAUDE_AGENTS_DIR, 'lyx-', '.md')),
  ],

  describeUninstall: paths => [
    `删除 ${paths.skillsDir}/lyx-*/`,
    `删除子代理定义 ${paths.agentsDir ?? CLAUDE_AGENTS_DIR}/lyx-*.md`,
    `删除私有目录 ${paths.lyDir}/`,
  ],

  uninstallExtras: async (ctx, report) => {
    // 只删本包的 lyx-* 子代理定义；OpenSpec 与用户自己的 agents 不动
    try {
      for (const full of await listPrefixedFiles(ctx.paths.agentsDir ?? CLAUDE_AGENTS_DIR, 'lyx-', '.md')) {
        await fs.remove(full)
        report.removedSkills.push(`agents/${basename(full)}`)
      }
    }
    catch (error) {
      report.errors.push(`Failed to remove claude agent definitions: ${error}`)
      report.success = false
    }
  },
}
