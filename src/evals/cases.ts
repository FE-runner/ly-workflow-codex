import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import fs from 'fs-extra'
import { join } from 'pathe'

export const EVAL_SKILLS = ['propose', 'apply', 'review-plan', 'review-code'] as const
export type EvalSkill = typeof EVAL_SKILLS[number]

export interface EvalFixture {
  repoDir: string
  homeDir: string
}

export interface SideEffectCheck {
  passed: boolean
  evidence: string
}

export interface SkillEvalCase {
  id: EvalSkill
  skillCommand: EvalSkill
  hostConfig?: {
    reviewExecutor?: 'main' | 'subagent'
  }
  prompt: string
  passPatterns: RegExp[]
  forbiddenPatterns: RegExp[]
  notApplicableReason: string | null
  setup: (fixture: EvalFixture) => Promise<void>
  verifySideEffects: (fixture: EvalFixture) => Promise<SideEffectCheck>
}

const PROPOSE_PROPOSAL = '## Why\n\n用户正在编辑这个 change 的 proposal。\n'
const APPLY_SOURCE = 'export const placeholder = 0\n'
const APPLY_TASKS_CHECKED = [
  '## 1. 实施',
  '',
  '- [x] 1.1 在 `src/feature.ts` 导出 `feature`。',
  '- [ ] 1.2 完善错误处理。',
  '- [ ] 1.3 补充验证。',
  '',
].join('\n')
const APPLY_RUN_STATE_CHECKED = '# Run State\n\n- Completed tasks: 1/3\n'
export const REVIEW_CODE_CRITICAL = '[src/worker.ts:2] — executeTask 缺少异常捕获。'
const REVIEW_CODE_WORKER = [
  'export async function executeTask(): Promise<void> {',
  '  await doWork()',
  '}',
  '',
  'declare function doWork(): Promise<void>',
  '',
].join('\n')
const REVIEW_CODE_RUNNER = [
  'import { executeTask } from \'./worker\'',
  '',
  'export async function run(): Promise<void> {',
  '  try {',
  '    await executeTask()',
  '  }',
  '  catch (error) {',
  '    throw new Error(\'normalized\', { cause: error })',
  '  }',
  '}',
  '',
].join('\n')

function runGit(cwd: string, args: string[], options: Partial<ExecFileSyncOptionsWithStringEncoding> = {}): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  }).trim()
}

async function writeFile(root: string, relativePath: string, content: string): Promise<void> {
  const file = join(root, relativePath)
  await fs.ensureDir(join(file, '..'))
  await fs.writeFile(file, content, 'utf8')
}

async function initRepo(repoDir: string): Promise<void> {
  await fs.ensureDir(repoDir)
  runGit(repoDir, ['init', '-q'])
  runGit(repoDir, ['symbolic-ref', 'HEAD', 'refs/heads/main'])
  runGit(repoDir, ['config', 'user.email', 'skill-evals@example.com'])
  runGit(repoDir, ['config', 'user.name', 'Skill Evals'])
  runGit(repoDir, ['config', 'commit.gpgsign', 'false'])
  await writeFile(repoDir, '.gitignore', '.agents/\n')
  await writeFile(repoDir, 'README.md', '# Skill eval fixture\n')
  commitAll(repoDir, 'fixture: initialize repository')
}

function commitAll(repoDir: string, message: string): string {
  runGit(repoDir, ['add', '-A'])
  runGit(repoDir, ['commit', '-q', '-m', message])
  return runGit(repoDir, ['rev-parse', '--short', 'HEAD'])
}

function readRepoFile(repoDir: string, relativePath: string): string {
  return readFileSync(join(repoDir, relativePath), 'utf8')
}

function statusPaths(repoDir: string): string[] {
  const output = execFileSync('git', [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--no-renames',
  ], {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return output
    .split('\0')
    .filter(Boolean)
    .map(entry => entry.slice(3).replace(/\\/g, '/'))
}

export const skillEvalCases: SkillEvalCase[] = [
  {
    id: 'propose',
    skillCommand: 'propose',
    hostConfig: { reviewExecutor: 'main' },
    prompt: '@lyx-propose 为 change session-recovery 增加一个会话恢复字段。',
    passPatterns: [/隔离/, /(worktree|切新分支|留在当前分支|处理.*未提交)/i],
    forbiddenPatterns: [/已提交.*propose/i, /creat(?:ed|ing).*propose commit/i],
    notApplicableReason: null,
    async setup(fixture) {
      await initRepo(fixture.repoDir)
      await writeFile(
        fixture.repoDir,
        'openspec/changes/session-recovery/proposal.md',
        PROPOSE_PROPOSAL,
      )
    },
    async verifySideEffects(fixture) {
      const status = runGit(fixture.repoDir, ['status', '--porcelain', '--untracked-files=all'])
      const expected = '?? openspec/changes/session-recovery/proposal.md'
      const content = readRepoFile(fixture.repoDir, 'openspec/changes/session-recovery/proposal.md')
      const contentUnchanged = content === PROPOSE_PROPOSAL
      return {
        passed: status === expected && contentUnchanged,
        evidence: `status=${status || '(clean)'}; contentUnchanged=${contentUnchanged}`,
      }
    },
  },
  {
    id: 'apply',
    skillCommand: 'apply',
    hostConfig: { reviewExecutor: 'main' },
    prompt: '@lyx-apply eval-change',
    passPatterns: [/run-state/i, /(不一致|差异|partial|部分应用)/i, /(停止|转人工)/],
    forbiddenPatterns: [/Completed tasks: 3\/3/, /任务 2.*(完成|勾选)/],
    notApplicableReason: null,
    async setup(fixture) {
      await initRepo(fixture.repoDir)
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/proposal.md',
        '## Why\n\n验证 partial apply 恢复。\n',
      )
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/design.md', '## Context\n\n使用现有契约。\n')
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/tasks.md',
        [
          '## 1. 实施',
          '',
          '- [ ] 1.1 在 `src/feature.ts` 导出 `feature`。',
          '- [ ] 1.2 完善错误处理。',
          '- [ ] 1.3 补充验证。',
          '',
        ].join('\n'),
      )
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/run-state.md', '# Run State\n\n- Completed tasks: 0/3\n')
      await writeFile(fixture.repoDir, 'src/feature.ts', APPLY_SOURCE)
      commitAll(fixture.repoDir, 'fixture: seed eval change')

      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/tasks.md',
        APPLY_TASKS_CHECKED,
      )
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/run-state.md', APPLY_RUN_STATE_CHECKED)
    },
    async verifySideEffects(fixture) {
      const source = readRepoFile(fixture.repoDir, 'src/feature.ts')
      const tasks = readRepoFile(fixture.repoDir, 'openspec/changes/eval-change/tasks.md')
      const runState = readRepoFile(fixture.repoDir, 'openspec/changes/eval-change/run-state.md')
      const allowedPaths = new Set([
        'openspec/changes/eval-change/tasks.md',
        'openspec/changes/eval-change/run-state.md',
      ])
      const paths = statusPaths(fixture.repoDir)
      const unexpectedPaths = paths.filter(path => !allowedPaths.has(path))
      return {
        passed: source === APPLY_SOURCE
          && tasks === APPLY_TASKS_CHECKED
          && runState.startsWith(APPLY_RUN_STATE_CHECKED)
          && unexpectedPaths.length === 0,
        evidence: `sourceUnchanged=${source === APPLY_SOURCE}; tasksExact=${tasks === APPLY_TASKS_CHECKED}; runStatePrefix=${runState.startsWith(APPLY_RUN_STATE_CHECKED)}; unexpectedPaths=${unexpectedPaths.join(',') || '(none)'}`,
      }
    },
  },
  {
    id: 'review-plan',
    skillCommand: 'review-plan',
    hostConfig: { reviewExecutor: 'main' },
    prompt: '@lyx-review-plan eval-change',
    passPatterns: [/Critical/i, /(接口|参数|返回结构)/, /(验证命令|可执行性|任务缺口|验收方式|验收用例|实现顺序|无法安全继续|缺少.*契约|调用范围)/],
    forbiddenPatterns: [/代码库尚未实现.*Critical/i],
    notApplicableReason: null,
    async setup(fixture) {
      await initRepo(fixture.repoDir)
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/proposal.md',
        [
          '## Why',
          '',
          '需要新增跨模块查询接口。',
          '',
          '## What Changes',
          '',
          '- 新增用户查询接口。',
          '',
          '## Capabilities',
          '',
          '### New Capabilities',
          '- `user-query`: 查询用户。',
          '',
          '## Impact',
          '',
          '- 新增服务端接口。',
          '',
        ].join('\n'),
      )
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/design.md', '## Context\n\n新增接口供页面调用。\n')
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/tasks.md',
        '## 1. 接口\n\n- [ ] 1.1 实现接口并补充适当测试。\n',
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/specs/user-query/spec.md',
        '## ADDED Requirements\n\n### Requirement: 查询用户\n系统 SHALL 支持用户查询。\n',
      )
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/context.md', '# Context\n\n页面需要查询用户。\n')
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/run-state.md', '# Run State\n\n- Stage: review-plan\n')
      const commit = commitAll(
        fixture.repoDir,
        'docs(evals): propose eval change\n\nChange-Stage: propose\nChange-Name: eval-change',
      )
      await writeFile(fixture.repoDir, 'fixture-meta.txt', `propose=${commit}\n`)
    },
    async verifySideEffects(fixture) {
      const paths = statusPaths(fixture.repoDir)
      const touchedSource = paths.filter(path => path === 'src' || path.startsWith('src/'))
      return {
        passed: touchedSource.length === 0,
        evidence: `statusPaths=${paths.join(',') || '(clean)'}; touchedSource=${touchedSource.join(',') || '(none)'}`,
      }
    },
  },
  {
    id: 'review-code',
    skillCommand: 'review-code',
    hostConfig: { reviewExecutor: 'subagent' },
    prompt: [
      '@lyx-review-code eval-change',
      '当前是第 2 轮。请把 `openspec/changes/eval-change/review-round-2.md` 视为审查 subagent 已返回的固定报告，不再随机生成新的审查发现，并按当前 skill 裁决本轮。',
    ].join('\n'),
    passPatterns: [/驳回硬线/, /(可核验|依据|src\/runner\.ts)/],
    forbiddenPatterns: [/自动修复该 Critical/, /已忽略该 Critical/],
    notApplicableReason: null,
    async setup(fixture) {
      await initRepo(fixture.repoDir)
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/proposal.md',
        '## Why\n\n验证误报裁决。\n',
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/run-state.md',
        [
          '# Run State',
          '',
          '- Change: eval-change',
          '- Stage: review-code',
          '- Review rounds: 1',
          `- Round 1 Critical: ${REVIEW_CODE_CRITICAL}`,
          '- Ruling: 不认可；依据：`src/runner.ts:5` 在调用链上层统一捕获并转换该异常。',
          '- Termination type: in-progress',
          '',
        ].join('\n'),
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/review-round-2.md',
        [
          '# Round 2 review input',
          '',
          '## Critical',
          '',
          `1. ${REVIEW_CODE_CRITICAL}`,
          '',
        ].join('\n'),
      )
      await writeFile(fixture.repoDir, 'src/worker.ts', REVIEW_CODE_WORKER)
      await writeFile(fixture.repoDir, 'src/runner.ts', REVIEW_CODE_RUNNER)
      commitAll(
        fixture.repoDir,
        'feat(evals): apply eval change\n\nChange-Stage: apply\nChange-Name: eval-change',
      )
    },
    async verifySideEffects(fixture) {
      const worker = readRepoFile(fixture.repoDir, 'src/worker.ts')
      const runner = readRepoFile(fixture.repoDir, 'src/runner.ts')
      const allowedPaths = new Set([
        'openspec/changes/eval-change/run-state.md',
        'openspec/changes/eval-change/review-findings.md',
      ])
      const paths = statusPaths(fixture.repoDir)
      const unexpectedPaths = paths.filter(path => !allowedPaths.has(path))
      return {
        passed: worker === REVIEW_CODE_WORKER
          && runner === REVIEW_CODE_RUNNER
          && unexpectedPaths.length === 0,
        evidence: `workerExact=${worker === REVIEW_CODE_WORKER}; runnerExact=${runner === REVIEW_CODE_RUNNER}; unexpectedPaths=${unexpectedPaths.join(',') || '(none)'}`,
      }
    },
  },
]

export function getSkillEvalCase(id: EvalSkill): SkillEvalCase {
  const result = skillEvalCases.find(item => item.id === id)
  if (!result)
    throw new Error(`Unknown eval case: ${id}`)
  return result
}
