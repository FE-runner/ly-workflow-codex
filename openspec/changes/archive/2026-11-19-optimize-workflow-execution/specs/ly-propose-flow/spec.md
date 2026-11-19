## MODIFIED Requirements

### Requirement: change artifacts 的自然语言跟随宿主配置语言
`@lyx-propose` 在生成 change artifacts 前 SHALL 读取当前宿主 `[general].language`（缺失、空白或非法时按 `zh-CN`），并让 proposal.md、design.md、tasks.md、delta spec 与 context.md 的标题、说明、决策、任务、场景和验收描述使用对应自然语言。OpenSpec schema 要求的栏目结构 SHALL 保留，但栏目标题和自然语言内容 SHALL 按配置语言表达；代码标识符、命令、路径、错误原文和必要技术术语 MAY 保留英文。该规则 SHALL NOT 因 OpenSpec 默认模板为英文而生成全英文正文。

#### Scenario: zh-CN 宿主生成中文方案
- **WHEN** 当前宿主 `[general].language` 为 `zh-CN`，用户运行 `@lyx-propose`
- **THEN** proposal/design/tasks/delta spec/context 的标题与自然语言正文均为中文，技术标识符和命令可保留英文

## REMOVED Requirements

### Requirement: 自审逐项结论写入 run-state，禁止一句带过或独立消息停住
**Reason**: run-state 已删除，且逐项完整文本显著放大了方案阶段输出。
**Migration**: 自审结论改为压缩写入 `context.md`，通过项按范围合并，异常项展开。

### Requirement: propose 与 apply 使用 change 级 ask 决策
**Reason**: change 级决策依赖 run-state 持久化。
**Migration**: `ask` 在 propose 当前调用选择，并在同一全自动回合复用；新的 apply 调用重新解析配置并在 ask 时重新询问。

### Requirement: propose 初始化 change 运行账本
**Reason**: 用户明确要求删除 run-state。
**Migration**: propose 只提交 OpenSpec artifacts 与 `context.md`；阶段和任务事实来自 commits、tasks 与当前会话。

### Requirement: 全自动阶段交接显式加载下一 skill bundle
**Reason**: 原要求把下一阶段坐标写入 run-state，需替换。
**Migration**: 同一回合交接仍必须完整读取下一 bundle，但坐标只来自当前会话和固定命令顺序。

### Requirement: 全自动流水线按执行者语义衔接
**Reason**: 该要求仍把 `executionMode` 写入 run-state。
**Migration**: 执行模式与阶段事实只在同一未中断全自动回合的当前会话中保存，并由现有 Git/tasks/commit 事实校验。

## ADDED Requirements

### Requirement: 方案自审使用压缩结论账本
`@lyx-propose` SHALL 在 `context.md` 的 `## 方案自审` 记录五项检查结果。对连续且结果均为“通过”的条目 MAY 使用范围合并，例如 `What Change 1–8：通过`、`Task 1.1–1.6：通过`；对“不适用 / 已修复 / 待用户决策”的条目 SHALL 单独展开理由或修改说明。记录必须覆盖全部检查对象，但 SHALL NOT 为每个通过项重复一行长句，也 SHALL NOT 以“自审通过，无问题”替代覆盖范围。

#### Scenario: 全部通过
- **WHEN** 一个 change 包含 8 条 What Change、3 个通用维度和 6 个任务且全部通过
- **THEN** `context.md` 可按三个连续范围记录通过，无需逐项重复长句

#### Scenario: 存在异常项
- **WHEN** Task 2.3 需要用户决定接口鉴权
- **THEN** 自审单独列出该 Task 并标记“待用户决策”

#### Scenario: 自审不中断 propose
- **WHEN** 自审无待决策项
- **THEN** 当前回合写入压缩结论、产出 context 并提交 propose，不输出独立自审消息

### Requirement: 全自动中间阶段使用安静报告
全自动流水线 SHALL 只在终端输出每个成功中间阶段的一行状态，包含阶段名、轮次/结果和 commit（如适用）。命令 SHALL NOT 在每个阶段重复完整审查原文、Warning/Info 列表或完成证据；这些细节 SHALL 在最终合并报告中只出现一次，必要时引用 artifact 与 commit。存在 Critical、失败或人工介入条件时 SHALL 立即输出足够的停止详情，不受安静模式限制。

#### Scenario: review-plan 正常清零
- **WHEN** review-plan 在 2 轮后正常清零
- **THEN** 中间输出可只有一行“review-plan: normal, 2 rounds, commit <sha>”，随后继续 apply

#### Scenario: review-code 失败
- **WHEN** review-code 触发驳回硬线
- **THEN** 命令立即输出终止条件、相关 Critical 和可核验依据，不等待最终汇总

### Requirement: propose 与 apply 的 ask 决策只在会话内复用
`@lyx-propose` SHALL 在 effective `testMode = "ask"` 时于生成 artifacts 前询问一次 `normal` / `off`，并在同一未中断全自动回合的 propose、后续审查和 apply 中复用该选择。`@lyx-apply` 在新的直接调用或新用户回合开始时 SHALL 重新解析 effective 配置；若仍为 `ask` 且没有可复用的同回合选择，SHALL 重新询问。命令 SHALL NOT 把决策写入 run-state 或其他专用状态文件；`context.md` MAY 记录人读说明但不作为持久机器决策。

#### Scenario: 全自动同回合复用
- **WHEN** 用户在 propose 选择 `normal`
- **THEN** 同一全自动回合的 review 与 apply 使用 `normal`，不重复询问

#### Scenario: 新 apply 调用重新询问
- **WHEN** 用户稍后直接调用 `@lyx-apply` 且配置仍为 `ask`
- **THEN** apply 重新询问，不假设 propose 的选择仍有效

### Requirement: 全自动交接使用固定顺序与当前会话
`@lyx-propose`、`@lyx-review-plan` 和 `@lyx-apply` 在正常完成且同一回合继续时 SHALL 按固定阶段顺序完整读取同级下一 `lyx-<next-command>/SKILL.md`，并使用当前会话中的 change 与 apply commit SHA。命令 SHALL NOT 从 run-state 读取下一阶段坐标。无法定位 bundle、当前会话结果冲突或所需 commit 缺失时 SHALL 停止并报告。

#### Scenario: review-plan 后进入 apply
- **WHEN** review-plan 正常清零且当前会话记录 change 名
- **THEN** 完整读取同级 `lyx-apply/SKILL.md` 并继续 apply

#### Scenario: apply 后进入 review-code
- **WHEN** apply 正常提交并记录 HEAD SHA
- **THEN** 完整读取同级 `lyx-review-code/SKILL.md` 并校验 HEAD 与本次 apply commit

#### Scenario: 只写下一步命令不算交接
- **WHEN** 当前阶段只输出 `@lyx-apply <change-name>` 而没有读取 bundle
- **THEN** 不得声明全自动已推进

### Requirement: 全自动流水线保持执行者与同步续跑语义
同一未中断全自动回合 SHALL 按 `reviewMode` 决定审查关卡、按 `reviewExecutor` 决定审查主体、按 `codingExecutor` 决定实施主体，并在每步完成后立即继续下一阶段。执行模式只在当前回合内保存；SHALL NOT 写入 `run-state.md`。主 agent 与 subagent 两条路径 SHALL 使用相同的 apply 快照、partial apply 检测、index 隔离和提交校验规则。节点校验 SHALL 使用当前会话记录的 change、正常清零点与 apply commit SHA；信息冲突时以 Git/tasks 事实为准并停止。

#### Scenario: 全自动路径默认主 agent 执行
- **WHEN** 用户选择全自动且执行者均为 `main`
- **THEN** review-plan、apply、review-code 依次由主 agent 执行，不出现 spawn

#### Scenario: 全自动路径配置为 subagent
- **WHEN** reviewExecutor 与 codingExecutor 均为 `subagent`
- **THEN** 审查复用同一子代理，实施子代理回传后由主会话提交

#### Scenario: 阶段报告后不等待用户继续
- **WHEN** review-plan 或 apply 正常完成且无未决项
- **THEN** 当前回合继续下一阶段，不写 run-state，也不等待用户再次触发

#### Scenario: reviewMode=off 时编排顺序退化为仅 apply
- **WHEN** reviewMode 为 `off` 且用户选择全自动
- **THEN** 打印两个审查跳过状态行，仅执行 apply
