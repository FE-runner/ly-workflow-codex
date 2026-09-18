import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it } from 'vitest'
import { ADAPTERS, renderCodexTemplate } from '../host-adapters'
import { getAllCommandIds, getWorkflowById, installWorkflows, uninstallWorkflows } from '../installer'

/** 在指定目录初始化一个最小 git 仓库（uninstall worktree 存活检测测试用） */
function initMainRepo(dir: string): void {
  fs.ensureDirSync(dir)
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir })
  fs.writeFileSync(join(dir, 'README.md'), '# main\n')
  execFileSync('git', ['add', '-A'], { cwd: dir })
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir })
}

/** 从主仓库切出一个真实 git worktree 到指定路径（父目录自动创建） */
function addWorktree(mainRepo: string, worktreePath: string, branch: string): void {
  fs.ensureDirSync(join(worktreePath, '..'))
  execFileSync('git', ['-C', mainRepo, 'worktree', 'add', '-q', '-b', branch, worktreePath])
}

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

  it('review templates render single-reviewer non-fork subagent orchestration (no exec residue)', () => {
    for (const name of ['review-plan.md', 'review-code.md']) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, name), 'utf-8')
      // 单审查 subagent（非 fork）编排指示
      expect(content).toMatch(/1 个审查 subagent|单审查 subagent/)
      expect(content).toContain('非 fork')
      expect(content).toContain('SHALL NOT spawn 第二个审查 agent')
      expect(content).toContain('context.md')
      expect(content).toContain('可核验依据')
      expect(content).toContain('驳回硬线')
      // 弃用字段已随 switchable-executor-flow 移除：模板不应再提及
      expect(content).not.toContain('reviewModelB')
      expect(content).not.toContain('reviewReasoningEffortB')
      expect(content).not.toContain('codingModel') // review 模板不引用实施模型
      expect(content).toMatch(/~\/\.codex\/lyx\/prompts\/codex\/(plan-reviewer|reviewer)\.md/)
      // 不再走 codex exec 独立子会话
      expect(content).not.toContain('codex exec')
      expect(content).not.toContain('CODEAGENT_EOF')
      expect(content).not.toContain('codex exec resume')
      expect(content).not.toContain('session_id')
      expect(content).not.toContain('{{REVIEW_MODEL}}')
      expect(content).not.toContain('ly-wrapper')
      expect(content).not.toContain('{{LITE_MODE_FLAG}}')
      expect(content).not.toContain('{{REVIEWER_MODEL}}')
      expect(content).not.toContain('OVERALL')
      expect(content).not.toContain('LY:IF')
      expect(content).not.toContain('routing.implementer')
    }
  })

  it('apply template is coding-subagent implementation (main session commits)', () => {
    const content = readFileSync(join(SKILLS_TEMPLATES_DIR, 'apply.md'), 'utf-8')
    expect(content).toContain('coding subagent')
    expect(content).toContain('codingModel')
    expect(content).toContain('非 fork')
    expect(content).toContain('context.md')
    expect(content).toContain('只实施 change 范围')
    expect(content).toContain('回传主会话，不自行 commit')
    // 环境级不可用回退 vs 业务失败转人工
    expect(content).toContain('环境级不可用')
    expect(content).toContain('转人工')
    // 实施产物由主会话统一提交（CC 前缀 + Change-Stage trailer）；无 exec 残留
    expect(content).toContain('Change-Stage: apply')
    expect(content).not.toContain('codex exec')
    expect(content).not.toContain('CODEAGENT_EOF')
    expect(content).not.toContain('codex exec resume')
    expect(content).not.toContain('session_id')
    expect(content).not.toContain('ly-wrapper')
    expect(content).not.toMatch(/OVERALL:\s*(PASS|FAIL)/)
    expect(content).not.toContain('LY:IF')
    expect(content).not.toContain('routing.implementer')
    expect(content).toContain('Change-Name: <change-name>')
  })

  it('commit-generating templates reuse the standardized message body rules', () => {
    const bodyTemplates = [
      'commit.md',
      'propose.md',
      'apply.md',
      'archive.md',
      'review-plan.md',
      'review-code.md',
      'init.md',
      'release.md',
      'changelog.md',
      'publish.md',
      'worktree.md',
    ]
    for (const file of bodyTemplates) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, file), 'utf-8')
      expect(content, file).toMatch(/(动机[\s\S]*改动[\s\S]*影响|Motivation[\s\S]*Change[\s\S]*Impact)/)
    }

    const commit = readFileSync(join(SKILLS_TEMPLATES_DIR, 'commit.md'), 'utf-8')
    expect(commit).toContain('- 动机：')
    expect(commit).toContain('- Motivation:')

    for (const file of ['propose.md', 'apply.md']) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, file), 'utf-8')
      expect(content, file).toContain('git commit --only -F "$MSG_FILE"')
    }

    for (const file of ['propose.md', 'apply.md', 'archive.md', 'review-plan.md', 'review-code.md']) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, file), 'utf-8')
      expect(content, file).toContain('Change-Stage')
      expect(content, file).toContain('Change-Name: <change-name>')
      expect(content, file).toContain('git rev-parse --git-path COMMIT_EDITMSG')
      expect(content, file).toContain('git commit -F "$MSG_FILE"')
    }

    const publish = readFileSync(join(SKILLS_TEMPLATES_DIR, 'publish.md'), 'utf-8')
    expect(publish).toContain('npm version <patch|minor|major> --no-git-tag-version')
    expect(publish).toContain('git tag -a "v<新版本号>" -m "v<新版本号>"')

    const worktree = readFileSync(join(SKILLS_TEMPLATES_DIR, 'worktree.md'), 'utf-8')
    expect(worktree).toContain('chore(worktree): 忽略 .worktrees 目录')

    for (const file of ['init.md', 'release.md', 'changelog.md', 'publish.md', 'worktree.md']) {
      const content = readFileSync(join(SKILLS_TEMPLATES_DIR, file), 'utf-8')
      expect(content, file).not.toContain('Change-Stage:')
      expect(content, file).not.toContain('Change-Name: <change-name>')
    }
  })

  it('propose and archive templates include isolation cleanup metadata flow', () => {
    const propose = readFileSync(join(SKILLS_TEMPLATES_DIR, 'propose.md'), 'utf-8')
    expect(propose).toContain('ISOLATION_SOURCE_BRANCH')
    expect(propose).toContain('DEVELOPMENT_BRANCH')
    expect(propose).toContain('WORKTREE_PATH')
    expect(propose).toContain('lyx:')
    expect(propose).toContain('sourceBranch')
    expect(propose).toContain('developmentBranch')
    expect(propose).toContain('worktreePath')
    expect(propose).toContain('detached HEAD')
    expect(propose).toContain('已保留、未清理')

    const archive = readFileSync(join(SKILLS_TEMPLATES_DIR, 'archive.md'), 'utf-8')
    expect(archive).toContain('归档后分支收尾')
    expect(archive).toContain('sourceBranch')
    expect(archive).toContain('developmentBranch')
    expect(archive).toContain('worktreePath')
    expect(archive).toContain('git -C "<targetWorktree>" merge --no-ff "<developmentBranch>"')
    expect(archive).toContain('git -C "<targetWorktree>" worktree remove "<worktreePath>"')
    expect(archive).toContain('git -C "<targetWorktree>" branch -d "<developmentBranch>"')
    expect(archive).toContain('git -C "<targetWorktree>" worktree remove "<worktreePath>"')
    expect(archive).toContain('SHALL NOT 自动 `git push`')
    expect(archive).toContain('sourceBranch` 为 `null`')
    expect(archive).toContain('完全缺少 isolation metadata')
    expect(archive).toContain('checkout / 切回 `targetBranch` 失败')
    expect(archive).toContain('`targetBranch` SHALL NOT 等于 `developmentBranch`')
    expect(archive.indexOf('展示确认前完成一致性校验')).toBeLessThan(archive.indexOf('### 3. 展示收尾提示'))

    const worktree = readFileSync(join(SKILLS_TEMPLATES_DIR, 'worktree.md'), 'utf-8')
    expect(worktree).toContain('手动 `@lyx-worktree add` 不强制记录该 metadata')
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

    // 渲染产物：单审查 subagent（非 fork）编排指示；REVIEW_MODEL 未配置也无 -m/exec 残留；无 wrapper 残留
    const reviewPlan = readFileSync(join(codexSkillsDir, 'lyx-review-plan', 'SKILL.md'), 'utf-8')
    expect(reviewPlan).toContain('单审查 subagent')
    expect(reviewPlan).not.toContain('reviewModelB')
    expect(reviewPlan).toContain('/.codex/lyx/prompts/codex/plan-reviewer.md')
    expect(reviewPlan).not.toContain('codex exec')
    expect(reviewPlan).not.toContain('CODEAGENT_EOF')
    expect(reviewPlan).not.toContain('codex exec resume')
    expect(reviewPlan).not.toContain('session_id')
    expect(reviewPlan).not.toContain('ly-wrapper')
    expect(reviewPlan).not.toContain('{{REVIEW_MODEL}}')

    // 共享角色词安装到 lyPromptsDir/codex/
    expect(fs.existsSync(join(lyPromptsDir, 'codex', 'reviewer.md'))).toBe(true)
    expect(fs.existsSync(join(lyPromptsDir, 'codex', 'plan-reviewer.md'))).toBe(true)
  })

  it('rendered review templates keep subagent orchestration when reviewModel configured', async () => {
    const result = await installWorkflows(
      getAllCommandIds(),
      codexDir,
      true,
      { promptsDir: lyPromptsDir, codexSkillsDir, reviewModel: 'gpt-5.1-codex' },
    )
    expect(result.success).toBe(true)
    const reviewPlan = readFileSync(join(codexSkillsDir, 'lyx-review-plan', 'SKILL.md'), 'utf-8')
    // 模型经模板指示 + 宿主 spawn 能力落实：配置的 reviewModel 值以指示文字形式存在于模板，
    // 不出现 codex exec -m 调用形态
    expect(reviewPlan).toContain('reviewModel')
    expect(reviewPlan).toContain('单审查 subagent')
    expect(reviewPlan).not.toContain('codex exec')
    expect(reviewPlan).not.toContain('-m {{REVIEW_MODEL}}')
    expect(reviewPlan).not.toContain('gpt-5.1-codex')
  })

  it('does not create claude-side artifacts', async () => {
    expect(fs.existsSync(join(codexDir, 'commands', 'ly'))).toBe(false)
    expect(fs.existsSync(join(lyPromptsDir, 'claude'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// E. 卸载（codex 单宿主：删 ly-*.md + ~/.codex/lyx/ 私有目录；
//     config.toml 与 prompts/ 无条件删除；共享的 ~/.ly/worktrees/ 不碰）
// ─────────────────────────────────────────────────────────────
describe('uninstallWorkflows — codex single host', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-uninstall-'))
  const codexSkillsDir = join(base, 'codex-skills')
  const lyPromptsDir = join(base, 'ly-prompts')
  const codexDir = join(base, 'codex')
  const cleanupDirs = { codexDir: join(base, '.codex'), homeDir: base }
  const lyDir = join(base, 'lyx') // 模拟 ~/.codex/lyx

  async function seed(): Promise<void> {
    await fs.ensureDir(join(codexSkillsDir, 'lyx-commit'))
    await fs.writeFile(join(codexSkillsDir, 'lyx-commit', 'SKILL.md'), '# codex commit\n')
    await fs.writeFile(join(codexSkillsDir, 'user-prompt.md'), '# user own prompt\n')
    await fs.ensureDir(join(lyPromptsDir, 'codex'))
    await fs.writeFile(join(lyPromptsDir, 'codex', 'reviewer.md'), '# reviewer\n')
    await fs.ensureDir(lyDir)
    await fs.writeFile(join(lyDir, 'config.toml'), 'general = { version = "1.0.0" }\n')
  }

  afterAll(async () => {
    await fs.remove(base)
  })

  it('removes package-owned artifacts + private config dir, does not touch user prompts', async () => {
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
    // 角色词：仅删 codex 子目录，父目录与其余内容保留
    expect(result.removedPrompts).toBe(true)
    expect(fs.existsSync(join(lyPromptsDir, 'codex'))).toBe(false)
    expect(fs.existsSync(lyPromptsDir)).toBe(true)
    // 私有目录（config.toml）无条件删除
    expect(fs.existsSync(lyDir)).toBe(false)
  })

  it('succeeds on empty dirs', async () => {
    const result = await uninstallWorkflows(join(base, 'empty'), {
      lyPromptsDir: join(base, 'no-prompts'),
      codexSkillsDir: join(base, 'no-codex'),
      lyDir: join(base, 'no-lyx'),
      legacyCleanupDirs: cleanupDirs,
    })
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('does not touch the shared ~/.ly/worktrees/ directory', async () => {
    // 共享 worktree 目录在 lyDir 之外（模拟老包与本包共用的 ~/.ly/worktrees/）
    const sharedWorktreesDir = join(base, 'shared-ly', 'worktrees')
    const mainRepo = join(base, 'shared-main-repo')
    initMainRepo(mainRepo)
    addWorktree(mainRepo, join(sharedWorktreesDir, 'proj-shared'), 'wt-shared')
    await seed()
    const result = await uninstallWorkflows(codexDir, {
      lyPromptsDir,
      codexSkillsDir,
      lyDir,
      legacyCleanupDirs: cleanupDirs,
    })
    expect(result.success).toBe(true)
    // 私有目录删了
    expect(fs.existsSync(lyDir)).toBe(false)
    // 共享 worktree 目录原样保留（不删除、不移动、不改动）
    expect(fs.existsSync(join(sharedWorktreesDir, 'proj-shared'))).toBe(true)
    execFileSync('git', ['-C', join(sharedWorktreesDir, 'proj-shared'), 'rev-parse', '--git-dir'])
  })
})
