# Proposal

## Why

当前完整流程的耗时主要集中在两段独立审查、子代理重复 spawn、逐阶段 verbose 报告、逐项运行账本写入和重复验证。真实 skill eval 中，`review-plan` 平均约 134 秒、`review-code` 约 77 秒，两级审查占四阶段总耗时约 72%；不使用完整测试套件时，一轮流程已经接近 5 分钟。

本次删除 `run-state.md` 持久执行账本，把状态恢复收窄为“当前会话 + Git/文件事实”，并同时减少重复子代理 spawn、报告输出和验证次数。**BREAKING**：中断后的跨回合自动恢复、`ask` 测试模式的 change 级持久决策和基于 run-state 的自动分支收尾不再存在。

## What Changes

- **BREAKING** 删除新流程的 `run-state.md` 创建、读取、更新、提交和归档契约；新 change 不再生成该文件。存量 change 的 `run-state.md` 保持原样，不迁移、不删除。
- 全自动流程只依赖当前会话中的执行模式、阶段结果、阶段 commit trailer、`tasks.md` 勾选和 Git 工作区事实；中断后不自动恢复，由用户重新调用目标阶段。
- `context.md` 记录测试模式决策、隔离执行上下文、关键裁决、方案自审摘要和必要的实施说明，不记录阶段机、commit 队列或可恢复流水线状态。
- 方案自审改为压缩账本：通过项按连续范围合并，只展开“不适用 / 已修复 / 待用户决策”的条目。
- 全自动中间阶段只输出一行状态；详细审查轮次和原始文本不重复写入终端，最终只输出一份合并报告。
- 审查 subagent 第 2 轮起优先复用同一会话；只有复用失败才重新 spawn。清理“第 2 轮重新 spawn”的冲突表述。
- apply 按风险分批验证：同一验证命令的连续低风险任务可在批次结束统一验证；行为改动、缺陷复现和独立验证边界仍保留任务级测试。archive 继续执行一次完整测试/类型检查门禁。
- 同一全自动回合不再执行每阶段完整恢复扫描；新用户回合只从当前 Git、`tasks.md`、`context.md` 和审查快照读取必要事实。
- worktree baseline 默认改为低成本可用性检查（依赖状态 + typecheck/项目声明的 smoke check），不默认运行完整测试套件；完整测试留给 archive 门禁。
- `testMode = ask` 决策改为调用会话内决策；跨命令或中断后重新询问。显式配置 `normal` / `off` 仍是推荐的无交互路径。
- 更新 lifecycle 模板、宿主产物、模板断言、行为评测、README、AGENTS、CLAUDE 和主 spec 的对称说明。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `execution-run-state`: 删除 run-state 文件契约，改为会话作用域执行状态和 Git/文件事实恢复。
- `ly-propose-flow`: propose 不再初始化或更新 run-state；自审压缩写入 `context.md`；全自动阶段使用安静报告和会话内续跑。
- `ly-review-gates`: 修正多轮 subagent 复用表述，删除 run-state 读写与重复逐字报告要求。
- `ly-lifecycle-commands`: apply、review、archive 不再把 run-state 作为状态源；apply 使用风险分批验证。
- `test-mode`: `ask` 决策不再跨命令持久化到 run-state，改为会话级决策或重新询问。
- `worktree-create-before-propose`: isolation 信息只写入 `context.md` 供当前流程和归档收尾使用；worktree baseline 降为低成本检查。
- `archive-verification-gate`: 测试模式由配置、旧 `.openspec.yaml` 只读兼容或当前会话决策解析；验证结果通过报告和 commit 证据留存，不写 run-state。
- `archive-branch-cleanup`: 分支收尾从 `context.md`、当前 Git 状态和用户确认推导目标；不再依赖 run-state。
- `skill-behavior-evals`: 更新 eval fixture 与通过条件，覆盖无 run-state、安静续跑、复用和多轮审查。
- `risk-based-testing-policy`: 增加按相同验证命令分批执行、同时保留高风险任务级验证的契约。

## Impact

- 模板：`templates/skills/propose.md`、`apply.md`、`review-plan.md`、`review-code.md`、`archive.md`、`worktree.md`。
- 宿主代码：Claude implementer/reviewer 定义与 Codex review fragments。
- 测试：删除 run-state 专项测试，新增/调整模板断言、eval fixtures 和有效验证节奏断言。
- 文档：README 双语、AGENTS.md、CLAUDE.md、templates/CLAUDE.md、CHANGELOG、行为评测记录。
- 兼容性：存量 run-state 文件不自动删除；新流程忽略它们。跨中断自动续跑和 change 级 `ask` 记忆属于破坏性行为变更。
