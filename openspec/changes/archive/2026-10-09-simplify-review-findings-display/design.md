## Context

`review-findings.md` 快照目前有三类子项：`- 解决：`（跨 change 解决说明，或本 change 内带"未复审"的就地标注）、`- 复审：`（后续 change 的复审结论）。`@lyx-explore` 列出时会统计全部 Warning、已标注解决数，以及"未复审 / 复审未通过"数。讨论结论是：用户只关心还有什么没处理，已解决条目一律不展示；复审机制随之失去用途，整体删除。

当前已归档快照中有 5 条 `- 复审：` 行（全在 `2026-09-30-in-change-review-findings-resolution`），以及 8 条带"未复审，"的就地标注（同一份 6 条、`2026-09-30-host-subagent-model-config` 1 条、`2026-09-30-review-findings-rereview-and-residual-fixes` 1 条）。

## Goals / Non-Goals

**Goals:**
- explore 只展示未解决 Warning；全部已解决时连询问都不发出。
- 删除复审机制的全部规则、模板段落、测试断言和文档描述。
- 就地标注格式去掉"未复审"。
- 一次性把已归档快照清理成与新格式一致。

**Non-Goals:**
- 不改变快照写入、upsert、随归档落库、跨 change 解决说明回写、归档前核对的流程。
- 不引入 open/closed 状态字段，也不改变"快照是留痕不是台账"的定位。
- 不提供查看已隐藏条目的入口（用户明确不要）。

## Decisions

### D1 "已解决"的判定只看 `- 解决：` 子项

Warning 顶层条目下有任意一条 `- 解决：` 子项即为已解决，不区分来源（跨 change 回写 / 本 change 内就地标注）。备选方案"就地标注降级展示"已否决：复审机制删除后，"未复审"不再是一种可变的状态，单独展示没有可执行的后续动作。

### D2 explore 先读内容再决定是否询问

原流程只靠 `ls` 判断有无命中就发出询问；新流程要在询问前读取快照并计算未解决条数，询问中的 change 数只计含未解决条目的 change。读取失败的快照仍按"跳过并如实注明"处理，它不计入询问数；如果所有可读快照都已解决，但存在读取失败的快照，仍要如实注明读取失败，不能静默。

### D3 explore Requirement 用 REMOVED + ADDED 而不是 MODIFIED

OpenSpec 归档时，MODIFIED 不允许丢弃基线 Scenario；原 Requirement 里有 4 个计数相关的 Scenario 要整体作废。因此改为 REMOVED「@lyx-explore 先询问后列出快照」+ ADDED「@lyx-explore 只列出未解决的快照条目」，保留的行为（先询问、拒绝不展示、无命中不询问、读取失败跳过）在新 Requirement 里重写。

### D4 一次性清理已归档快照，作为冻结规则的显式例外

spec 规定归档 commit 后原文冻结、只允许追加。本 change 在 apply 阶段直接编辑上述三份归档快照：删除 `- 复审：` 行，把 `（未复审，commit` 改成 `（commit`。不在 spec 中新增"允许清理"的条款（例外只发生一次，写进 spec 会变成长期口子），只在本 design 与 tasks 中记录。清理随 apply commit 落库，git 历史可回溯。原 Warning 原文、编号、`- 解决：` 的其余文字保持不变；Warning 原文中本身含有的"复审"字样（如 rereview 快照方案审查 #1、in-change 快照方案审查 #3）属于原文，保留不动。

### D5 主 spec Purpose 直接编辑

delta spec 不能修改已有 capability 的 `## Purpose`。`review-findings-snapshot` 的 Purpose 提到"未复审"就地标注和复审说明，由 apply 阶段直接编辑主 spec 的 Purpose 段落（只改 Purpose，不碰 Requirements，Requirements 由归档时合并 delta）。

### D6 在途 change 的旧声明静默忽略

`@lyx-archive` 删除复审回写步骤后，若某个在途 change 的 `proposal.md` 仍带 `## 复审的审查未修项`，该小节不被读取、不报错。仓库当前没有在途 change，影响面为零；不为此加兼容提示。

## Risks / Trade-offs

- [修复没站住的问题失去"重新打开"通道] → 后续 change 的 review-plan / review-code 会把仍然存在的问题重新报成新 Warning，审查关卡兜底。
- [explore 进入时多读文件] → 快照数量少（当前 5 份），读取成本可忽略。
- [改写已归档快照破坏"冻结"承诺] → 仅限本 change 一次，范围在 tasks 中逐文件列明，改动可经 `git show` 核对。
- [已安装用户的旧模板仍带复审逻辑] → 重新运行 `lycx init` 后生效；旧模板只会继续写 `- 复审：` 行，不会破坏新 explore 的判定（只看 `- 解决：`）。
