## MODIFIED Requirements

### Requirement: 全自动路径 = 自动流水线直到审完代码
当且仅当用户在开始时选择"全自动"，`/ly:propose` SHALL 在 propose commit 完成后，读取当前宿主的 `reviewMode`（未配置、空白或非法取值等价 `"full"`；见 `subagent-agent-config`）决定执行哪些审查关卡，并按下列顺序自动执行：

1. **review-plan 关卡（仅 `full` / `plan-only`）**：自动调用 `/ly:review-plan <change-name>`（审查对象为 propose 阶段 commit；按 `ly-review-gates` 的机制执行）。以 Critical 清零结束时自动进入下一步；以其余任一种终止（熔断、驳回硬线、无法安全修复、验证失败、审查调用失败、提交失败、达到全局轮数上限）时，SHALL 停止流水线，复用该循环已产出的终止报告（SHALL NOT 重新生成或重复一份）报告终止原因，SHALL NOT 继续执行 apply。`reviewMode = "code-only"` 或 `"off"` 时 SHALL 跳过本关卡，并打印显式状态行（形如 `[跳过] review-plan（reviewMode=<取值>）`），SHALL NOT 静默跳过。
2. **节点前置校验（进入 apply 前，仅 `full` / `plan-only`）**：进入 apply 之前 SHALL 校验 review-plan 是否以"正常清零结束"收尾——判据为**本会话记录的 review-plan 循环终止类型 == 正常清零**且无未决人工介入项（不依赖清零报告文件等会话外 artifact）。校验 SHALL 在该节点显式打印一行校验结论（含依据：终止类型、是否无未决项），校验不过时复用 review-plan 已产出的终止报告说明阻断原因，SHALL NOT 硬闯 apply。第 1 步跳过 review-plan 时本节一并跳过。
3. **apply**：自动执行 `/ly:apply <change-name>`（实施主体按 `codingExecutor` 决定，见 `ly-lifecycle-commands`；apply 在任何 `reviewMode` 取值下都执行）。apply 实施完成并提交后，主会话 SHALL 记录本次 apply 提交后的 HEAD SHA（`git rev-parse HEAD`）。
4. **节点前置校验（进入 review-code 前，仅 `full` / `code-only`）**：进入 `/ly:review-code <change-name>` 之前 SHALL 按 `commit-conventions` 的定位规约取最近一期 apply 阶段 commit 的 SHA（trailer 优先，旧前缀 `^apply: <change-name>` 回退），并校验其**等于本次 apply 运行记录的 SHA**——历史存在旧 apply commit 不得绕过本次校验。校验不过（SHA 不符、commit 缺失或实施阶段未正常收尾）SHALL 停在该节点如实报告，SHALL NOT 硬闯 review-code。review-code 关卡被跳过时本节一并跳过。
5. **review-code 关卡（仅 `full` / `code-only`）**：自动进入 `/ly:review-code <change-name>`（审查对象为 apply 阶段 commit；同样按 `ly-review-gates` 的机制执行）。以 Critical 清零结束；以其余任一种终止时，SHALL 停止流水线，报告终止原因。`reviewMode = "plan-only"` 或 `"off"` 时 SHALL 跳过本关卡，并打印显式状态行（形如 `[跳过] review-code（reviewMode=<取值>）`），SHALL NOT 静默跳过。

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

### Requirement: 手动路径下询问是否要跑 review-plan，且全程不再问 worktree
`/ly:propose` 在"手动"路径下，propose 阶段 commit 完成后 SHALL 按当前宿主的 `reviewMode`（未配置、空白或非法取值等价 `"full"`；见 `subagent-agent-config`）决定是否发起 review-plan 询问：

- **`full` / `plan-only`**：SHALL 询问用户是否要现在跑一次 `/ly:review-plan <change-name>` 审查循环。询问时 SHALL 附带当前状态摘要：当前阶段（propose 阶段 commit 已完成，带 `Change-Stage: propose` trailer）与下一步（将调用 `@lyx-review-plan <change-name>`，审查对象为该 commit），保证用户选"是"后的续接无歧义。用户选"否"则编排到此结束（方案已 commit，apply/review-code 由用户日后另行 `/ly:apply`/`/ly:review-code` 触发）。用户选"是"则 SHALL 调用 `/ly:review-plan <change-name>`（审查对象为 propose 阶段 commit，清零时由循环统一提交修复，规则与全自动路径一致），循环清零或非清零终止后编排结束，SHALL NOT 自动衔接 apply。
- **`code-only` / `off`**：SHALL NOT 发起 review-plan 询问（手动路径的该询问只针对方案审查），propose 阶段 commit 完成后编排即结束，并 SHALL 打印显式说明（形如 `[跳过] review-plan 询问（reviewMode=<取值>）`），SHALL NOT 静默跳过。

无论哪条分支，apply/review-code 均由用户日后另行 `/ly:apply` / `/ly:review-code` 触发；受 `reviewMode` 约束的只是编排入口——被直接调用的审查命令不受影响（见 `ly-review-gates`）。全程 SHALL NOT 出现 worktree 询问或 `/ly:worktree switch` 调用。

#### Scenario: 手动路径下选择跑审查
- **WHEN** 手动路径下 `reviewMode` 为 `full` / `plan-only`，用户对"是否要跑 review-plan 审查"选择"是"
- **THEN** 命令调用 `/ly:review-plan <change-name>`，审查对象是 propose 阶段 commit；清零时循环统一提交修复，不出现在循环外的提交/worktree 询问；询问时已展示当前阶段与下一步摘要

#### Scenario: 手动路径下选择不跑审查
- **WHEN** 手动路径下 `reviewMode` 为 `full` / `plan-only`，用户对"是否要跑 review-plan 审查"选择"否"
- **THEN** 命令结束编排，方案已由 propose 阶段 commit 落库，不再询问提交或 worktree

#### Scenario: 手动路径 reviewMode=code-only 或 off 不询问 review-plan
- **WHEN** 用户以 `reviewMode = "code-only"`（或 `off`）选择"手动"路径，propose 阶段 commit 完成
- **THEN** 命令不发起 review-plan 询问，打印 `[跳过] review-plan 询问（reviewMode=<取值>）` 状态行后结束编排，SHALL NOT 询问提交或 worktree

### Requirement: 全自动流水线按执行者语义衔接

**适用范围覆盖（自本 change 起）**：本能力中凡以"单审查 subagent（非 fork）机制"或"coding subagent 实施"为前提的 Requirement（含「全自动路径 = 自动流水线直到审完代码」「apply 实施由 coding subagent 执行」），其适用范围 SHALL 限定为对应执行者字段为 `"subagent"` 时；执行者为 `"main"`（默认，含未配置）时 SHALL 以本 Requirement 与 `ly-review-gates` 的「审查执行者可切换（main / subagent）」为准。

全自动路径在被执行的关卡范围内 SHALL 保持原有编排顺序（propose 阶段 commit → review-plan → 节点前置校验 → apply → 节点前置校验 → review-code）；具体执行哪些审查关卡 SHALL 由 `reviewMode` 门控（见「全自动路径 = 自动流水线直到审完代码」——`full` 全跑、`plan-only` 跳过 review-code、`code-only` 跳过 review-plan、`off` 两个审查关卡都跳过，`apply` 始终执行）。每一步 SHALL 按执行者字段决定主体：

- review-plan / review-code 按 `reviewExecutor`（见 `ly-review-gates`）
- apply 按 `codingExecutor`（见 `ly-lifecycle-commands`）

**apply 阶段快照与提交规则 SHALL 同时覆盖两条执行者路径**：主 agent 直接实施时无 subagent 回传清单，SHALL 以主会话自己记录的实施改动文件清单充当回传清单；实施前 `git status --porcelain` 快照、partial apply 检测、index 隔离（按 `commit-conventions` 的"propose / apply 共用提交范围隔离协议"）、`git show --name-only` 校验规则 SHALL 与 subagent 路径一致。

节点前置校验（review-plan 必须正常清零才进 apply；最近一期 apply 阶段 commit（带 `Change-Stage: apply` trailer，定位见 `commit-conventions`）的 SHA 必须等于本次记录才进 review-code）SHALL 在被执行到对应关卡时适用，与执行者选择无关；对应关卡因 `reviewMode` 被跳过时其前置校验一并跳过。

#### Scenario: 全自动路径默认主 agent 执行
- **WHEN** 用户执行 `/ly:propose` 选择"全自动"，未配置执行者字段（等价 `main`），`reviewMode` 为 `full`
- **THEN** 流水线按序自动执行 review-plan（主 agent 直接审查）→ apply（主 agent 直接实施）→ review-code（主 agent 直接审查），节点前置校验照常适用，全程不出现 spawn 与回退标记

#### Scenario: 全自动路径配置为 subagent
- **WHEN** 用户配置 `reviewExecutor = "subagent"` 与 `codingExecutor = "subagent"`，执行 `/ly:propose` 选择"全自动"
- **THEN** 流水线各环节按 subagent 路径执行：审查复用同一子代理，coding subagent 实施后由主会话统一提交

#### Scenario: 主 agent 实施时快照规则照常适用
- **WHEN** `codingExecutor = "main"`，全自动流水线进入 apply，主 agent 直接实施
- **THEN** 主会话仍记录实施前 `git status --porcelain` 快照，以自记录改动清单充当回传清单，partial apply 检测与提交校验照常执行

#### Scenario: reviewMode=off 时编排顺序退化为仅 apply
- **WHEN** 用户配置 `reviewMode = "off"` 并选择"全自动"
- **THEN** 在被执行范围内顺序保持 propose 阶段 commit → apply，review-plan / review-code 被跳过并各打印显式状态行，执行者语义（`codingExecutor`）照常适用
