## Why

现有 `testMode` 只能在 `normal` 与 `off` 之间预先选择，无法让每个 change 在创建时决定测试策略。用户需要新增 `ask` 模式：首次进入某个 change 时询问一次，持久化选择并让后续 apply / review / archive 沿用，避免同一 change 生命周期内反复询问或前后策略不一致。

## What Changes

- `testMode` 取值扩展为 `normal` / `off` / `ask`；宿主默认、项目覆盖、CLI 管理、init/menu 采集与 doctor/status 展示均支持 `ask`。
- effective 配置仍按项目覆盖 > 宿主默认 > `normal` 解析；其结果是 `ask` 时，change 级命令读取 `.openspec.yaml` 的 `lyx.testModeDecision`（仅 `normal` / `off`）。
- 决策优先级：effective 配置为 `normal` / `off` 时直接使用配置；配置为 `ask` 且 change 已有合法 `testModeDecision` 时沿用；配置为 `ask` 且决策缺失/非法时询问一次，并把选择写回 change 元数据。
- `@lyx-propose` 在 effective 配置为 `ask` 时先询问一次，再生成 artifacts；真实 change 名确定后把选择写入 `.openspec.yaml`，随 propose commit 一次落库。
- `@lyx-apply`、`@lyx-review-plan`、`@lyx-review-code`、`@lyx-archive` 读取已持久化决策；需要补问并写入时，把 `.openspec.yaml` 纳入该阶段提交范围。
- `@lyx-fix` 不创建 change 元数据：effective 配置为 `ask` 时每次调用询问一次，选择仅对本次 fix 生效。
- 未获得回答的非交互环境 SHALL 停止，不得默认 `normal` 或 `off`；最终解析为 `normal` / `off` 后，现有测试义务与无测试模式规则保持不变。
- 补齐配置、CLI、元数据解析、模板与角色词、双语文档及自动化测试。

## Capabilities

### New Capabilities

### Modified Capabilities

- `test-mode`: 新增 `ask` 取值、change 级决策优先级、持久化字段和生命周期消费规则。
- `ly-propose-flow`: propose 在 `ask` 下先询问并持久化决策，apply 使用 change 决策。
- `lightweight-fix-flow`: fix 在 `ask` 下每次调用询问，不持久化 change 决策。
- `ly-review-gates`: review-plan / review-code 使用 change 的持久化决策或按 `ask` 规则补问。
- `archive-verification-gate`: archive 使用 change 决策；缺失时补问并持久化后再决定测试门禁。

## Impact

- 配置与 CLI：`src/types/index.ts`、`src/utils/config.ts`、`src/commands/project.ts`、`src/cli-setup.ts`、`src/i18n/index.ts`
- change 决策解析：更新工作流运行时的 `.openspec.yaml lyx.testModeDecision` 读写契约，不引入新的 YAML 运行时依赖
- 体检与展示：Codex / Claude doctor、`lycx status`
- 工作流模板：`fix`、`propose`、`apply`、`archive`、`review-plan`、`review-code`
- 审查角色词：Codex / Claude plan-reviewer 与 reviewer
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`README.zh-CN.md`、`templates/CLAUDE.md`
- 测试：配置清洗、CLI、元数据解析/持久化、双宿主一致性与模板断言
