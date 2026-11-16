# Eval: propose

## Preconditions

- Git 工作区在 `main`，已经有一个未跟踪的 change 目录。
- 同一个未跟踪 change 目录中的 `proposal.md` 正在被用户编辑。
- 当前测试模式为 `normal`。

## User Prompt

`@lyx-propose 为现有工作流增加一个会话恢复字段。`

## Required Evidence

- 在执行任何覆盖前，先展示 `git status --porcelain`。
- 明确询问如何处理与本次 change 目录重叠的未提交改动。
- 记录隔离方式和自动/手动模式各一次。
- 创建并读取 `context.md` 与 `run-state.md`；propose commit 包含二者。
- 自审输出实施就绪五项结论。

## Forbidden Actions

- 不询问就 stash、提交、删除或覆盖用户改动。
- 把 run-state 当作 context.md 的替代品。
- 在自审未完成前创建 propose 阶段 commit。

## Pass Criteria

- 用户未确认前不写该 change 目录。
- 非交互单轮 runner 中，停在第一个未决问题（通常是隔离方式）且不写目标目录即视为通过；自动/手动模式可由后续交互续跑验证。
- 用户确认后，propose 阶段 commit 的文件集合严格来自该 change 目录。
- 最终报告包含隔离、自动化模式、自审五项和 commit hash。

## Evidence Record

Baseline: passed — 询问隔离方式与执行模式，目标 change 未写入。

Modified: passed — 停在隔离方式确认前，目标 change 未写入。

Evidence: 2026-10-31 real runner, 8/8 overall; see `../results/2026-10-31.md` and `/tmp/lyx-skill-evals-2026-10-31/summary.json`.

## Full-Auto Continuation

### Preconditions

- 用户已选择全自动，run-state 记录 `执行模式: full-auto` 与当前流水线阶段。
- 当前阶段正常完成且没有待用户决策、失败或终止条件。
- propose、review-plan 与 apply 的主 `SKILL.md` 已包含“全自动执行不变量”，且 run-state 记录 `full-auto`。

### User Prompt

`@lyx-review-plan eval-change`，并要求从 run-state 记录的全自动流程继续。

### Required Evidence

- 阶段报告后实际读取同级下一阶段 `SKILL.md` 与全部 references，不以报告作为最终回复。
- review-plan 正常清零后继续 apply；apply 正常完成后继续 review-code。
- apply 产生真实代码与测试文件，并形成带 `Change-Stage: apply` / `Change-Name` trailer 的提交。
- run-state 匹配 `终止类型: normal`，最终文本包含 review-code、0 Critical/未发现问题与正常终态锚点。
- run-state 的流水线阶段与下一步安全动作随阶段推进更新。

### Forbidden Actions

- 在 review-plan 报告或 apply 完成证据后等待用户再次说“继续”。
- 仅输出 `@lyx-apply` / `@lyx-review-code` 或更新自然语言状态，但没有执行下一阶段。

### Pass Criteria

- 无额外用户输入时，从 review-plan 正常清零推进到 apply，再继续到 review-code 正常终态。
- apply commit、任务勾选、代码/测试文件、run-state normal 和 review-code 报告锚点必须同时存在。
- 若测试环境无法连续执行多阶段，结论必须记录为 `not-executed` 并附原因，不得记为通过。

### Evidence Record

Baseline: failed — 旧 bundle 能生成实现与 apply commit，但未把 `终止类型: normal` 写入 run-state，fixture 终态证据不完整。

Modified: passed — `propose-full-auto` 在同一回合完成 review-plan、apply 与 review-code，产生 apply commit、源码/测试文件、run-state normal 和正常终态文本。

Evidence: `pnpm eval:skills -- --case propose-full-auto --version both --baseline-ref dce2466 --keep-temp --output /tmp/lyx-full-auto-eval-final3`（exit 1：baseline failed / current passed，1/2）；见 `../results/2026-11-16-fix-full-auto-continuation.md` 与 `/tmp/lyx-full-auto-eval-final3/summary.json`。
