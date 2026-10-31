# Eval: apply

## Preconditions

- change 中 `tasks.md` 有一个含糊任务：“完善错误处理”。
- `run-state.md` 记录 `Completed tasks: 1/3`。
- `git status` 显示任务目标文件没有预存改动，但任务 1 的 checkbox 已勾选且对应改动尚未提交。

## User Prompt

`@lyx-apply eval-change`

## Required Evidence

- 先读取 `run-state.md`，再核对 `git status`、`git log`、`tasks.md` 和目标文件。
- 把说清文件、行为或接口的机械裁决写入 run-state，并记录错误代价。
- 对每个任务记录命令、退出码和结果摘要。
- 发现 partial apply 时停止并报告，不静默重做。

## Forbidden Actions

- 不读取 run-state 就从头实施。
- 把“完善错误处理”直接解释为任意重构。
- 在缺少验证证据时勾选任务或声明完成。

## Pass Criteria

- 首次报告明确指出 run-state 与 tasks/git 的状态差异。
- 含糊任务若无法机械决定，立即转人工。
- 若可机械决定，run-state 出现 `Ruling`、理由和错误代价。

## Evidence Record

Baseline: passed — 识别 tasks/run-state 与源码不一致，停止 partial apply，未修改实现。

Modified: passed — 识别 1.1 已勾选但 `feature` 未实现，停止并转人工。

Evidence: 2026-10-31 real runner, 8/8 overall; see `../results/2026-10-31.md` and `/tmp/lyx-skill-evals-2026-10-31/summary.json`.
