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
