import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf-8')
const ACTIVE_CHANGE = 'openspec/changes/move-lyx-state-to-run-state'
function readSpec(id: string): string {
  const active = `${ACTIVE_CHANGE}/specs/${id}/spec.md`
  return read(existsSync(join(ROOT, active)) ? active : `openspec/specs/${id}/spec.md`)
}

describe('run-state lifecycle contract', () => {
  it('separates semantic context from execution state and records completed work', () => {
    const spec = read('openspec/specs/execution-run-state/spec.md')
    const propose = read('templates/skill-references/propose/recovery-and-evidence.md')
    expect(spec).toContain('`context.md` 保存讨论语义和取舍背景')
    expect(spec).toContain('`run-state.md` 只保存可恢复执行状态')
    expect(propose).toContain('已完成任务: <done>/<total>')
    expect(propose).toContain('## 基线评测')
    expect(propose).toContain('## 修改后评测（最终）')
    expect(propose).toContain('schemaVersion: 1')
    expect(propose).toContain('testModeDecision: normal | off | null')
    expect(propose).toContain('isolation:')
    expect(propose).toContain('completedTasks:')
    expect(propose).toContain('review:')
    expect(propose).toContain('nextSafeAction:')
  })

  it('recovers from git/files, backfills commit SHA, and forbids secrets', () => {
    const apply = read('templates/skills/apply.md')
    const archive = read('templates/skills/archive.md')
    const spec = read('openspec/specs/execution-run-state/spec.md')
    expect(apply).toContain('启动恢复（SHALL）')
    expect(apply).toContain('以可核验事实为准')
    expect(archive).toContain('final testMode')
    expect(spec).toContain('待本次阶段提交归属')
    expect(spec).toContain('SHALL NOT 写入凭据、token')
  })

  it('persists full-auto mode and keeps intermediate stage reports non-terminal', () => {
    const propose = read('templates/skill-references/propose/propose-contract.md')
    const apply = read('templates/skills/apply.md')
    const reviewPlan = read('templates/skill-references/review-plan/review-contract.md')
    const recovery = read('templates/skill-references/propose/recovery-and-evidence.md')
    const runStateSpec = readSpec('execution-run-state')
    const proposeSpec = read('openspec/specs/ly-propose-flow/spec.md')

    expect(recovery).toContain('executionMode: full-auto | manual')
    expect(recovery).toContain('pipelineStage: review-plan | apply | review-code | none')
    expect(recovery).toContain('testModeDecision: normal | off | null')
    expect(recovery).toContain('nextSafeAction:')
    expect(propose).toContain('`EXECUTION_MODE=full-auto`')
    expect(propose).toContain('阶段报告非终态')
    expect(propose).toContain('SHALL NOT 在此结束回合')
    expect(reviewPlan).toContain('阶段报告非终态')
    expect(reviewPlan).toContain('SHALL NOT 等待用户再次触发')
    expect(apply).toContain('阶段报告非终态')
    expect(runStateSpec).toContain('执行模式（`full-auto` / `manual`）')
    expect(runStateSpec).toContain('frontmatter 字段名 SHALL 使用本能力定义的稳定英文标识')
    expect(read('openspec/specs/execution-run-state/spec.md')).toContain('阶段报告非终态')
    expect(proposeSpec).toContain('阶段报告非终态')
  })

  it('keeps continuation invariants in main skills and initializes run-state before self-review', () => {
    const proposeMain = read('templates/skills/propose.md')
    const reviewPlanMain = read('templates/skills/review-plan.md')
    const applyMain = read('templates/skills/apply.md')
    const proposeContract = read('templates/skill-references/propose/propose-contract.md')
    const recovery = read('templates/skill-references/propose/recovery-and-evidence.md')

    expect(proposeMain).toContain('全自动执行不变量（最高优先级）')
    expect(proposeMain).toContain('不得结束当前回合')
    expect(proposeMain).toContain('run-state.md')
    expect(proposeMain).toContain('lyx-review-plan/SKILL.md')
    expect(proposeMain).toContain('lyx-apply/SKILL.md')
    expect(proposeMain).toContain('lyx-review-code/SKILL.md')
    expect(proposeMain).toContain('SHALL NOT 视为已进入下一阶段')
    expect(proposeMain).toContain('Planning boundary')
    expect(proposeMain).toContain('方案自审清单 MUST 输出')
    expect(proposeMain).toContain('propose 内部 checkpoint')
    expect(proposeMain).toContain('propose-self-review')
    expect(reviewPlanMain).toContain('全自动执行不变量（最高优先级）')
    expect(reviewPlanMain).toContain('正常清零')
    expect(reviewPlanMain).toContain('lyx-apply/SKILL.md')
    expect(reviewPlanMain).toContain('frontmatter 声明的全部 references')
    expect(applyMain).toContain('全自动执行不变量（最高优先级）')
    expect(applyMain).toContain('lyx-review-code/SKILL.md')
    expect(applyMain).toContain('frontmatter 声明的全部 references')
    expect(recovery).toContain('下一阶段命令、同级 skill 路径、change 参数和继续条件')
    expect(recovery).toContain('lyx-<next-command>/SKILL.md')

    expect(proposeContract).toContain('### 4.5 初始化 run-state.md（方案自审前）')
    expect(proposeContract).toContain('### 0. 启动恢复（创建方案前）')
    expect(proposeContract).toContain('Planning boundary 从属规则（SHALL）')
    expect(proposeContract).toContain('propose 内部 checkpoint')
    expect(proposeContract).toContain('lyx.stage: propose-self-review')
    expect(proposeContract.indexOf('### 4.5 初始化 run-state.md（方案自审前）'))
      .toBeLessThan(proposeContract.indexOf('### 5. 方案自审'))
  })

  it('requires fresh command evidence before completion claims', () => {
    for (const path of [
      'templates/skills/apply.md',
      'templates/skills/fix.md',
      'templates/skill-references/review-plan/recovery-and-evidence.md',
      'templates/skill-references/review-code/recovery-and-evidence.md',
      'templates/skills/archive.md',
    ]) {
      expect(read(path), path).toMatch(/命令.*退出码.*结果摘要/)
    }
  })

  it('keeps propose artifacts and run-state in the configured language', () => {
    const propose = read('templates/skill-references/propose/propose-contract.md')
    const recovery = read('templates/skill-references/propose/recovery-and-evidence.md')
    const spec = read('openspec/specs/execution-run-state/spec.md')
    const proposeSpec = read('openspec/specs/ly-propose-flow/spec.md')

    expect(propose).toContain('`[general].language`')
    expect(propose).toContain('proposal.md、design.md、tasks.md、delta spec、context.md 与 run-state.md')
    expect(recovery).toContain('# 运行状态')
    expect(recovery).toContain('## 任务证据')
    expect(spec).toContain('自然语言')
    expect(proposeSpec).toContain('change artifacts 的自然语言跟随宿主配置语言')

    for (const path of [
      'templates/skills/apply.md',
      'templates/skills/archive.md',
      'templates/skill-references/review-plan/recovery-and-evidence.md',
      'templates/skill-references/review-code/recovery-and-evidence.md',
    ]) {
      expect(read(path), path).toContain('沿用 `run-state.md` 现有语言')
    }
  })

  it('treats run-state frontmatter as the only new lyx state source', () => {
    const templates = [
      'templates/skill-references/propose/propose-contract.md',
      'templates/skill-references/propose/recovery-and-evidence.md',
      'templates/skills/propose.md',
      'templates/skills/apply.md',
      'templates/skills/archive.md',
      'templates/skill-references/review-plan/review-contract.md',
      'templates/skill-references/review-plan/recovery-and-evidence.md',
      'templates/skill-references/review-code/review-contract.md',
      'templates/skill-references/review-code/recovery-and-evidence.md',
      'templates/skills/worktree.md',
    ]

    for (const path of templates) {
      const content = read(path)
      expect(content, path).toContain('run-state.md')
      const forbiddenWrites = content.split('\n').filter(line =>
        /写入|写回/.test(line)
        && /\.openspec\.yaml/.test(line)
        && /lyx|x-lyx|testModeDecision|isolation/.test(line)
        && !/SHALL NOT|不得|只读|旧/.test(line),
      )
      expect(forbiddenWrites, path).toEqual([])
    }
  })

  it('stops on malformed state while prompting only for recoverable decisions', () => {
    const testMode = readSpec('test-mode')
    const runState = readSpec('execution-run-state')

    for (const marker of [
      'frontmatter 不可读',
      '`testModeDecision` 为 object/list/number',
      '缺失、为 `null`，或为不在 `normal` / `off` 中的字符串',
      '旧 `.openspec.yaml`',
      '旧 `lyx` 不是 mapping，或其中的 `testModeDecision` 存在且既不是 string 也不是 null',
    ]) {
      expect(testMode, marker).toContain(marker)
    }

    expect(runState).toContain('目标 change 没有 YAML frontmatter')
    expect(runState).toContain('`schemaVersion` 缺失或不受支持')
    expect(runState).toContain('`lyx` 缺失或不是 mapping')
    expect(runState).toContain('损坏并停止')
    expect(runState).toContain('SHALL NOT 静默回退旧元数据或覆盖该文件')
    expect(runState).toContain('正文 SHALL NOT 作为上述机器字段的第二权威来源')
  })
})
