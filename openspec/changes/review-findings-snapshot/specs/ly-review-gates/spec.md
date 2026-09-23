## MODIFIED Requirements

### Requirement: 审查关卡以单审查 subagent（非 fork）执行

review-plan 与 review-code 两个审查关卡 SHALL 各 spawn **1 个**审查 subagent 执行本轮审查；SHALL NOT spawn 第二个审查 agent，SHALL NOT 实现或保留"并行双审、交换结论、共识归并"环节——单 agent 的分级结论即本轮审查唯一审查发现来源，逐条 Critical 由主会话裁决（见「Critical 裁决：认可即修复、不认可必须附可核验依据」），SHALL NOT 因"只有一个 agent"而跳过裁决或把结论当作自动生效。

**非 fork spawn**：审查 subagent SHALL 以非 fork 方式 spawn——子代理只携带 spawn 消息（TASK），SHALL NOT 携带父线程对话历史（宿主 V1 语义为 `fork_context: false` 默认值；V2 语义为 `fork_turns: none`）。仅当宿主不支持完全非 fork 而仅支持"最近 N 轮"fork 模式时，SHALL 取最小 N（或 0）近似非 fork 并在报告中如实说明；SHALL NOT 使用全量 fork（`fork_turns: all`）。

**软上下文载体**：非 fork 意味着主会话讨论中的软上下文（关键决策、取舍、已知边界）不再随 fork 自动到达审查 agent；TASK SHALL 指示审查 subagent 读取该 change 目录下的 `context.md`（见 `review-context-artifact` 能力）获取软上下文，SHALL NOT 在 TASK 中整段复制其内容。

**范围点名与角色词**：审查任务 SHALL 点名审查范围（review-plan 为"只审 change 产物：proposal/design/specs/tasks"——该点名范围本身是显式枚举的文件集合，不包含 `context.md`；review-code 为"只审最近一次相关 commit 对应 diff（apply 阶段 commit，未有 apply 阶段 commit 时退化为 propose 阶段 commit；两者定位见 `commit-conventions`）及未跟踪清单"——`context.md` 可能因 apply 阶段回写而实际出现在该 diff 范围内，此时 SHALL NOT 因其出现在 diff 中而将其当作可挑错的审查对象或修复对象）。两个命令共同遵守：`context.md` 始终只是背景引用来源（见「软上下文载体」），SHALL NOT 被当作可挑错的审查对象或修复对象；`review-findings.md`（审查未修项快照，见 `review-findings-snapshot`）SHALL NOT 被当作可挑错的审查对象或修复对象，且 SHALL 从审查命令的未跟踪（`??`）清单中排除——避免它既被当作审查对象、又被 review-plan / apply / review-code 的中间 commit 提前纳入；SHALL NOT 超出点名范围作业；SHALL 继续引用对应 ROLE_FILE（`~/.codex/lyx/prompts/codex/plan-reviewer.md` / `reviewer.md`），角色词内容不重写。

**模型与推理档**：SHALL 经"模板指示 + 宿主 spawn 能力"落实——审查 subagent 用 `codexHost.reviewModel` + 非空 `reviewReasoningEffort`；模型未配置或空白时继承当前会话模型，推理档 trim 后为空时不传 `reasoning_effort`。`reviewModelB`/`reviewReasoningEffortB` SHALL NOT 被审查流程读取使用（字段降级为弃用，见 `subagent-agent-config`）。SHALL NOT 依赖任何 shell 层模型或推理档参数，SHALL NOT 内置"模型名 → 推理档"的硬编码映射。审查 subagent 具备自主执行 shell 命令与读取文件的能力；TASK SHALL 只传基线引用或路径清单，SHALL NOT 由当前会话预先读取并拼贴审查内容全文。

#### Scenario: 审查 subagent 以非 fork 方式 spawn
- **WHEN** 审查关卡（review-plan 或 review-code）spawn 审查 subagent
- **THEN** 子代理只收到 TASK（范围点名、路径/基线清单、context.md 引用、模型指示），不携带主会话对话历史；SHALL NOT 使用全量 fork

#### Scenario: 按配置模型与推理档 spawn
- **WHEN** 用户配置 `reviewModel = "A"`、`reviewReasoningEffort = "low"`，运行一个审查关卡
- **THEN** 审查 subagent 以模型 A 和推理档 `low` 非 fork spawn；若 `reviewModelB` 也已配置，该值被忽略且不影响 spawn

#### Scenario: 不得恢复双审查
- **WHEN** 主会话在某一轮审查前考虑"再 spawn 一个复核 agent 更保险"
- **THEN** SHALL NOT spawn 第二个审查 agent；额外把关由主会话逐条裁决与"驳回硬线"终止条件承担

#### Scenario: 软上下文经 context.md 到达
- **WHEN** 审查 subagent 判断某条发现需要"为什么这样设计"的背景
- **THEN** 它从 change 目录下的 `context.md` 读取背景（TASK 已含路径引用），SHALL NOT 依赖任何 fork 历史或上一轮 subagent 会话记忆

#### Scenario: 未修项快照不被当作审查对象或提前提交
- **WHEN** 某 change 目录下存在未跟踪的 `review-findings.md`，用户运行 review-code 或 review-plan
- **THEN** 该文件从审查命令的未跟踪清单中排除，既不被当作可挑错的审查对象，也不被审查循环的统一 commit 纳入；它保持未跟踪直到 `@lyx-archive`
