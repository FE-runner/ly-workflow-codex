import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf-8')

describe('run-state lifecycle contract', () => {
  it('separates semantic context from execution state and records completed work', () => {
    const spec = read('openspec/specs/execution-run-state/spec.md')
    const propose = read('templates/skill-references/propose/recovery-and-evidence.md')
    expect(spec).toContain('`context.md` 保存讨论语义和取舍背景')
    expect(spec).toContain('`run-state.md` 只保存可恢复执行状态')
    expect(propose).toContain('已完成任务: <done>/<total>')
    expect(propose).toContain('## 基线评测')
    expect(propose).toContain('## 修改后评测（最终）')
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
})
