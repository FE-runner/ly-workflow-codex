# Design: single-reviewer-exec-model

## 背景与目标

当前三个 subagent（审查 agent A/B、coding subagent）均以"fork 当前会话上下文"启动：到 review-code 阶段主会话已累积 explore/propose/review-plan/apply 全部历史，fork 份数 ×2（双审）+1（实施），token 成本与延迟结构性偏高；双审对同一对象重复探索，交换结论再加两个回合。

目标：执行模型改为"单审 subagent（非 fork）+ 主会话裁决"，以 change 目录固定 artifact `context.md` 替代 fork 的软上下文通道；单轮审查成本预期降至原 1/4~1/6。

## 决策

### 决策 1：单审 + 主会话裁决，驳回硬线设两道口径

- 每个审查关卡 spawn **1 个**审查 subagent，移除"并行双审 + 交换结论 + 共识归并"。
- 质量把关从"agent 间独立性"转移到"主会话裁决纪律"：
  - 不认可必须附**可核验依据**（文件/行/命令输出），泛泛"误报"视为未完成裁决，不能补足则改判认可并修复；
  - **驳回硬线**两个口径（任一命中即停转人工）：
    - 逐条口径：同一 Critical 下一轮复现且再被驳回（沿用原"分歧未决"的两轮语义，更名）；
    - 整轮口径：连续 2 轮对当轮全部 Critical 均不认可（零认可零修复）——防"系统性驳回一切"的裁决失效，即用户拍板的"驳回硬线 2 轮"。
- 原终止条件 6（连续 3 轮系统性误判）保留不动，与整轮口径互补（前者要求不认可原因类型一致，后者只看"全驳回"事实）。
- 备选已否决：D 原案的"Critical 时 spawn 第二个 agent 对抗复核"——用户拍板超线**直接停给人工**，不 spawn 复核员。

### 决策 2：非 fork spawn（spike 已验证）

- spike 结论：Codex 宿主 V1（spawn.rs）`fork_context` 默认 `false` 即非 fork；V2 显式拒绝 `fork_context`，用 `fork_turns`（`none`=非 fork / `all`=全量 / `N`=最近 N 轮）。
- 模板按"非 fork spawn（只携带 TASK）"指示；`fork_turns: N` 仅作为宿主不支持完全非 fork 时的兜底（取最小 N），SHALL NOT 全量 fork。
- 非 fork ≠ 零继承：宿主仍继承基础配置/模型/开发指令/exec policy（`prepare_agent_spawn_config`），丢失的只有对话历史——正是要用 context.md 替代的部分，继承边界与设计意图吻合。

### 决策 3：context.md 作为软上下文唯一载体（新能力 review-context-artifact）

- 生命周期：propose 产出（自审后、commit 前）→ apply 维护（实施决策回写）→ review-plan / review-code / coding subagent 消费（TASK 只传路径，不贴全文）。
- 内容边界：只记"文档之外的讨论结论"（关键决策/否决理由/范围边界/已知坑），与 artifact 重复内容一句话指路；建议 ≤100 行（它是每次 spawn 的固定读取成本）。
- 无实质内容时产出最小骨架，SHALL NOT 省略文件（消费方 TASK 引用固定路径）；历史 change 缺失时容错继续（如实报告"软上下文不可用"）。
- 质量关卡：产出时完成内容边界自检（无整段重复、决策可溯源、行数达标），review-plan 范围点名含 context.md——审查关卡可捕获其内容与 design 的矛盾（审查 agent 发现疑点可反馈修订）。
- apply 更新只追加/修订，不删 propose 沉淀（过时标注）。
- 备选已否决：spawn 时主会话现场写摘要——质量不稳定、不可审计；固定 artifact 让软上下文可 review、可随 commit 留痕。

### 决策 4：reviewModelB / reviewReasoningEffortB 降级为弃用字段

- 字段与类型定义保留（存量配置不被任何路径删除/改写），但审查流程不再读取。
- init 向导"模型三连"改"模型二连"（reviewModel + codingModel），存量 reviewModelB 保留写回。
- `lycx doctor` 对 B 字段输出弃用提示（不 FAIL，展示存量值）。

### 决策 5：失败分类简化

- 单审模型下删除"单一 agent 失败、另一 agent 结论完整"降级条款与"交换结论长链失败兜底"——审查 agent 失败即本轮失败，按运行期失败/环境级回退/配置状态未知三类处理，SHALL NOT 归入"驳回硬线"（调用失败非裁决分歧）。

## 兼容与迁移

- 存量 `~/.ly/config.toml`：不删字段、不改格式，B 字段静默失效 + doctor 提示——**无破坏性配置迁移**。
- 历史 change 无 context.md：审查/实施容错继续，不阻断。
- 旧 change 的 delta spec 语义（双审措辞）随本次基线更新，不影响已归档 change。
- 归档时注意：ly-review-gates / subagent-agent-config / ly-propose-flow 主 spec 的 **Purpose 段**仍写"双审查"，delta 不覆盖 Purpose——archive 后需手动同步（列入 tasks）。

## 风险与对策

| 风险 | 对策 |
|---|---|
| 主会话裁决偏误（裁判吹哨自己比赛） | 可核验依据强制 + 驳回硬线双口径 + 系统性误判条件保留 + 报告逐条并排展示 |
| context.md 质量差/过时误导审查 | 内容边界约束 + apply 只增不删 + 审查 agent 仍以 diff/artifact 实际内容为准（context.md 仅背景） |
| 漏掉 fork 才有的隐性上下文 | 非零继承（开发指令/角色词仍在）；context.md 显式承载；缺失容错如实报告 |
| V2 宿主行为差异 | 模板不写死宿主参数名，按"非 fork 语义"指示，兜底路径 fork_turns:N 已定义 |
