import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it } from 'vitest'
import { ADAPTERS, renderCodexTemplate } from '../host-adapters'
import { getAllCommandIds, getWorkflowById, installWorkflows, migrateLegacyPrompts, uninstallWorkflows } from '../installer'

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
const SKILLS_TEMPLATES_DIR = join(PACKAGE_ROOT, 'templates', 'skills-codex')

// ─────────────────────────────────────────────────────────────
// A. codex 模板集完整性（14 个单 Agent 版模板）
// ─────────────────────────────────────────────────────────────
describe('codex template set', () => {
  it('has exactly the 14 core commands as templates', () => {
    const files = readdirSync(SKILLS_TEMPLATES_DIR).filter(f => f.endsWith('.md'))
    const codexCommands = getAllCommandIds()
      .flatMap(id => getWorkflowById(id)!.commands)
    expect(files.sort()).toEqual(codexCommands.map(c => `${c}.md`).sort())
    expect(files.length).toBe(14)
  })

  it('every codex template has argument-hint frontmatter', () => {
    for (const file of readdirSync(SKILLS_TEMPLATES_DIR).filter(f => f.endsWith('.md'))) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, file), 'utf-8')
      expect(content.startsWith('---\n'), file).toBe(true)
      expect(content, file).toMatch(/^argument-hint: '/m)
      expect(content, file).toMatch(/^description: '/m)
    }
  })

  it('review templates render codex exec orchestration (no wrapper residue)', () => {
    for (const name of ['review-plan.md', 'review-code.md']) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, name), 'utf-8')
      expect(content).toContain('codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -')
      expect(content).toContain('codex exec -C "$WORKDIR" --json resume <session-id> -')
      expect(content).toContain('session_id')
      expect(content).toMatch(/ROLE_FILE: ~\/\.ly\/prompts\/codex\/(plan-reviewer|reviewer)\.md/)
      expect(content).not.toContain('ly-wrapper')
      expect(content).not.toContain('{{LITE_MODE_FLAG}}')
      expect(content).not.toContain('{{REVIEWER_MODEL}}')
      expect(content).not.toContain('OVERALL')
      expect(content).not.toContain('LY:IF')
      expect(content).not.toContain('routing.implementer')
    }
  })

  it('apply template is self-implementation only (no delegation machinery)', () => {
    const content = readFileSync(join(SKILLS_TEMPLATES_DIR, 'apply.md'), 'utf-8')
    expect(content).toContain('逐任务实施')
    expect(content).not.toContain('ly-wrapper')
    expect(content).not.toMatch(/OVERALL:\s*(PASS|FAIL)/)
    expect(content).not.toContain('LY:IF')
    expect(content).not.toContain('routing.implementer')
    expect(content).toContain('git commit -m "apply: <change-name>"')
  })

  it('no codex template contains wrapper/lite/routing residue', () => {
    for (const file of readdirSync(SKILLS_TEMPLATES_DIR).filter(f => f.endsWith('.md'))) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, file), 'utf-8')
      expect(content, file).not.toContain('ly-wrapper')
      expect(content, file).not.toContain('{{LITE_MODE_FLAG}}')
      expect(content, file).not.toContain('<!-- LY:IF')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// B. codex adapter 渲染（REVIEW_MODEL 注入）
// ─────────────────────────────────────────────────────────────
describe('renderCodexTemplate', () => {
  it('injects REVIEW_MODEL when configured', () => {
    const result = renderCodexTemplate(
      'codex exec -m {{REVIEW_MODEL}} -',
      { reviewModel: 'gpt-5.1-codex' },
    )
    expect(result).toBe('codex exec -m gpt-5.1-codex -')
  })

  it('strips the -m flag when reviewModel is unset (fall back to session model)', () => {
    const result = renderCodexTemplate(
      'codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -',
      {},
    )
    expect(result).toBe('codex exec -C "$WORKDIR" --json -')
  })

  it('strips the -m flag when reviewModel is blank', () => {
    const result = renderCodexTemplate('codex exec -m {{REVIEW_MODEL}} -', { reviewModel: '  ' })
    expect(result).toBe('codex exec -')
  })

  it('renders legacy reviewer/implementer placeholders to codex (single-host semantics)', () => {
    const result = renderCodexTemplate('{{REVIEWER_MODEL}}/{{IMPLEMENTER_MODEL}}', {})
    expect(result).toBe('codex/codex')
  })
})

// ─────────────────────────────────────────────────────────────
// C. adapter 目标与注册表
// ─────────────────────────────────────────────────────────────
function makeCtx(overrides: Record<string, unknown> = {}): any {
  return {
    installDir: '/tmp/codex',
    force: true,
    templateDir: '/pkg/templates',
    promptsDir: '/tmp/ly-prompts',
    codexSkillsDir: '/tmp/codex-skills',
    config: {},
    result: { success: true, installedCommands: [], installedPrompts: [], errors: [], configPath: '' },
    ...overrides,
  }
}

describe('adapters', () => {
  const baseCtx = makeCtx

  it('registry has only the codex adapter', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['codex'])
  })

  it('codex adapter targets codexSkillsDir with ly- prefix', () => {
    const target = ADAPTERS.codex.promptsTarget(baseCtx())
    expect(target.sourceDir).toBe('/pkg/templates/skills-codex')
    expect(target.targetDir).toBe('/tmp/codex-skills')
    expect(target.filePrefix).toBe('lyx-')
  })

  it('codex adapter verify checks ROLE_FILE targets exist', async () => {
    const ctx = baseCtx()
    ctx.promptsDir = '/tmp/ly-prompts-missing'
    await ADAPTERS.codex.verify?.(ctx)
    expect(ctx.result.success).toBe(false)
    expect(ctx.result.errors.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────
// D. installWorkflows — codex 单宿主（产物路径 + ROLE_FILE 校验）
// ─────────────────────────────────────────────────────────────
describe('installWorkflows — codex host', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-codex-'))
  const codexSkillsDir = join(base, 'codex-skills')
  const lyPromptsDir = join(base, 'ly-prompts')
  const codexDir = join(base, 'codex')

  afterAll(async () => {
    await fs.remove(base)
  })

  it('installs ly-* skill dirs (SKILL.md) into codexSkillsDir and shared prompts into lyPromptsDir', async () => {
    const result = await installWorkflows(
      getAllCommandIds(),
      codexDir,
      true,
      { promptsDir: lyPromptsDir, codexSkillsDir },
    )
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])

    const installed = readdirSync(codexSkillsDir)
    expect(installed.length).toBe(14)
    expect(installed).toContain('lyx-apply')
    expect(installed).toContain('lyx-review-plan')
    expect(fs.existsSync(join(codexSkillsDir, 'lyx-apply', 'SKILL.md'))).toBe(true)

    // 渲染产物：REVIEW_MODEL 未配置 → -m 参数被剥离；无 wrapper 残留
    const reviewPlan = readFileSync(join(codexSkillsDir, 'lyx-review-plan', 'SKILL.md'), 'utf-8')
    expect(reviewPlan).toContain('codex exec -C "$WORKDIR" --json -')
    expect(reviewPlan).toContain('session_id')
    expect(reviewPlan).not.toContain('ly-wrapper')
    expect(reviewPlan).not.toContain('{{REVIEW_MODEL}}')
    expect(reviewPlan).toContain('/.ly/prompts/codex/plan-reviewer.md')

    // 共享角色词安装到 lyPromptsDir/codex/
    expect(fs.existsSync(join(lyPromptsDir, 'codex', 'reviewer.md'))).toBe(true)
    expect(fs.existsSync(join(lyPromptsDir, 'codex', 'plan-reviewer.md'))).toBe(true)
  })

  it('renders configured reviewModel into installed templates', async () => {
    const result = await installWorkflows(
      getAllCommandIds(),
      codexDir,
      true,
      { promptsDir: lyPromptsDir, codexSkillsDir, reviewModel: 'gpt-5.1-codex' },
    )
    expect(result.success).toBe(true)
    const reviewPlan = readFileSync(join(codexSkillsDir, 'lyx-review-plan', 'SKILL.md'), 'utf-8')
    expect(reviewPlan).toContain('codex exec -C "$WORKDIR" --json -m gpt-5.1-codex -')
  })

  it('does not create claude-side artifacts', async () => {
    expect(fs.existsSync(join(codexDir, 'commands', 'ly'))).toBe(false)
    expect(fs.existsSync(join(lyPromptsDir, 'claude'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// E. 卸载（codex 单宿主：删 ly-*.md + ~/.ly/prompts/codex/ 子目录；
//     ~/.ly/ 其余内容（worktrees/config.toml）与用户 own prompt 保留）
// ─────────────────────────────────────────────────────────────
describe('uninstallWorkflows — codex single host', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-uninstall-'))
  const codexSkillsDir = join(base, 'codex-skills')
  const lyPromptsDir = join(base, 'ly-prompts')
  const codexDir = join(base, 'codex')
  const cleanupDirs = { codexDir: join(base, '.codex'), homeDir: base }
  const lyDir = join(base, '.ly')

  async function seed(): Promise<void> {
    await fs.ensureDir(join(codexSkillsDir, 'lyx-commit'))
    await fs.writeFile(join(codexSkillsDir, 'lyx-commit', 'SKILL.md'), '# codex commit\n')
    await fs.writeFile(join(codexSkillsDir, 'user-prompt.md'), '# user own prompt\n')
    await fs.ensureDir(join(lyPromptsDir, 'codex'))
    await fs.writeFile(join(lyPromptsDir, 'codex', 'reviewer.md'), '# reviewer\n')
    // 第三方内容：~/.ly/worktrees/ 真实 checkout 与共享配置必须保留
    await fs.ensureDir(join(lyDir, 'worktrees', 'proj-x'))
    await fs.writeFile(join(lyDir, 'worktrees', 'proj-x', 'real-file.txt'), 'third-party data\n')
    await fs.writeFile(join(lyDir, 'config.toml'), 'general = { version = "1.0.0" }\n')
  }

  afterAll(async () => {
    await fs.remove(base)
  })

  it('removes only package-owned artifacts; keeps worktrees, shared config & user prompts', async () => {
    await seed()
    const result = await uninstallWorkflows(codexDir, {
      lyPromptsDir,
      codexSkillsDir,
      lyDir,
      legacyCleanupDirs: cleanupDirs,
    })
    expect(result.success).toBe(true)
    expect(result.removedSkills).toContain('lyx-commit')
    expect(fs.existsSync(join(codexSkillsDir, 'lyx-commit'))).toBe(false)
    // 用户自己的 prompt 不误删
    expect(fs.existsSync(join(codexSkillsDir, 'user-prompt.md'))).toBe(true)
    // 共享角色词：仅删 codex 子目录，父目录与其余内容保留
    expect(result.removedSharedPrompts).toBe(true)
    expect(fs.existsSync(join(lyPromptsDir, 'codex'))).toBe(false)
    expect(fs.existsSync(lyPromptsDir)).toBe(true)
    // ~/.ly/ 第三方内容（worktrees 真实 checkout）与共享配置保留，绝不整删
    expect(fs.existsSync(join(lyDir, 'worktrees', 'proj-x', 'real-file.txt'))).toBe(true)
    expect(result.configTomlKept).toBe(true)
    expect(fs.existsSync(join(lyDir, 'config.toml'))).toBe(true)
  })

  it('succeeds on empty dirs', async () => {
    const result = await uninstallWorkflows(join(base, 'empty'), {
      lyPromptsDir: join(base, 'no-prompts'),
      codexSkillsDir: join(base, 'no-codex'),
      lyDir: join(base, 'no-ly'),
      legacyCleanupDirs: cleanupDirs,
    })
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// F. prompts 迁移（旧位置 → 中立位置）
// ─────────────────────────────────────────────────────────────
describe('migrateLegacyPrompts', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-migrate-'))

  afterAll(async () => {
    await fs.remove(base)
  })

  it('moves legacy ~/.claude/.ly/prompts content to the neutral location and removes the old dir', async () => {
    const homeDir = join(base, 'home')
    const oldDir = join(homeDir, '.claude', '.ly', 'prompts')
    const newDir = join(base, 'ly-prompts')
    await fs.ensureDir(join(oldDir, 'codex'))
    await fs.ensureDir(join(oldDir, 'claude'))
    await fs.writeFile(join(oldDir, 'codex', 'reviewer.md'), '# reviewer\n')
    await fs.writeFile(join(oldDir, 'claude', '.DS_Store'), 'junk')

    const result = await migrateLegacyPrompts({ homeDir, promptsDir: newDir })
    expect(result.migrated).toBe(true)
    expect(fs.existsSync(join(newDir, 'codex', 'reviewer.md'))).toBe(true)
    expect(fs.existsSync(oldDir)).toBe(false)
  })

  it('reports migrated=false when the legacy dir does not exist', async () => {
    const result = await migrateLegacyPrompts({ homeDir: join(base, 'none'), promptsDir: join(base, 'x') })
    expect(result.migrated).toBe(false)
  })

  it('does not overwrite an existing target file (skip, keep newer content)', async () => {
    const homeDir = join(base, 'home2')
    const oldDir = join(homeDir, '.claude', '.ly', 'prompts')
    const newDir = join(base, 'ly-prompts2')
    await fs.ensureDir(join(oldDir, 'codex'))
    await fs.ensureDir(join(newDir, 'codex'))
    await fs.writeFile(join(oldDir, 'codex', 'reviewer.md'), '# legacy version\n')
    await fs.writeFile(join(newDir, 'codex', 'reviewer.md'), '# newer version\n')

    const result = await migrateLegacyPrompts({ homeDir, promptsDir: newDir })
    expect(result.migrated).toBe(true)
    // 目标已存在 → 不覆盖
    expect(fs.readFileSync(join(newDir, 'codex', 'reviewer.md'), 'utf-8')).toBe('# newer version\n')
  })

  it('skips migration when ~/.claude still hosts active ly-workflow products (commands/ly)', async () => {
    const homeDir = join(base, 'home3')
    const oldDir = join(homeDir, '.claude', '.ly', 'prompts')
    const newDir = join(base, 'ly-prompts3')
    await fs.ensureDir(join(oldDir, 'codex'))
    await fs.writeFile(join(oldDir, 'codex', 'reviewer.md'), '# legacy version\n')
    // 共存信号：ly-workflow 的 claude 宿主命令目录仍在
    await fs.ensureDir(join(homeDir, '.claude', 'commands', 'ly'))

    const result = await migrateLegacyPrompts({ homeDir, promptsDir: newDir })
    expect(result.migrated).toBe(false)
    // 他方在用角色词不被搬走
    expect(fs.existsSync(join(oldDir, 'codex', 'reviewer.md'))).toBe(true)
    expect(fs.existsSync(join(newDir, 'codex', 'reviewer.md'))).toBe(false)
  })
})
