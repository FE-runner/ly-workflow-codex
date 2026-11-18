# Proposal

## Why

lyx 当前把 `testModeDecision`、隔离方式、来源分支、开发分支和 worktree 路径写入 `openspec/changes/**/.openspec.yaml` 的顶层 `lyx:`。OpenSpec 2.0 将该键视为未知字段并对每个活跃 change 输出 warning；同时这些信息与 `run-state.md` 中已有的来源分支、开发分支和恢复状态重复，形成两个可能漂移的状态源。

本次把新 change 的全部 lyx 运行状态统一到 change 目录的 `run-state.md`，使 `.openspec.yaml` 只承载 OpenSpec 官方字段。已有活跃与归档 change 不迁移，旧 `lyx:` 仅作为兼容读取来源保留。

## What Changes

- 新 change 的 `.openspec.yaml` SHALL NOT 写入 `lyx:` 或 `x-lyx:`；只保留 OpenSpec 官方字段。
- `run-state.md` 增加固定格式的 YAML frontmatter，作为测试模式决策、隔离信息、阶段、流水线位置、commit、续跑坐标等 lyx 机器状态的唯一新写入位置。
- `testMode=ask` 的首次选择在生成 artifacts 前暂存于当前会话，change 目录与 `run-state.md` 建立后立即持久化；若在此之前中断，恢复时重新询问。
- propose、apply、review-plan、review-code、archive 与恢复流程统一读取 `run-state.md` 的固定字段；`testModeDecision`、`isolation`、`sourceBranch`、`developmentBranch`、`worktreePath` 不再从新 change 的 `.openspec.yaml` 读取。
- 旧活跃 change 的 `.openspec.yaml` 保持原样，不自动迁移、不改写。旧 `lyx:` 仅提供只读兼容回退，旧活跃 change 的 OpenSpec warning 持续到自然归档。
- archive 分支收尾优先读取归档后的 `run-state.md`；仅在 run-state 缺少必要字段时回退旧 `.openspec.yaml` 的 `lyx:`。
- 删除旧 `lyx:` 兼容读取属于后续 breaking change，本次不移除。
- 同步更新 skill 模板、相关主 spec、文档、模板断言、run-state 生命周期测试与核心 skill 行为评测场景。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `execution-run-state`: 定义 `run-state.md` YAML frontmatter 的固定机器状态字段、单一状态源地位、旧 run-state 容错与归档后读取规则。
- `worktree-create-before-propose`: 把隔离信息从 `.openspec.yaml` 改为写入 `run-state.md`，并明确首次测试决策的持久化时序。
- `test-mode`: change 级 `ask` 决策从 `.openspec.yaml` 的 `lyx.testModeDecision` 迁移到 `run-state.md`，保留旧 change 的只读兼容。
- `ly-propose-flow`: propose 的 metadata、commit、恢复和后续交接改为消费 run-state，不再写 `.openspec.yaml` 的 lyx 字段。
- `ly-review-gates`: review-plan 与 review-code 从 run-state 读取测试决策，旧 `.openspec.yaml` 仅作为只读兼容来源。
- `archive-verification-gate`: 归档前测试决策来自 run-state，归档提交仅因 run-state 及其他实际操作文件需要而包含对应文件。
- `archive-branch-cleanup`: 归档后隔离与分支信息优先从 run-state 读取，必要时只读回退旧 `.openspec.yaml`。
- `ly-lifecycle-commands`: 生命周期编排对隔离 metadata 的消费位置改为 run-state，并保持 apply/archive 与 propose 的交接一致。

## Impact

- Skill 模板：`templates/skills/propose.md`、`apply.md`、`archive.md`、`worktree.md` 及 propose/review references。
- 项目规范：8 个 Modified Capability 的 delta spec。
- 测试：`src/utils/__tests__/run-state.test.ts`、`src/utils/__tests__/host-adapters.test.ts` 及相关行为评测 fixtures。
- 文档：`README.md`、`README.zh-CN.md`、`AGENTS.md`、`CLAUDE.md`、`templates/CLAUDE.md`、`CHANGELOG.md`。
- 兼容性：所有新建 change 不再产生 `lyx:` warning；旧活跃 change 不迁移且可继续读取旧字段；不改变 OpenSpec 官方字段语义。
