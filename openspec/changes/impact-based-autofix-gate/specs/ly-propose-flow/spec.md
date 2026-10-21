## MODIFIED Requirements

### Requirement: 全自动路径 = 自动流水线直到审完代码
当且仅当用户在开始时选择"全自动"，`/ly:propose` SHALL 在 propose commit 完成后，读取当前宿主的 `reviewMode`（未配置、空白或非法取值等价 `"full"`；见 `subagent-agent-config`）决定执行哪些审查关卡，并按下列顺序自动执行：

1. **review-plan 关卡（仅 `full` / `plan-only`）**：自动调用 `/ly:review-plan <change-name>`（审查对象为 propose 阶段 commit；按 `ly-review-gates` 的机制执行）。以**正常清零**结束时自动进入下一步——"正常清零"的定义以 `ly-review-gates` 为准（Critical 数为 0 **且**所有 `影响落地=是` 的 Warning 都已解决）；以其余任一种终止（熔断、驳回硬线、无法安全修复、验证失败、审查调用失败、提交失败、达到全局轮数上限）时，SHALL 停止流水线，复用该循环已产出的终止报告（SHALL NOT 重新生成或重复一份）报告终止原因，SHALL NOT 继续执行 apply。`reviewMode = "code-only"` 或 `"off"` 时 SHALL 跳过本关卡，并打印显式状态行（形如 `[跳过] review-plan（reviewMode=<取值>）`），SHALL NOT 静默跳过。
2. **节点前置校验（进入 apply 前，仅 `full` / `plan-only`）**：进入 apply 之前 SHALL 校验 review-plan 是否以"正常清零结束"收尾——判据为**本会话记录的 review-plan 循环终止类型 == 正常清零**且无未决人工介入项（不依赖清零报告文件等会话外 artifact）。校验 SHALL 在该节点显式打印一行校验结论（含依据：终止类型、是否无未决项），校验不过时复用 review-plan 已产出的终止报告说明阻断原因，SHALL NOT 硬闯 apply。第 1 步跳过 review-plan 时本节一并跳过。
3. **apply**：自动执行 `/ly:apply <change-name>`（实施主体按 `codingExecutor` 决定，见 `ly-lifecycle-commands`；apply 在任何 `reviewMode` 取值下都执行）。apply 实施完成并提交后，主会话 SHALL 记录本次 apply 提交后的 HEAD SHA（`git rev-parse HEAD`）。
4. **节点前置校验（进入 review-code 前，仅 `full` / `code-only`）**：进入 `/ly:review-code <change-name>` 之前 SHALL 按 `commit-conventions` 的定位规约取最近一期 apply 阶段 commit 的 SHA（trailer 优先，旧前缀 `^apply: <change-name>` 回退），并校验其**等于本次 apply 运行记录的 SHA**——历史存在旧 apply commit 不得绕过本次校验。校验不过（SHA 不符、commit 缺失或实施阶段未正常收尾）SHALL 停在该节点如实报告，SHALL NOT 硬闯 review-code。review-code 关卡被跳过时本节一并跳过。
5. **review-code 关卡（仅 `full` / `code-only`）**：自动进入 `/ly:review-code <change-name>`（审查对象为 apply 阶段 commit；同样按 `ly-review-gates` 的机制执行）。以**正常清零**结束（定义同上）；以其余任一种终止时，SHALL 停止流水线，报告终止原因。`reviewMode = "plan-only"` 或 `"off"` 时 SHALL 跳过本关卡，并打印显式状态行（形如 `[跳过] review-code（reviewMode=<取值>）`），SHALL NOT 静默跳过。

`reviewMode = "off"` 时两个审查关卡均被跳过，apply 仍执行，流水线在 apply 阶段 commit 后结束。流水线执行过程中 SHALL NOT 出现任何 worktree 询问或 `/ly:worktree switch` 调用；`/ly:archive` SHALL 仍由用户手动触发，propose 不自动归档。

#### Scenario: 全自动流水线走到审完代码
- **WHEN** 用户执行 `/ly:propose` 选择"全自动"，`reviewMode` 为 `full`（含未配置），propose 提交完成，review-plan 首轮清零（本会话终止类型为正常清零），apply 实施完成并 commit，review-code 清零
- **THEN** 命令连续自动执行 review-plan → apply → review-code，中途无 worktree 询问、无 switch 调用、无"要不要继续"询问；审完代码后结束，未自动执行 archive

#### Scenario: reviewMode=code-only 跳过 review-plan
- **WHEN** 用户配置 `reviewMode = "code-only"` 并选择"全自动"，propose 阶段 commit 完成
- **THEN** 命令跳过 `/ly:review-plan` 及其进入 apply 的前置校验，打印 `[跳过] review-plan（reviewMode=code-only）` 状态行，直接执行 `/ly:apply`，随后照常执行 `/ly:review-code`

#### Scenario: reviewMode=plan-only 跳过 review-code
- **WHEN** 用户配置 `reviewMode = "plan-only"` 并选择"全自动"，review-plan 正常清零，apply 实施完成并 commit
- **THEN** 命令跳过 `/ly:review-code` 及其前置校验，打印 `[跳过] review-code（reviewMode=plan-only）` 状态行，流水线结束

#### Scenario: reviewMode=off 只实施不审查
- **WHEN** 用户配置 `reviewMode = "off"` 并选择"全自动"，propose 阶段 commit 完成
- **THEN** 命令分别打印 `[跳过] review-plan` 与 `[跳过] review-code` 状态行，仅执行 `/ly:apply`，apply 阶段 commit 后流水线结束，不自动 archive

#### Scenario: 全自动路径下 review-plan 非清零终止即停
- **WHEN** 全自动路径下 `reviewMode` 含方案审查（`full` / `plan-only`），`/ly:review-plan` 的审查-修复循环因熔断或驳回硬线等任一原因停止
- **THEN** 命令停止流水线，复用该循环已产出的终止报告报告原因，SHALL NOT 自动进入 apply；apply 的前置校验亦因终止类型非正常清零而阻断

#### Scenario: apply commit 缺失时停在节点
- **WHEN** `reviewMode` 含代码审查（`full` / `code-only`），apply 实施阶段未正常收尾（coding subagent 报告失败，主会话未提交 apply 阶段 commit），流水线尝试进入 review-code
- **THEN** 前置校验发现 apply 阶段 commit 不存在，命令停在该节点如实报告实施失败详情，SHALL NOT 进入 review-code

#### Scenario: 历史存在旧 apply commit 但 SHA 与本次记录不符
- **WHEN** 中断恢复或重跑后，历史存在旧 apply 阶段 commit，但最近一期 apply commit 的 SHA ≠ 本次 apply 运行记录的 SHA（本次实施未产生新提交）
- **THEN** 节点前置校验发现 SHA 不符，命令停在该节点如实报告"旧 commit 不得作为本次审查对象"，SHALL NOT 以旧 commit 为审查对象进入 review-code

#### Scenario: 手动路径下选跑审查且清零后不再问 worktree
- **WHEN** 手动路径下用户对"是否跑 review-plan"选"是"，`/ly:review-plan` 清零（统一提交修复），随后 apply/review-code 也清零
- **THEN** 全程只在创建方案前问过 worktree，审查清零后不再出现任何 worktree 询问、不自动 archive

#### Scenario: 全自动路径下 review-code 非清零终止即停
- **WHEN** 全自动路径下 `reviewMode` 含代码审查，实施完成后 `/ly:review-code` 的审查-修复循环非清零终止
- **THEN** 命令停止，报告终止原因，不再继续；未自动归档

#### Scenario: 首轮零 Critical 但存在「是」条目时仍按正常清零推进

- **WHEN** 全自动路径下 review-plan（或 review-code）首轮 Critical 数为 0，但存在 1 条标注为「是」的 Warning，当前会话修复后第 2 轮复审确认已解决
- **THEN** 该循环以正常清零结束，流水线按正常清零推进（进入 apply 或结束流水线），SHALL NOT 因"首轮零 Critical"或"本轮曾出现 Warning"而误判为非正常终止
