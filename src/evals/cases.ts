import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import fs from 'fs-extra'
import { join } from 'pathe'

export const EVAL_SKILLS = ['propose', 'apply', 'review-plan', 'review-code'] as const
export type EvalSkill = typeof EVAL_SKILLS[number]
export const DEFAULT_EVAL_CASES = EVAL_SKILLS
export const EVAL_CASES = [
  'propose',
  'apply',
  'apply-legacy-compat',
  'review-plan',
  'review-code',
  'propose-full-auto',
  'propose-self-review-full-auto',
] as const
export type EvalCaseId = typeof EVAL_CASES[number]

export interface EvalFixture {
  repoDir: string
  homeDir: string
}

export interface SideEffectCheck {
  passed: boolean
  evidence: string
}

export interface SkillEvalCase {
  id: EvalCaseId
  skillCommand: EvalSkill
  skillCommands: EvalSkill[]
  hostConfig?: {
    reviewExecutor?: 'main' | 'subagent'
    testMode?: 'normal' | 'off' | 'ask'
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
const APPLY_RUN_STATE_CHECKED = [
  '---',
  'lyx:',
  '  schemaVersion: 1',
  '  change: eval-change',
  '  stage: apply',
  '  executionMode: manual',
  '  pipelineStage: review-code',
  '  testModeDecision: null',
  '  isolation:',
  '    mode: none',
  '    sourceBranch: main',
  '    developmentBranch: null',
  '    worktreePath: null',
  '  lastGoodCommit: null',
  '  completedTasks:',
  '    done: 1',
  '    total: 3',
  '  review:',
  '    planRounds: 1',
  '    codeRounds: 0',
  '    terminationType: normal',
  '  nextSafeAction:',
  '    command: "@lyx-review-code"',
  '    skillPath: "../lyx-review-code/SKILL.md"',
  '    change: eval-change',
  '    condition: partial apply resolves before review-code',
  '---',
  '',
  '# Run State',
  '',
  '## Task evidence',
  '',
  '- Completed tasks: 1/3',
  '',
].join('\n')
const APPLY_RUN_STATE_EMPTY = APPLY_RUN_STATE_CHECKED
  .replace('  stage: apply', '  stage: apply')
  .replace('    done: 1', '    done: 0')
  .replace('- Completed tasks: 1/3', '- Completed tasks: 0/3')
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

const FULL_AUTO_PROPOSAL = [
  '## Why',
  '',
  '验证全自动流水线不会在阶段报告后暂停。',
  '',
  '## What Changes',
  '',
  '- 创建一个可测试的 feature 模块。',
  '',
  '## Capabilities',
  '',
  '### New Capabilities',
  '',
  '### Modified Capabilities',
  '',
  '## Impact',
  '',
  '- `src/feature.cjs` 与 `test/feature.test.cjs`',
  '',
].join('\n')

const FULL_AUTO_DESIGN = [
  '## Context',
  '',
  '这是一个用于验证多阶段续跑的最小 fixture。',
  '',
  '## Decisions',
  '',
  '- 使用 CommonJS 与 `node --test`，避免引入额外依赖。',
  '',
].join('\n')

const FULL_AUTO_TASKS = [
  '# Tasks',
  '',
  '## 1. 实现',
  '',
  '- [ ] 1.1 创建 `src/feature.cjs` 并导出 `feature()`（返回 `ok`）；创建 `test/feature.test.cjs` 断言该返回值；运行 `node --test test/feature.test.cjs`，退出码必须为 0。',
  '',
].join('\n')

const FULL_AUTO_RUN_STATE = [
  '---',
  'lyx:',
  '  schemaVersion: 1',
  '  change: eval-change',
  '  stage: review-plan',
  '  executionMode: full-auto',
  '  pipelineStage: review-plan',
  '  testModeDecision: null',
  '  isolation:',
  '    mode: none',
  '    sourceBranch: main',
  '    developmentBranch: null',
  '    worktreePath: null',
  '  lastGoodCommit: null',
  '  completedTasks:',
  '    done: 0',
  '    total: 1',
  '  review:',
  '    planRounds: 0',
  '    codeRounds: 0',
  '    terminationType: null',
  '  nextSafeAction:',
  '    command: "@lyx-apply"',
  '    skillPath: "../lyx-apply/SKILL.md"',
  '    change: eval-change',
  '    condition: review-plan normal then continue review-code after apply',
  '---',
  '',
  '# 运行状态',
  '',
  '## 审查状态',
  '',
  '- 尚未开始',
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

function readOptionalRepoFile(repoDir: string, relativePath: string): string {
  const file = join(repoDir, relativePath)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
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
    skillCommands: ['propose'],
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
    skillCommands: ['apply'],
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
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/run-state.md', APPLY_RUN_STATE_EMPTY)
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
    id: 'apply-legacy-compat',
    skillCommand: 'apply',
    skillCommands: ['apply'],
    hostConfig: { reviewExecutor: 'main', testMode: 'ask' },
    prompt: '@lyx-apply eval-change',
    passPatterns: [/legacy|旧|兼容/i, /(testMode.*off|无测试|测试.*跳过)/i],
    forbiddenPatterns: [/修改.*\.openspec\.yaml/i, /写入.*\.openspec\.yaml/i],
    notApplicableReason: null,
    async setup(fixture) {
      const legacyMetadata = [
        'schema: spec-driven',
        'created: 2026-11-16',
        'lyx:',
        '  testModeDecision: off',
        '',
      ].join('\n')
      await initRepo(fixture.repoDir)
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/.openspec.yaml', legacyMetadata)
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/proposal.md', '## Why\n\n验证旧 change 的只读测试模式兼容。\n')
      await writeFile(fixture.repoDir, 'openspec/changes/eval-change/design.md', '## Context\n\n沿用旧格式元数据，不迁移。\n')
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/tasks.md',
        [
          '# Tasks',
          '',
          '## 1. 实施',
          '',
          '- [ ] 1.1 创建 `src/legacy.mjs` 并导出 `legacy()`，运行 `node -e "import(\'./src/legacy.mjs\').then(m => process.exit(m.legacy() === \'ok\' ? 0 : 1))"` 验证退出码为 0。',
          '- [ ] 1.2 按测试模式决定是否新增 `test/legacy.test.ts`；testMode=off 时跳过并记录。',
          '',
        ].join('\n'),
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/run-state.md',
        '# Run State\n\n- Completed tasks: 0/2\n',
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/context.md',
        '# Context\n\n旧 change 没有 YAML frontmatter；`.openspec.yaml lyx.testModeDecision=off` 只读兼容，不得改写。\n',
      )
      commitAll(
        fixture.repoDir,
        'docs(evals): seed legacy compatible change\n\nChange-Stage: propose\nChange-Name: eval-change',
      )
    },
    async verifySideEffects(fixture) {
      const metadata = readRepoFile(fixture.repoDir, 'openspec/changes/eval-change/.openspec.yaml')
      const source = readOptionalRepoFile(fixture.repoDir, 'src/legacy.mjs')
      const testFile = readOptionalRepoFile(fixture.repoDir, 'test/legacy.test.ts')
      const metadataUnchanged = metadata === [
        'schema: spec-driven',
        'created: 2026-11-16',
        'lyx:',
        '  testModeDecision: off',
        '',
      ].join('\n')
      return {
        passed: metadataUnchanged
          && source.includes('legacy')
          && source.includes('ok')
          && testFile === '',
        evidence: `metadataUnchanged=${metadataUnchanged}; source=${source.includes('ok')}; testFile=${testFile ? 'present' : 'absent'}`,
      }
    },
  },
  {
    id: 'review-plan',
    skillCommand: 'review-plan',
    skillCommands: ['review-plan'],
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
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/run-state.md',
        [
          '---',
          'lyx:',
          '  schemaVersion: 1',
          '  change: eval-change',
          '  stage: review-plan',
          '  executionMode: manual',
          '  pipelineStage: review-plan',
          '  testModeDecision: null',
          '  isolation:',
          '    mode: none',
          '    sourceBranch: main',
          '    developmentBranch: null',
          '    worktreePath: null',
          '  lastGoodCommit: null',
          '  completedTasks:',
          '    done: 0',
          '    total: 1',
          '  review:',
          '    planRounds: 0',
          '    codeRounds: 0',
          '    terminationType: in-progress',
          '  nextSafeAction:',
          '    command: "@lyx-review-plan"',
          '    skillPath: "../lyx-review-plan/SKILL.md"',
          '    change: eval-change',
          '    condition: review pending',
          '---',
          '',
          '# Run State',
          '',
          '## Review state',
          '',
          '- Round 1: not started',
          '',
        ].join('\n'),
      )
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
    skillCommands: ['review-code'],
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
          '---',
          'lyx:',
          '  schemaVersion: 1',
          '  change: eval-change',
          '  stage: review-code',
          '  executionMode: manual',
          '  pipelineStage: review-code',
          '  testModeDecision: null',
          '  isolation:',
          '    mode: none',
          '    sourceBranch: main',
          '    developmentBranch: null',
          '    worktreePath: null',
          '  lastGoodCommit: null',
          '  completedTasks:',
          '    done: 1',
          '    total: 1',
          '  review:',
          '    planRounds: 1',
          '    codeRounds: 1',
          '    terminationType: in-progress',
          '  nextSafeAction:',
          '    command: "@lyx-review-code"',
          '    skillPath: "../lyx-review-code/SKILL.md"',
          '    change: eval-change',
          '    condition: adjudicate round 2',
          '---',
          '',
          '# Run State',
          '',
          '## Review state',
          '',
          `- Round 1 Critical: ${REVIEW_CODE_CRITICAL}`,
          '- Ruling: 不认可；依据：`src/runner.ts:5` 在调用链上层统一捕获并转换该异常。',
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
  {
    id: 'propose-full-auto',
    skillCommand: 'review-plan',
    skillCommands: ['review-plan', 'apply', 'review-code'],
    hostConfig: { reviewExecutor: 'main' },
    prompt: [
      '@lyx-review-plan eval-change',
      '继续当前全自动流程。',
    ].join('\n'),
    passPatterns: [
      /review-code/,
      /(?:0\s*Critical|未发现\s*Critical|未发现问题)/,
      /(?:全自动流程.*(?:完成|跑完|正常结束)|正常终态)/,
    ],
    forbiddenPatterns: [/请回复.*继续/, /等待用户.*触发/],
    notApplicableReason: null,
    async setup(fixture) {
      await initRepo(fixture.repoDir)
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/.openspec.yaml',
        'schema: spec-driven\nskip_specs: true\ncreated: 2026-11-16\n',
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/proposal.md',
        FULL_AUTO_PROPOSAL,
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/design.md',
        FULL_AUTO_DESIGN,
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/tasks.md',
        FULL_AUTO_TASKS,
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/context.md',
        '# Context\n\n这是全自动跨阶段续跑 fixture；只实施上述 change 范围。\n',
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/run-state.md',
        FULL_AUTO_RUN_STATE,
      )
      const proposeCommit = commitAll(
        fixture.repoDir,
        'docs(evals): propose full-auto change\n\nChange-Stage: propose\nChange-Name: eval-change',
      )
      await writeFile(
        fixture.repoDir,
        'openspec/changes/eval-change/run-state.md',
        FULL_AUTO_RUN_STATE.replace('  lastGoodCommit: null', `  lastGoodCommit: ${proposeCommit}`),
      )
      await writeFile(fixture.homeDir, 'eval-metadata.txt', `propose=${proposeCommit}\n`)
    },
    async verifySideEffects(fixture) {
      const tasks = readRepoFile(fixture.repoDir, 'openspec/changes/eval-change/tasks.md')
      const runState = readRepoFile(fixture.repoDir, 'openspec/changes/eval-change/run-state.md')
      const source = readOptionalRepoFile(fixture.repoDir, 'src/feature.cjs')
      const testFile = readOptionalRepoFile(fixture.repoDir, 'test/feature.test.cjs')
      const applyCommit = runGit(fixture.repoDir, [
        'log',
        '--grep=^Change-Stage: apply$',
        '--grep=^Change-Name: eval-change$',
        '--all-match',
        '-1',
        '--format=%H',
      ])
      const paths = statusPaths(fixture.repoDir)
      const unexpectedPaths = paths.filter(path => !path.startsWith('openspec/changes/eval-change/'))
      const tasksChecked = !tasks.includes('- [ ]')
      const runStateNormal = /terminationType:\s*normal|终止类型[：:]\s*normal/.test(runState)
      const applyCommitted = applyCommit.length > 0
      const featureImplemented = source.includes('feature') && source.includes('ok')
      const testImplemented = testFile.includes('node:test') && testFile.includes('feature')
      return {
        passed: tasksChecked
          && runStateNormal
          && applyCommitted
          && featureImplemented
          && testImplemented
          && unexpectedPaths.length === 0,
        evidence: `tasksChecked=${tasksChecked}; runStateNormal=${runStateNormal}; applyCommit=${applyCommit || '(missing)'}; featureImplemented=${featureImplemented}; testImplemented=${testImplemented}; unexpectedPaths=${unexpectedPaths.join(',') || '(none)'}`,
      }
    },
  },
  {
    id: 'propose-self-review-full-auto',
    skillCommand: 'propose',
    skillCommands: ['propose', 'review-plan', 'apply', 'review-code'],
    hostConfig: { reviewExecutor: 'main' },
    prompt: [
      '@lyx-propose 为 change eval-self-review 新增 docs/self-review-continuation.md，内容包含 propose-self-review continued。',
      '用户已选择：留在当前分支；全自动。',
    ].join('\n'),
    passPatterns: [
      /review-code/,
      /(?:0\s*Critical|未发现\s*Critical|未发现问题)/,
      /(?:全自动流程.*(?:完成|跑完|正常结束)|正常终态)/,
    ],
    forbiddenPatterns: [/请回复.*(?:隔离|全自动|手动)/, /等待用户.*触发/],
    notApplicableReason: null,
    async setup(fixture) {
      await initRepo(fixture.repoDir)
      await writeFile(fixture.homeDir, 'eval-metadata.txt', 'scenario=from-empty\n')
    },
    async verifySideEffects(fixture) {
      const context = readOptionalRepoFile(
        fixture.repoDir,
        'openspec/changes/eval-self-review/context.md',
      )
      const tasks = readOptionalRepoFile(
        fixture.repoDir,
        'openspec/changes/eval-self-review/tasks.md',
      )
      const runState = readOptionalRepoFile(
        fixture.repoDir,
        'openspec/changes/eval-self-review/run-state.md',
      )
      const document = readOptionalRepoFile(
        fixture.repoDir,
        'docs/self-review-continuation.md',
      )
      const proposeCommit = runGit(fixture.repoDir, [
        'log',
        '--grep=^Change-Stage: propose$',
        '--grep=^Change-Name: eval-self-review$',
        '--all-match',
        '-1',
        '--format=%H',
      ])
      const reviewCodeCommit = runGit(fixture.repoDir, [
        'log',
        '--grep=^Change-Stage: review-code-fix$',
        '--grep=^Change-Name: eval-self-review$',
        '--all-match',
        '-1',
        '--format=%H',
      ])
      const paths = statusPaths(fixture.repoDir)
      const allowedOpenSpecInitPaths = new Set([
        'openspec/config.yaml',
        'openspec/specs/.gitkeep',
        'openspec/changes/archive/.gitkeep',
      ])
      const unexpectedPaths = paths.filter(path =>
        !path.startsWith('openspec/changes/eval-self-review/')
        && !allowedOpenSpecInitPaths.has(path),
      )
      const contextCreated = context.trim().length > 0
      const tasksChecked = tasks.length > 0 && !tasks.includes('- [ ]')
      const runStateNormal = /terminationType:\s*normal|终止类型[：:]\s*normal/.test(runState)
      const proposeCommitted = proposeCommit.length > 0
      const reviewCodeCommitted = reviewCodeCommit.length > 0
      const documentCreated = document.includes('propose-self-review continued')
      return {
        passed: contextCreated
          && tasksChecked
          && runStateNormal
          && proposeCommitted
          && reviewCodeCommitted
          && documentCreated
          && unexpectedPaths.length === 0,
        evidence: `contextCreated=${contextCreated}; tasksChecked=${tasksChecked}; runStateNormal=${runStateNormal}; proposeCommit=${proposeCommit || '(missing)'}; reviewCodeCommit=${reviewCodeCommit || '(missing)'}; documentCreated=${documentCreated}; unexpectedPaths=${unexpectedPaths.join(',') || '(none)'}`,
      }
    },
  },
]

export function getSkillEvalCase(id: EvalCaseId): SkillEvalCase {
  const result = skillEvalCases.find(item => item.id === id)
  if (!result)
    throw new Error(`Unknown eval case: ${id}`)
  return result
}
