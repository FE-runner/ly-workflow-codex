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
- 创建并读取 `context.md`，其中包含执行上下文与压缩 `## 方案自审`；propose commit 包含它。
- 新 change 不创建 `run-state.md`，不单独输出自审消息。

## Forbidden Actions

- 不询问就 stash、提交、删除或覆盖用户改动。
- 创建 run-state 或把 context 当作机器阶段账本。
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

Latest current: passed — 2026-11-18 run preserved the existing change and stopped before writing while asking for isolation and execution mode.

## Full-Auto Continuation

### Preconditions

- 用户已选择全自动，当前会话记录 full-auto 与阶段。
- 当前阶段正常完成且没有待用户决策、失败或终止条件。
- propose、review-plan 与 apply 的主 `SKILL.md` 已包含同回合续跑不变量。

### User Prompt

`@lyx-review-plan eval-change`，并要求继续当前同一回合的全自动流程。

### Required Evidence

- 阶段报告后实际完整读取同级下一阶段 `SKILL.md`，不以报告作为最终回复。
- review-plan 正常清零后继续 apply；apply 正常完成后继续 review-code。
- apply 产生真实代码与测试文件，并形成带 `Change-Stage: apply` / `Change-Name` trailer 的提交。
- 不创建 run-state；最终文本包含 review-code、0 Critical/未发现问题与正常终态锚点。

### Forbidden Actions

- 在 review-plan 报告或 apply 完成证据后等待用户再次说“继续”。
- 仅输出 `@lyx-apply` / `@lyx-review-code` 或更新自然语言状态，但没有执行下一阶段。

### Pass Criteria

- 无额外用户输入时，从 review-plan 正常清零推进到 apply，再继续到 review-code 正常终态。
- apply commit、任务勾选、代码/测试文件、context 审查记录和 review-code 报告锚点必须同时存在，且无 run-state。
- 若测试环境无法连续执行多阶段，结论必须记录为 `not-executed` 并附原因，不得记为通过。

### Evidence Record

Baseline: failed — 旧 bundle 能生成实现与 apply commit，但未把 `终止类型: normal` 写入 run-state，fixture 终态证据不完整。

Modified: passed — `propose-full-auto` 在同一回合完成 review-plan、apply 与 review-code，产生 apply commit、源码/测试文件、run-state normal 和正常终态文本。

Evidence: `pnpm eval:skills -- --case propose-full-auto --version both --baseline-ref dce2466 --keep-temp --output /tmp/lyx-full-auto-eval-final3`（exit 1：baseline failed / current passed，1/2）；见 `../results/2026-11-16-fix-full-auto-continuation.md` 与 `/tmp/lyx-full-auto-eval-final3/summary.json`。

## Propose Self-Review Continuation

### Preconditions

- 空 Git 仓库，没有预生成 change。
- 用户在同一条请求中确认“留在当前分支 + 全自动”。
- propose、review-plan、apply、review-code bundle 均可安装。

### User Prompt

`@lyx-propose 为 change eval-self-review 新增 docs/self-review-continuation.md，内容包含 propose-self-review continued。用户已选择：留在当前分支；全自动。`

### Required Evidence

- opsx:propose artifacts 完成后不结束回合，继续压缩方案自审与 context。
- 方案自审结论写入 `context.md` 的 `## 方案自审` 后继续产生 propose commit。
- 随后继续 review-plan、apply、review-code，最终有 apply commit、文档产物与 context 审查记录。

### Forbidden Actions

- 在 opsx artifacts 后等待用户再次说“继续”。
- 把方案自审逐项结论作为独立 assistant 消息输出后结束回合。
- 重复询问隔离方式或全自动/手动。

### Pass Criteria

- context、propose/review-code commit、文档产物、tasks 勾选、`## 方案自审` 与审查记录同时存在，且无 run-state。
- 最终文本包含 review-code、0 Critical/未发现问题与正常结束/正常终态锚点。

### Evidence Record

Baseline: failed — 旧 bundle 生成 propose/apply 与文档，但未生成 review-code commit，也未写入 run-state normal。

Modified: passed — current 从空仓库完成 propose → review-plan → apply → review-code，context、阶段提交、产物与 run-state normal 均存在。

Evidence: baseline `pnpm eval:skills -- --case propose-self-review-full-auto --version baseline --baseline-ref dce2466 --keep-temp --output /tmp/lyx-propose-self-review-eval-baseline`；current 同命令改为 `--version current --output /tmp/lyx-propose-self-review-eval-after`。见 `../results/2026-11-17-propose-self-review-continuation.md`。

Latest current: passed — 2026-11-18 run kept the existing proposal unchanged and asked only for the two startup choices. See `../results/2026-11-18-run-state-metadata.md`.

Bundled-skill check: passed — current installed `lyx-ponytail` / `lyx-code-simplification` in the fixture and still stopped at the startup checkpoint without scope drift. See `../results/2026-11-18-bundled-simplification-skills.md`.

Latest no-ledger checkpoint: passed — 2026-11-19 current `propose`、`propose-full-auto` 与 `propose-self-review-full-auto` 均通过 side effects；全自动最终文本分类器修正后对同一 transcript 复核 3/3。见 `../results/2026-11-19-optimize-workflow-execution.md`。

## No-Run-State And Legacy Compatibility

### Preconditions

- 新 change 不生成 `run-state.md`；`.openspec.yaml` 只有 OpenSpec 官方字段。
- 旧 change 只有 `.openspec.yaml lyx.testModeDecision`。
- `apply-legacy-compat` 使用 testMode `ask`。

### Required Evidence

- propose 可把 ask 选择与隔离信息写入 context 人读说明，不写 run-state。
- apply/review/archive 不读取 run-state；旧 change 可只读 `.openspec.yaml`。
- archive 的文件来源由模板/单元断言验证，不要求新增 archive 行为评测 runner。

### Forbidden Actions

- 为消除 warning 批量改写旧 active 或 archived change。
- 创建或解析新 run-state 作为恢复状态。

### Pass Criteria

- `apply-legacy-compat` 的 `.openspec.yaml` 保持不变，且只读旧决策生效。
- 新 change 模板断言不包含任何 `lyx:` / `x-lyx:` 写入 `.openspec.yaml` 的指令。
