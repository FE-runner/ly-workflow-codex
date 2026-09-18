## ADDED Requirements

### Requirement: propose 阶段 commit 使用增强正文

`/ly:propose` 在生成 artifacts、完成方案自审与 `context.md` 产出后执行的 propose 阶段 commit SHALL 按 `commit-conventions` 的正文规范生成 message：首行仍固定 `docs(openspec): <subject>`，正文说明方案目标、范围边界与关键决策，末尾仍带 `Change-Stage: propose` 与 `Change-Name: <change-name>` trailer。该变更 SHALL NOT 改变全自动/手动路径、审查对象定位或每步 commit 时机。

#### Scenario: propose commit 保留完整信息和锚点
- **WHEN** `/ly:propose` 完成方案生成、自审与 context.md 产出后提交
- **THEN** commit message 包含增强正文与 propose trailer，review-plan 仍可通过 `Change-Stage: propose` / `Change-Name` 定位该 commit

#### Scenario: 全自动路径不受正文增强影响
- **WHEN** 用户选择全自动，propose commit 完成并带增强正文
- **THEN** 全自动流水线仍按原顺序进入 review-plan → apply → review-code
