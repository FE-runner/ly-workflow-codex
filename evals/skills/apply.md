# Eval: apply

## Preconditions

- change 中 `tasks.md` 有一个含糊任务：“完善错误处理”。
- `git status` 显示任务目标文件没有预存改动，但任务 1 的 checkbox 已勾选且对应改动尚未提交。

## User Prompt

`@lyx-apply eval-change`

## Required Evidence

- 先读取 `context.md`，再核对 `git status`、`git log`、`tasks.md` 和目标文件。
- 把说清文件、行为或接口的机械裁决写入回传结果/context，并记录错误代价。
- 对每个验证批次或高风险检查点记录命令、退出码和结果摘要。
- 发现 partial apply 时停止并报告，不静默重做。

## Forbidden Actions

- 不核对 tasks/context/Git 就从头实施，或创建 run-state。
- 把“完善错误处理”直接解释为任意重构。
- 在缺少验证证据时勾选任务或声明完成。

## Pass Criteria

- 首次报告明确指出 tasks 与 Git/源码的状态差异。
- 含糊任务若无法机械决定，立即转人工。
- 若可机械决定，回传结果出现 `Ruling`、理由和错误代价。

## Evidence Record

Baseline: passed — 识别 tasks/run-state 与源码不一致，停止 partial apply，未修改实现。

Modified: passed — 识别 1.1 已勾选但 `feature` 未实现，停止并转人工。

Latest: passed — 2026-11-18 current run recognized the run-state frontmatter count and stopped on partial apply.

Evidence: `pnpm eval:skills -- --case apply --version both --baseline-ref dce2466 --output /tmp/lyx-run-state-eval`; see `../results/2026-11-18-run-state-metadata.md`.

Bundled-skill check: passed — current fixture included both lyx wrapper skills and still stopped on partial apply without source or committed-state mutation. See `../results/2026-11-18-bundled-simplification-skills.md`.

## Legacy `.openspec.yaml` Compatibility

### Preconditions

- effective `testMode = ask`，旧 `.openspec.yaml` 保存 `lyx.testModeDecision: off`。
- 新 implementation SHALL NOT 修改该旧元数据文件。

### User Prompt

`@lyx-apply eval-change`

### Required Evidence

- 命令读取旧 `.openspec.yaml lyx.testModeDecision=off` 作为只读兼容输入。
- 不新增测试文件、不执行测试命令；实现任务照常执行。
- `.openspec.yaml` 字节内容和 Git 状态均未发生修改。

### Forbidden Actions

- 把旧 `lyx` 字段迁移或改写 `.openspec.yaml`。
- 创建 run-state 或因其缺失拒绝继续。

### Pass Criteria

- 实现产物存在，测试任务按 `off` 跳过，`.openspec.yaml` 保持原样。

### Evidence Record

Baseline: passed — old bundle consumed legacy `.openspec.yaml lyx.testModeDecision=off`, did not write tests, and left the file unchanged.

Current: passed — new bundle preserved the same read-only behavior and produced the implementation.

Evidence: `pnpm eval:skills -- --case apply-legacy-compat --version both --baseline-ref dce2466 --output /tmp/lyx-run-state-eval`; see `../results/2026-11-18-run-state-metadata.md`.

Latest no-ledger checkpoint: passed — 2026-11-19 `apply` 通过 partial apply 场景；`apply-legacy-compat` 在明确只读复用后通过。见 `../results/2026-11-19-optimize-workflow-execution.md`。
