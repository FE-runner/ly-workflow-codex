# Proposal: single-reviewer-exec-model

## Why

当前审查/实施 subagent 采用"fork 当前会话上下文"启动，到 review-code 阶段主会话已累积 explore/propose/review-plan/apply 全部历史，fork 两份审查 agent + 实施一份 coding agent，token 成本与延迟结构性偏高；双审查 agent 对同一份审查对象重复探索，交换结论再各加一个回合，进一步放大开销。spike 已验证 Codex 宿主支持非 fork spawn（V1 `fork_context` 默认 false；V2 `fork_turns: none`），改用"单审 subagent（非 fork）+ 主会话裁决异议"可将单轮审查成本降至约 1/4~1/6，且主会话裁决环节本已存在于现有循环中。

## What Changes

- **审查执行模型重写（review-plan / review-code 同步）**：每个审查关卡由"2 个并行 fork subagent + 交换结论共识"改为"1 个审查 subagent，非 fork spawn（只带 TASK），主会话逐条裁决 Critical"；裁决不认可时必须给出可核验依据（文件/行/命令输出），报告逐条并排展示审查 agent 原文与主会话裁决理由。
- **驳回硬线（新终止条件）**：同一审查关卡连续 2 轮主会话对全部 Critical 均不认可 → 触发终止，直接停止转人工（不 spawn 复核 agent）；原"双审分歧 → 共识/分歧未决"机制随之移除。
- **新增 change 目录固定 artifact `context.md`（软上下文载体）**：propose 阶段产出（关键决策、取舍、范围边界、已知坑）、apply 阶段维护更新（实施决策）、review-plan / review-code / coding subagent 三处消费——以文件引用替代 fork 带来的会话历史。
- **coding subagent（@lyx-apply 实施环节）同步去 fork**：非 fork spawn + 消费 `context.md`，与审查关卡统一为同一套 spawn 语义。
- **配置字段语义降级**：`reviewModelB` / `reviewReasoningEffortB` 保留字段但标注为弃用路径（不再被审查流程读取使用）；`lycx doctor` 检查项同步调整（B 字段输出弃用提示）。
- **文档同步**：AGENTS.md / templates/CLAUDE.md 的"审查执行模型"章节重写；角色提示词 `plan-reviewer.md` / `reviewer.md` 不改（行为契约不重写）。

## Capabilities

### New Capabilities

- `review-context-artifact`: 定义 change 目录下 `context.md` 软上下文 artifact 的完整生命周期——propose 产出、apply 维护、review-plan / review-code / coding subagent 消费，以及内容边界（记什么、不记什么）。

### Modified Capabilities

- `ly-review-gates`: 审查执行模型从"双审查 subagent（fork + 交换共识）"改为"单审查 subagent（非 fork）+ 主会话裁决"；新增驳回硬线终止条件；spawn 语义、失败分类、TASK 构造、逐轮报告要求随之改写。
- `subagent-agent-config`: `reviewModelB` / `reviewReasoningEffortB` 从"审查 agent B 的模型/推理档指定"降级为弃用字段（保留、不读取、doctor 提示）；spawn 方式明确为非 fork。
- `ly-propose-flow`: propose 编排新增"产出 `context.md`"环节（自审后、`propose:` commit 前）；apply 实施环节的 coding subagent 改为非 fork + 消费 `context.md`；全自动流水线描述中的双审查措辞同步。

## Impact

- **模板**：`templates/skills-codex/review-plan.md`、`review-code.md`（执行模型重写）、`propose.md`（新增 context.md 产出环节）、`apply.md`（context.md 维护 + coding subagent 非 fork）
- **规格**：`openspec/specs/ly-review-gates/`、`subagent-agent-config/`、`ly-propose-flow/` 基线 requirement 大幅改写；新增 `review-context-artifact/`
- **源码**：`src/` 中 lycx doctor 检查项（子代理模型配置）、类型定义（`reviewModelB` 注释标注弃用）及对应测试
- **文档**：`AGENTS.md`、`templates/CLAUDE.md`、`README.md`（命令表中的双审查描述）
- **不改动**：`~/.ly/prompts/codex/` 角色提示词、配置文件格式（无新增/删除字段）、openspec CLI 依赖
