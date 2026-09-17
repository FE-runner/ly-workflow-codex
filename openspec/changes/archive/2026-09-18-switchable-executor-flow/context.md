# context: switchable-executor-flow

本文件记录文档之外的讨论结论，供 review-plan / review-code / coding subagent 读取。与 proposal/design/specs 重复的内容不在此摘抄。

## 实测依据（本次讨论的关键输入）

- **spawn 可用性依赖会话，而非模型或 provider**：同一 app 版本（`0.155.0-alpha.2.6`）、同一 provider（`blueai`）、同一模型（`DeepSeek-V4.1-Flash`）下，一个会话能 spawn（工具注册为 namespace `multi_agent_v1`，`name: spawn_agent`），另一个会话调用返回 `unsupported call`（工具被包进 `mcp__tools__` 聚合层）。两个会话的 `session_meta` 字段完全一致。
- **子代理跨轮复用成立**：`fork_context: false` spawn 的子代理首次任务完成后，隔一轮用 `send_input` 唤醒仍能响应，并保留自身会话上下文。这推翻了模板中"回合结束即失去访问能力"的假设。

## 已否决的备选方案

- **复用模型字段的留空语义**（留空 = 主 agent 执行，配置模型 = spawn 子代理）：无法表达"spawn 子代理但继承当前会话模型"这个组合，且把执行者与模型两个正交维度压进一个字段。
- **默认 subagent 以保持兼容**：用户明确选择破坏性变更，理由是 spawn 可用性不可靠，默认押在 subagent 上会持续制造"表面独立审查、实际回退"的假象。
- **中间轮只跑受影响测试**：项目没有可靠的"受影响测试"映射，维护映射的成本高于收益，因此改为归档前一次完整验证。
- **保留 `reviewModelB` / `reviewReasoningEffortB` 弃用字段**：既然已确立破坏性变更，继续保留"不读取但写回"的字段只会让配置语义更模糊。
- **流程开始前做 spawn 可用性预探测**：用户明确否决。预探测要额外 spawn 一次，且探测成功不代表真用时成功；改为"首次真正 spawn 失败即回退"。

## 本次采用但需要审查者重点核对的做法

- **spec 用 ADDED + 覆盖声明，而非逐条 MODIFIED**：`ly-review-gates` 的 11 个 Requirement 里 10 个以 spawn 为前提，逐条 MODIFIED 需要完整复制每个 Requirement 的全部场景，delta 体积会是实际语义变化的数倍。覆盖规则集中写在新增 Requirement 开头，并逐条点名受影响的 Requirement 标题。**审查时请重点确认覆盖规则没有遗漏的 Requirement。**
- **主 agent 路径下 `context.md` 仍照常产出**：它不再是软上下文通道，但仍是决策留痕，且子代理路径仍需要它。

## 范围边界

- 不做：自动模式中断处理重构（7 类终止条件的"分级继续"策略）、串行流水线并行化、模型与推理档选取策略调整。
- 不改：审查范围判定、基线锚定、未跟踪清单采集、Critical / Warning / Info 分级输出。

## 已知坑

- 默认 `main` 是破坏性变更：升级用户即使不改配置，独立审查也会静默消失。必须在 `CHANGELOG.md` 与 `lycx doctor` 中显式提示。
- 主 agent 路径的"自己审自己"是明示取舍而非遗漏；需要独立视角的用户必须显式配置 `reviewExecutor = "subagent"`。
- 验证后移会留下"review 清零到归档之间未验证"的窗口，归档前关卡是唯一兜底。
