import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf-8')

describe('workflow efficiency contract', () => {
  it('keeps new workflow state out of run-state and uses context instead', () => {
    const propose = read('templates/skills/propose.md')
    const apply = read('templates/skills/apply.md')
    const archive = read('templates/skills/archive.md')

    expect(propose).toContain('SHALL NOT 创建、读取或更新 `run-state.md`')
    expect(propose).toContain('## 执行上下文')
    expect(propose).toContain('## 方案自审')
    expect(propose).not.toContain('schemaVersion: 1')
    expect(propose).not.toContain('nextSafeAction:')
    expect(apply).toContain('命令 SHALL NOT 读取 run-state')
    expect(apply).toContain('## 实施说明')
    expect(archive).toContain('命令 SHALL NOT 读取 run-state')
    expect(archive).toContain('## 执行上下文')
  })

  it('uses quiet full-auto handoffs and one final report', () => {
    const propose = read('templates/skills/propose.md')
    const reviewPlan = read('templates/skills/review-plan.md')
    const reviewCode = read('templates/skills/review-code.md')

    for (const content of [propose, reviewPlan, reviewCode]) {
      expect(content).toContain('一行')
      expect(content).not.toContain('逐字完整贴出')
    }
    expect(reviewPlan).toContain('最终报告只汇总一次')
    expect(reviewCode).toContain('最终报告只汇总一次')
  })

  it('reuses review subagents before spawning a replacement', () => {
    const reviewPlan = read('templates/skills/review-plan.md')
    const reviewCode = read('templates/skills/review-code.md')

    for (const content of [reviewPlan, reviewCode]) {
      expect(content).toContain('优先复用同一 subagent')
      expect(content).toContain('复用失败才')
      expect(content).not.toContain('第 2 轮起重新 spawn')
    }
  })

  it('groups low-risk verification while preserving high-risk checkpoints', () => {
    const apply = read('templates/skills/apply.md')
    const implementer = read('templates/hosts/claude/agents/lyx-implementer.md')

    for (const content of [apply, implementer]) {
      expect(content).toContain('行为/契约改动')
      expect(content).toContain('缺陷复现')
      expect(content).toContain('安全/迁移')
      expect(content).toContain('独立验收')
    }
  })

  it('keeps worktree baseline lightweight', () => {
    const worktree = read('templates/skills/worktree.md')
    const propose = read('templates/skills/propose.md')

    expect(worktree).toContain('SHALL NOT 默认运行完整测试套件')
    expect(worktree).toContain('依赖可用性 + typecheck/smoke')
    expect(propose).toContain('SHALL NOT 默认运行完整测试套件')
  })

  it('uses grouped self-review output and context-based test mode', () => {
    const propose = read('templates/skills/propose.md')

    expect(propose).toContain('What Change 1–8：通过')
    expect(propose).toContain('不适用 / 已修复 / 待用户决策 MUST 单独展开')
    expect(propose).toContain('同一未中断全自动回合内复用')
    expect(propose).not.toContain('写入 `lyx.testModeDecision`')
  })
})
