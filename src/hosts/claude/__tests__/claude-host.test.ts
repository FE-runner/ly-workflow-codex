import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it } from 'vitest'
import { renderHostCommand } from '../../../test-utils/render'
import { getAdapter } from '../../../utils/host-adapters'
import { getAllCommandIds, getWorkflowById, installWorkflows, uninstallWorkflows } from '../../../utils/installer'
import { PACKAGE_ROOT } from '../../../utils/installer-template'
import { CLAUDE_AGENT_DEFINITIONS, renderAgentModelLines, rewriteClaudeInvocations } from '../adapter'

const COMMANDS = getAllCommandIds().flatMap(id => getWorkflowById(id)!.commands)
const AGENTS_TEMPLATE_DIR = join(PACKAGE_ROOT, 'templates', 'hosts', 'claude', 'agents')

/** 解析 frontmatter 为键值（仅顶层 `key: value`） */
function frontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  expect(match, 'frontmatter block').not.toBeNull()
  return Object.fromEntries(match![1].split('\n').map((line) => {
    const idx = line.indexOf(':')
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
  }))
}

describe('claude host — invocation prefix rendering (4.2)', () => {
  it('rewrites @lyx- to /lyx- and strips @openspec- mentions', () => {
    expect(rewriteClaudeInvocations('run `@lyx-apply x` then @lyx-review-code')).toBe('run `/lyx-apply x` then /lyx-review-code')
    expect(rewriteClaudeInvocations('按 `@openspec-propose skill` 定义')).toBe('按 `openspec-propose skill` 定义')
  })

  it.each(COMMANDS)('claude %s: slash prefix, no codex mention residue, no /opsx: rewrite', (cmd) => {
    const rendered = renderHostCommand('claude', cmd)
    expect(rendered).not.toContain('@lyx-')
    expect(rendered).not.toContain('@openspec-')
    expect(rendered).not.toMatch(/\bmention\b/)
    expect(rendered).not.toContain('/opsx:')
    expect(rendered).not.toMatch(/\{\{(HOST_FRAGMENT|LYX_CONFIG_FILE|AGENT_MODEL_LINES)/)
    expect(rendered).toContain(`/lyx-${cmd}`)
  })

  it.each(COMMANDS)('codex %s keeps the @lyx- prefix', (cmd) => {
    const rendered = renderHostCommand('codex', cmd)
    expect(rendered).toContain(`@lyx-${cmd}`)
    expect(rendered).not.toContain('/lyx-')
  })

  it('delegates OpenSpec via skill names in propose / explore / archive', () => {
    expect(renderHostCommand('claude', 'propose')).toContain('`openspec-propose skill`')
    expect(renderHostCommand('claude', 'explore')).toContain('`openspec-explore skill`')
    expect(renderHostCommand('claude', 'archive')).toContain('`openspec-archive-change skill`')
  })
})

describe('claude host — agent definitions (4.3)', () => {
  it.each(CLAUDE_AGENT_DEFINITIONS.map(d => d.file))('%s has valid frontmatter, inherits by default, no worktree isolation', (file) => {
    const raw = readFileSync(join(AGENTS_TEMPLATE_DIR, file), 'utf-8')
    const rendered = raw.replace('{{AGENT_MODEL_LINES}}', renderAgentModelLines())
    const fm = frontmatter(rendered)
    expect(fm.name).toBe(file.replace('.md', ''))
    expect(fm.description).toBeTruthy()
    expect(fm.tools).toBeTruthy()
    expect(fm.model).toBe('inherit')
    expect(fm.effort).toBeUndefined()
    expect(fm.isolation).toBeUndefined()
    expect(rendered).not.toContain('Codex')
  })

  it('review agents are read-only but include Bash limited to read-only git / openspec', () => {
    for (const file of ['lyx-plan-reviewer.md', 'lyx-reviewer.md']) {
      const content = readFileSync(join(AGENTS_TEMPLATE_DIR, file), 'utf-8')
      const tools = frontmatter(content.replace('{{AGENT_MODEL_LINES}}', renderAgentModelLines())).tools.split(',').map(t => t.trim())
      expect(tools, file).toEqual(expect.arrayContaining(['Read', 'Grep', 'Glob', 'Bash']))
      expect(tools, file).not.toContain('Edit')
      expect(tools, file).not.toContain('Write')
      expect(content, file).toContain('Bash 仅用于只读的 `git` 与 `openspec` 命令')
    }
  })

  it('implementer agent never commits and keeps changes in the main checkout', () => {
    const content = readFileSync(join(AGENTS_TEMPLATE_DIR, 'lyx-implementer.md'), 'utf-8')
    expect(content).toContain('SHALL NOT 执行任何 git commit')
    expect(content).toContain('改动留在主检出')
  })

  it('renders configured model / effort verbatim (trimmed) and inherit when blank', () => {
    expect(renderAgentModelLines()).toBe('model: inherit')
    expect(renderAgentModelLines('  ', ' ')).toBe('model: inherit')
    expect(renderAgentModelLines(' sonnet ', ' high ')).toBe('model: sonnet\neffort: high')
    expect(renderAgentModelLines(undefined, 'max')).toBe('model: inherit\neffort: max')
  })
})

describe('claude host — role source and fragments (4.4)', () => {
  it.each(COMMANDS)('claude %s never references codex role prompts, config path or tool names', (cmd) => {
    const rendered = renderHostCommand('claude', cmd)
    expect(rendered).not.toContain('.codex/lyx')
    expect(rendered).not.toContain('prompts/codex')
    expect(rendered).not.toContain('ROLE_FILE')
    expect(rendered).not.toMatch(/send_input|resume_agent|fork_context|fork_turns|reasoning_effort/)
    expect(rendered).not.toContain('Codex')
  })

  it('review / apply templates point at the claude agent definitions and config', () => {
    expect(renderHostCommand('claude', 'review-plan')).toContain('lyx-plan-reviewer')
    expect(renderHostCommand('claude', 'review-code')).toContain('lyx-reviewer')
    expect(renderHostCommand('claude', 'apply')).toContain('lyx-implementer')
    for (const cmd of ['review-plan', 'review-code', 'apply'])
      expect(renderHostCommand('claude', cmd), cmd).toContain('~/.claude/lyx/config.toml')
  })

  it('claude wait semantics do not claim in-turn synchronous blocking', () => {
    for (const cmd of ['review-plan', 'review-code', 'apply']) {
      const rendered = renderHostCommand('claude', cmd)
      expect(rendered, cmd).toContain('SHALL NOT 声称"本轮内同步等待完成"')
      expect(rendered, cmd).not.toContain('在本轮内等待（wait）')
    }
  })

  it('codex and claude provide the same fragment set', () => {
    const list = (host: string) => {
      const dir = join(PACKAGE_ROOT, 'templates', 'hosts', host, 'fragments')
      return readdirSync(dir).flatMap(cmd => readdirSync(join(dir, cmd)).map(f => `${cmd}/${f}`)).sort()
    }
    expect(list('claude')).toEqual(list('codex'))
  })
})

describe('claude host — install / uninstall', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-claude-host-'))
  const paths = {
    skillsDir: join(base, 'skills'),
    agentsDir: join(base, 'agents'),
    lyDir: join(base, 'lyx'),
    promptsDir: join(base, 'lyx', 'prompts'),
  }

  afterAll(async () => {
    await fs.remove(base)
  })

  it('installs lyx-* skills and agent definitions, and never writes codex role prompts', async () => {
    const result = await installWorkflows(getAllCommandIds(), '', true, {
      hosts: ['claude'],
      hostPaths: { claude: paths },
      hostConfig: { claude: { reviewModel: 'sonnet', reviewReasoningEffort: 'high' } },
    })
    expect(result.success, result.errors.join('\n')).toBe(true)
    expect(result.hosts?.claude?.installedCommands.length).toBe(COMMANDS.length)
    expect(result.hosts?.codex).toBeUndefined()
    expect(readdirSync(paths.skillsDir).sort()).toEqual(COMMANDS.map(c => `lyx-${c}`).sort())
    expect(readdirSync(paths.agentsDir).sort()).toEqual(CLAUDE_AGENT_DEFINITIONS.map(d => d.file).sort())
    expect(fs.existsSync(join(paths.promptsDir, 'codex'))).toBe(false)

    const reviewer = frontmatter(readFileSync(join(paths.agentsDir, 'lyx-reviewer.md'), 'utf-8'))
    expect(reviewer.model).toBe('sonnet')
    expect(reviewer.effort).toBe('high')
    const implementer = frontmatter(readFileSync(join(paths.agentsDir, 'lyx-implementer.md'), 'utf-8'))
    expect(implementer.model).toBe('inherit')
  })

  it('reinstall re-renders agent definitions with the new config (no duplicate artifacts)', async () => {
    await installWorkflows(getAllCommandIds(), '', false, {
      hosts: ['claude'],
      hostPaths: { claude: paths },
      hostConfig: { claude: {} },
    })
    expect(frontmatter(readFileSync(join(paths.agentsDir, 'lyx-reviewer.md'), 'utf-8')).model).toBe('inherit')
    expect(readdirSync(paths.agentsDir).length).toBe(CLAUDE_AGENT_DEFINITIONS.length)
    expect(readdirSync(paths.skillsDir).length).toBe(COMMANDS.length)
  })

  it('uninstall removes lyx-* skills, lyx-* agents and ~/.claude/lyx only', async () => {
    await fs.ensureDir(join(paths.skillsDir, 'openspec-propose'))
    await fs.writeFile(join(paths.skillsDir, 'openspec-propose', 'SKILL.md'), '# openspec\n')
    await fs.writeFile(join(paths.agentsDir, 'my-agent.md'), '# user agent\n')
    await fs.ensureDir(paths.lyDir)
    await fs.writeFile(join(paths.lyDir, 'config.toml'), 'general = { version = "1.0.0" }\n')

    const result = await uninstallWorkflows('', { hosts: ['claude'], hostPaths: { claude: paths } })
    expect(result.success, result.errors.join('\n')).toBe(true)
    expect(readdirSync(paths.skillsDir)).toEqual(['openspec-propose'])
    expect(readdirSync(paths.agentsDir)).toEqual(['my-agent.md'])
    expect(fs.existsSync(paths.lyDir)).toBe(false)
  })

  it('exposes claude-specific detection, openspec tool and skill roots', () => {
    const adapter = getAdapter('claude')
    expect(adapter.openspecTool).toBe('claude')
    expect(adapter.detectDir().replace(/\\/g, '/')).toMatch(/\/\.claude$/)
    expect(adapter.openspecSkillRoots('/proj').map(r => r.path.replace(/\\/g, '/'))).toContain('/proj/.claude/skills')
  })
})

describe('@lyx-init memory files per host (6.4)', () => {
  it('claude init produces a CLAUDE.md importing AGENTS.md and stages/summarizes it', () => {
    const rendered = renderHostCommand('claude', 'init')
    expect(rendered).toContain('`@AGENTS.md`')
    expect(rendered).toContain('SHALL NOT 整体覆盖或删除用户内容')
    expect(rendered).toContain('git add -- AGENTS.md CLAUDE.md openspec/')
    expect(rendered).toContain('`AGENTS.md`、`CLAUDE.md`、`openspec/`')
    expect(rendered).toMatch(/CLAUDE\.md\s+✓\/✗/)
    expect(rendered).toContain('lycx openspec ensure --host claude --yes --json')
  })

  it('codex init produces AGENTS.md only and ensures for the codex host', () => {
    const rendered = renderHostCommand('codex', 'init')
    expect(rendered).not.toContain('CLAUDE.md')
    expect(rendered).toContain('git add -- AGENTS.md openspec/')
    expect(rendered).toContain('lycx openspec ensure --host codex --yes --json')
  })
})
