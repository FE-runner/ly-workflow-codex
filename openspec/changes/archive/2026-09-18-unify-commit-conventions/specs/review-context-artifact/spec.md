## MODIFIED Requirements

### Requirement: propose 阶段产出 context.md

`/ly:propose` SHALL 在方案 artifacts 生成并完成方案自审之后、执行 propose 阶段 commit 之前，产出 `openspec/changes/<change-name>/context.md`，并使其随 propose 阶段 commit 一并落库（该文件位于 change 目录内，现有集群暂存 `git add -- openspec/changes/<change-name>/` 天然覆盖）。propose 阶段 commit 的 message SHALL 带 `Change-Stage: propose` 与 `Change-Name: <change-name>` trailer（见 `commit-conventions`）。

内容 SHALL 收录主会话讨论中沉淀、且**文档之外**的软上下文：关键决策与理由、已否决的备选方案及否决理由、范围边界（明确做什么/不做什么）、已知坑与注意事项。SHALL NOT 复制 `proposal.md`/`design.md`/`tasks.md`/delta spec 已有内容的全文或大段摘抄——与 artifact 重复的内容以一句话引用指路即可。

context.md SHALL 保持简短（建议 ≤ 100 行）——它是**子代理执行路径**每次 spawn 的固定读取成本（执行者为 `main` 时主 agent 不读取该文件，此时它仅作为随 commit 落库的决策留痕），篇幅失控即失去"替代 fork"的成本意义。**产出时 SHALL 完成一次内容边界自检**（propose 编排的质量关卡，不依赖下游审查兜底）：（a）无与 proposal/design/tasks/delta spec 重复的整段内容（重复处一句话引用指路）；（b）每条决策/否决理由可溯源到本 change 讨论或基线 artifact 的对应条目；（c）行数在体积指引内。自检不通过 SHALL 修订后重检，SHALL NOT 带病产出。若该 change 讨论中确无实质软上下文，SHALL 产出仅含最小骨架（标题 + 一行说明）的文件，SHALL NOT 省略文件——消费方的 TASK 引用固定路径，文件缺失会造成 spawn 断链。

#### Scenario: 正常产出并随 propose commit 落库
- **WHEN** `/ly:propose` 编排中方案自审完成，主会话讨论沉淀过"选方案 A 而否决方案 B（理由：…）"等软上下文
- **THEN** `context.md` 在 propose 阶段 commit 之前产出，记录该决策与理由，并随带 `Change-Stage: propose` trailer 的 commit 一并提交

#### Scenario: 无实质软上下文时产出最小骨架
- **WHEN** 某 change 的讨论过程未沉淀任何文档之外的决策或边界
- **THEN** 仍产出仅含标题与一行说明的 `context.md` 最小骨架，SHALL NOT 因"没什么可写"而省略文件

#### Scenario: 内容边界自检不通过时修订后重检
- **WHEN** 产出 context.md 时发现某段内容整段摘抄自 design.md，或某条决策无可溯源依据
- **THEN** 主会话修订该段（改为引用指路或补充依据）后重检通过才进入 commit 环节, SHALL NOT 带病产出

#### Scenario: 不复制 artifact 已有内容
- **WHEN** 主会话讨论的某结论与 `design.md` 某决策重复
- **THEN** `context.md` 以一句话引用指路（如"实施架构见 design.md 决策 2"），SHALL NOT 整段摘抄 artifact 全文

### Requirement: apply 阶段维护更新 context.md

`@lyx-apply` 实施完成（coding subagent 回传或主 agent 直接实施完成）、主会话确认后，SHALL 把实施阶段新产生的软上下文（实现取舍、对方案的偏差及理由、实施中发现的坑）更新进 `context.md`，并随 apply 阶段 commit 一并提交。apply 阶段 commit 的 message SHALL 带 `Change-Stage: apply` 与 `Change-Name: <change-name>` trailer（见 `commit-conventions`）。更新 SHALL 增量追加或修订，SHALL NOT 重写或删除 propose 阶段已沉淀的内容——确已过时的内容标注"已过时"保留痕迹，SHALL NOT 静默抹除。实施阶段无新增软上下文时 SHALL NOT 强行凑写，`context.md` 保持原样即可（apply 阶段 commit 不因此产生空提交问题——无变动则不纳入提交）。

#### Scenario: 实施决策回写并随 apply commit 提交
- **WHEN** 实施中为绕开某依赖缺陷改用了替代实现（对方案的偏差），主会话确认结果
- **THEN** 该偏差及理由被追加进 `context.md`，随带 `Change-Stage: apply` trailer 的 commit 一并提交，供 review-code 的审查 subagent 读取

#### Scenario: 不删除 propose 阶段沉淀
- **WHEN** apply 阶段更新 `context.md` 时发现 propose 阶段记录的某决策已被实施推翻
- **THEN** 该条目标注"已过时"并注明新结论, SHALL NOT 直接删除原条目

#### Scenario: 无新增软上下文时不强行凑写
- **WHEN** 实施完全按方案执行、无任何偏差与新决策
- **THEN** `context.md` 保持原样不更新，apply 阶段 commit 不包含对它的无意义改动
