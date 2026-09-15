import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it } from 'vitest'
import { renderCodexTemplate } from '../host-adapters'
import { getAllCommandIds, getWorkflowById, getWorkflowConfigs, injectConfigVariables, installWorkflows } from '../installer'

// Helper: find package root
function findPackageRoot(): string {
  let dir = import.meta.dirname
  for (let i = 0; i < 10; i++) {
    try {
      readFileSync(join(dir, 'package.json'))
      return dir
    }
    catch {
      dir = join(dir, '..')
    }
  }
  throw new Error('Could not find package root')
}

const PACKAGE_ROOT = findPackageRoot()
// codex 单宿主：实际安装源为 templates/skills-codex/
const TEMPLATES_DIR = join(PACKAGE_ROOT, 'templates', 'skills-codex')

// ─────────────────────────────────────────────────────────────
// A. Workflow registry consistency
// ─────────────────────────────────────────────────────────────
describe('workflow registry', () => {
  it('getAllCommandIds returns the 14 core commands', () => {
    const ids = getAllCommandIds()
    expect(ids.length).toBe(14)
  })

  it('every command ID has a matching codex template file', () => {
    const ids = getAllCommandIds()
    for (const id of ids) {
      const workflow = getWorkflowById(id)
      expect(workflow, `workflow config missing for: ${id}`).toBeDefined()
      for (const cmd of workflow!.commands) {
        const corePath = join(TEMPLATES_DIR, `${cmd}.md`)
        expect(fs.existsSync(corePath), `template missing: ${cmd}.md`).toBe(true)
      }
    }
  })

  it('every codex template file has a matching workflow config', () => {
    const coreFiles = readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''))
    const allCommands = getAllCommandIds()
      .flatMap(id => getWorkflowById(id)!.commands)

    for (const template of coreFiles) {
      expect(
        allCommands.includes(template),
        `template "${template}.md" has no workflow config`,
      ).toBe(true)
    }
  })

  it('getWorkflowConfigs returns sorted by order', () => {
    const configs = getWorkflowConfigs()
    for (let i = 1; i < configs.length; i++) {
      expect(configs[i].order).toBeGreaterThanOrEqual(configs[i - 1].order)
    }
  })

  it('all workflows have both name and nameEn', () => {
    const configs = getWorkflowConfigs()
    for (const config of configs) {
      expect(config.name, `${config.id} missing name`).toBeTruthy()
      expect(config.nameEn, `${config.id} missing nameEn`).toBeTruthy()
    }
  })

  it('all workflow IDs are unique', () => {
    const ids = getAllCommandIds()
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getWorkflowById returns undefined for unknown id', () => {
    expect(getWorkflowById('nonexistent')).toBeUndefined()
  })

  it('release category commands have templates and are registered with category release', () => {
    const releaseConfigs = getWorkflowConfigs().filter(w => w.category === 'release')
    expect(releaseConfigs.map(w => w.id).sort()).toEqual(['changelog', 'publish', 'release'])

    for (const cfg of releaseConfigs) {
      for (const cmd of cfg.commands) {
        const corePath = join(TEMPLATES_DIR, `${cmd}.md`)
        expect(fs.existsSync(corePath), `template missing for release command: ${cmd}.md`).toBe(true)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────
// B. injectConfigVariables — codex 单宿主语义
// ─────────────────────────────────────────────────────────────
describe('injectConfigVariables — single-host variables', () => {
  it('renders {{REVIEWER_MODEL}} to codex', () => {
    const input = 'reviewer: {{REVIEWER_MODEL}}'
    const result = injectConfigVariables(input, {})
    expect(result).toBe('reviewer: codex')
  })

  it('renders {{IMPLEMENTER_MODEL}} to codex', () => {
    const input = 'implementer: {{IMPLEMENTER_MODEL}}'
    const result = injectConfigVariables(input, {})
    expect(result).toBe('implementer: codex')
  })

  it('strips {{LITE_MODE_FLAG}} (wrapper removed)', () => {
    const input = 'ly-wrapper {{LITE_MODE_FLAG}}--backend codex'
    const result = injectConfigVariables(input, {})
    expect(result).toBe('ly-wrapper --backend codex')
  })

  it('folds both implementer conditional branches away', () => {
    const template = [
      'SHARED',
      '<!-- LY:IF:IMPLEMENTER_EXTERNAL -->',
      'EXT_BODY',
      '<!-- LY:ENDIF -->',
      '<!-- LY:IF:IMPLEMENTER_CLAUDE -->',
      'CLAUDE_BODY',
      '<!-- LY:ENDIF -->',
      'END',
    ].join('\n')
    const result = injectConfigVariables(template, {})
    expect(result).toContain('SHARED')
    expect(result).toContain('END')
    expect(result).not.toContain('EXT_BODY')
    expect(result).not.toContain('CLAUDE_BODY')
    expect(result).not.toContain('LY:IF')
    expect(result).not.toContain('LY:ENDIF')
  })
})

// ─────────────────────────────────────────────────────────────
// C. Template variable completeness（codex 模板经完整渲染后无残留）
// ─────────────────────────────────────────────────────────────
describe('template variable completeness', () => {
  function collectTemplateFiles(dir: string): string[] {
    const files: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...collectTemplateFiles(fullPath))
      }
      else if (entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
    return files
  }

  const allTemplates = collectTemplateFiles(TEMPLATES_DIR)

  it('finds template files', () => {
    expect(allTemplates.length).toBeGreaterThan(0)
  })

  for (const file of allTemplates) {
    const relativePath = file.replace(`${PACKAGE_ROOT}/`, '')

    it(`${relativePath}: no unprocessed {{variables}} after full injection`, () => {
      const content = readFileSync(file, 'utf-8')
      // codex 模板渲染链：injectConfigVariables → renderCodexTemplate(REVIEW_MODEL 兼容处理)
      const result = renderCodexTemplate(content, { reviewModel: 'gpt-5.1' })

      // Find any remaining {{ }} template variables
      const remaining = result.match(/\{\{[A-Z_]+\}\}/g) || []
      // Filter out known non-ly variables (user-facing placeholders like {{项目路径}})
      const lyVars = remaining.filter(v =>
        !v.includes('项目') && !v.includes('相关') && !v.includes('WORKDIR'),
      )
      expect(lyVars, `unprocessed variables in ${relativePath}: ${lyVars.join(', ')}`).toEqual([])
    })
  }

  it('rendered review/apply templates contain subagent orchestration, no exec residue', () => {
    const cases: Array<[string, string]> = [
      ['review-plan.md', 'subagent'],
      ['review-code.md', 'subagent'],
      ['apply.md', 'coding subagent'],
    ]
    for (const [file, marker] of cases) {
      const content = readFileSync(join(TEMPLATES_DIR, file), 'utf-8')
      const rendered = renderCodexTemplate(content, { reviewModel: 'gpt-5.1' })
      expect(rendered, file).toContain(marker)
      expect(rendered, file).not.toContain('codex exec')
      expect(rendered, file).not.toContain('CODEAGENT_EOF')
      expect(rendered, file).not.toContain('resume')
      expect(rendered, file).not.toContain('session_id')
      expect(rendered, file).not.toContain('{{REVIEW_MODEL}}')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// D. installWorkflows E2E & prompts installation（单宿主）
// ─────────────────────────────────────────────────────────────
describe('installWorkflows — prompts installation', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-prompts-'))
  const codexSkillsDir = join(base, 'codex-skills')
  const lyPromptsDir = join(base, 'ly-prompts')
  const codexDir = join(base, 'codex')

  afterAll(async () => {
    await fs.remove(base)
  })

  it('installs commands into codexSkillsDir and only codex prompts', async () => {
    const result = await installWorkflows(
      getAllCommandIds(),
      codexDir,
      true,
      { promptsDir: lyPromptsDir, codexSkillsDir },
    )
    expect(result.success).toBe(true)
    expect(result.installedCommands.length).toBe(14)
    expect(result.installedPrompts.length).toBeGreaterThan(0)

    // 只装 codex 共享角色词；claude/gemini/grok 不得存在
    expect(fs.existsSync(join(lyPromptsDir, 'codex'))).toBe(true)
    expect(fs.existsSync(join(lyPromptsDir, 'claude'))).toBe(false)
    expect(fs.existsSync(join(lyPromptsDir, 'gemini'))).toBe(false)
    expect(fs.existsSync(join(lyPromptsDir, 'grok'))).toBe(false)

    const codexFiles = readdirSync(join(lyPromptsDir, 'codex')).filter(f => f.endsWith('.md'))
    expect(codexFiles.length).toBeGreaterThanOrEqual(2)
  })
})

// ─────────────────────────────────────────────────────────────
// E. 非 force 安装"假成功"修复：只统计真正写入的文件，已存在目标记入 skipped
// ─────────────────────────────────────────────────────────────
describe('installWorkflows — non-force skip counting', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-skip-'))
  const codexSkillsDir = join(base, 'codex-skills')
  const lyPromptsDir = join(base, 'ly-prompts')
  const codexDir = join(base, 'codex')

  afterAll(async () => {
    await fs.remove(base)
  })

  it('non-force install over existing files counts only truly-written files', async () => {
    // 预置全部 14 个目标文件（模拟 ly-workflow 旧安装残留）
    const templateFiles = readdirSync(join(TEMPLATES_DIR)).filter(f => f.endsWith('.md'))
    expect(templateFiles.length).toBe(14)
    await fs.ensureDir(codexSkillsDir)
    for (const f of templateFiles) {
      const dir = join(codexSkillsDir, `lyx-${f.replace('.md', '')}`)
      await fs.ensureDir(dir)
      await fs.writeFile(join(dir, 'SKILL.md'), '# old content\n')
    }

    const result = await installWorkflows(getAllCommandIds(), codexDir, false, {
      promptsDir: lyPromptsDir,
      codexSkillsDir,
    })

    expect(result.success).toBe(true)
    // 没有真正写入 → 不得报"已装 14 个命令"
    expect(result.installedCommands.length).toBe(0)
    // 全部因目标已存在而跳过，记录在 skippedCommands
    expect(result.skippedCommands?.length).toBe(14)
    expect(result.errors).toEqual([])
    // 旧文件内容未被覆盖
    expect(readFileSync(join(codexSkillsDir, 'lyx-commit', 'SKILL.md'), 'utf-8')).toBe('# old content\n')
  })

  it('force install overwrites existing files and counts all as installed', async () => {
    const result = await installWorkflows(getAllCommandIds(), codexDir, true, {
      promptsDir: lyPromptsDir,
      codexSkillsDir,
    })
    expect(result.success).toBe(true)
    expect(result.installedCommands.length).toBe(14)
    expect(result.skippedCommands?.length ?? 0).toBe(0)
  })
})
