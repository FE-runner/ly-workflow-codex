## ADDED Requirements

### Requirement: apply 实施由 coding subagent 执行
`@lyx-apply` 的实施环节 SHALL 由 coding subagent 执行：主会话 spawn 一个 coding subagent，fork 当前会话上下文，并在任务中点名"只实施 change 范围"（读取 `openspec/changes/<change-name>/tasks.md` 逐任务实施 + 验证 + 勾选，SHALL NOT 改动范围外文件）。模型 SHALL 按 `codexHost.codingModel` 指定，未配置回退当前会话模型。coding subagent SHALL NOT 自行 commit：实施完成后将改动与结果回传主会话，由主会话确认后统一 `git commit -m "apply: <change-name>"`。coding subagent 实施失败 SHALL 原样呈报转人工，不自动重试、不自动兜底（与既有 apply 语义一致）。

#### Scenario: coding subagent 完成实施
- **WHEN** coding subagent 读 tasks.md 完成全部任务并验证通过
- **THEN** 改动回传主会话，主会话确认后提交 `apply: <change-name>`，作为 `@lyx-review-code` 的审查对象

#### Scenario: coding subagent 实施失败
- **WHEN** coding subagent 报告任务未完成或验证失败
- **THEN** 主会话原样呈报失败详情转人工，不自动重试、不切回自实施、不 commit

## MODIFIED Requirements

### Requirement: 全自动路径 = 自动流水线直到审完代码
当且仅当用户在开始时选择"全自动"，`/ly:propose` SHALL 在 `propose:` commit 完成后自动按序执行：
1. 自动调用 `/ly:review-plan <change-name>`（审查对象为 `propose:` commit；按 `ly-review-gates` 的双审查 subagent 机制执行）。以 Critical 清零结束时自动进入下一步；以其余任一种终止（熔断、分歧未决、无法安全修复、验证失败、审查调用失败、提交失败、达到全局轮数上限）时，SHALL 停止流水线，复用该循环已产出的终止报告（SHALL NOT 重新生成或重复一份）报告终止原因，SHALL NOT 继续执行 apply。
2. 自动进入 `/ly:apply <change-name>` 实施 tasks（实施由 coding subagent 执行，见本 delta ADDED Requirement；`apply:` commit 由主会话统一提交），自动进入 `/ly:review-code <change-name>`（审查对象为 `apply:` commit；同样按双审查 subagent 机制执行）。以 Critical 清零结束；以其余任一种终止时，SHALL 停止流水线，报告终止原因。

流水线执行过程中 SHALL NOT 出现任何 worktree 询问或 `/ly:worktree switch` 调用；`/ly:archive` SHALL 仍由用户手动触发，propose 不自动归档。

#### Scenario: 全自动流水线走到审完代码
- **WHEN** 用户执行 `/ly:propose` 选择"全自动"，`propose:` 提交完成，review-plan 首轮清零，apply 实施完成并 commit，review-code 清零
- **THEN** 命令连续自动执行 review-plan → apply → review-code，中途无 worktree 询问、无 switch 调用、无"要不要继续"询问；审完代码后结束，未自动执行 archive

#### Scenario: 手动路径下选跑审查且清零后不再问 worktree
- **WHEN** 手动路径下用户对"是否跑 review-plan"选"是"，`/ly:review-plan` 清零（统一提交修复），随后 apply/review-code 也清零
- **THEN** 全程只在创建方案前问过 worktree，审查清零后不再出现任何 worktree 询问、不自动 archive

#### Scenario: 全自动路径下 review-plan 非清零终止即停
- **WHEN** 全自动路径下 `/ly:review-plan` 的审查-修复循环因熔断或分歧未决等任一原因停止
- **THEN** 命令停止流水线，复用该循环已产出的终止报告报告原因，SHALL NOT 自动进入 apply，不产生任何切换动作

#### Scenario: 全自动路径下 review-code 非清零终止即停
- **WHEN** 全自动路径下实施完成后 `/ly:review-code` 的审查-修复循环非清零终止
- **THEN** 命令停止，报告终止原因，不再继续；未自动归档
