## Context

`review-findings-snapshot` 现有两条会改动快照的路径：审查关卡的节级 upsert（整节替换），以及 `@lyx-archive` 按后续 change 声明向**已归档**快照追加跨 change 解决说明。同一 change 内"审完顺手修"的场景两条都覆盖不到——`add-claude-host` 的 3 条代码审查 Warning 在 `0a33558` 已修，但归档快照显示 0 条已解决。本 change 只动共享 skill 模板正文与主 spec，不涉及 `src/` 运行时逻辑。

## Goals / Non-Goals

**Goals:**
- 给 active 快照补一条"本 change 内修复"就地标注路径，覆盖审完即修（A）与延后修复（C 兜底）两种时机。
- 标注可核验（必带 commit hash）且与经过审查的解决可区分（固定"未复审"）。
- explore 列出时能看出有多少"已解决"是未复审的。
- 用本 change 的 `## 解决的审查未修项` 为 `add-claude-host` 那 3 条补登记。

**Non-Goals:**
- 不在 `@lyx-commit` 或其他通用 Git 工具里按 diff 位置自动推断（方向 B，已否决）。
- 不引入状态字段、台账或自动关闭；不改变审查结论、不新增提交。
- 不改变 upsert 语义：重跑审查整节替换时不保留、不合并旧就地标注。

## Decisions

**D1 标注格式复用解决子项，靠前缀区分来源**
`- 解决：本 change 内修复（未复审，commit <短 hash>）— <说明>`。与跨 change 格式 `- 解决：<change-name>（归档于 …）— …` 同为缩进解决子项，explore 的"已标注解决"计数规则（条目下≥1 个解决子项计 1）无需修改；"未复审"作为固定字样供额外计数。备选：新增独立字段 / 独立行前缀——否决，会破坏既有计数规则与最小结构。

**D2 "未复审"固定、不设"已复审"变体**
同一 change 内重跑同类审查会整节替换，就地标注必然随旧节消失；所以能存活到归档的就地标注在定义上都未经复审。

**D3 hash 作幂等键、未提交不标注**
hash 让回看者可用 `git show` 核对；未提交修复无法核验，一律不标。

**D4 触发点 A 写在 review-plan / review-code 模板的快照段之后**
新增"审查后同会话修复的就地标注"段：用户在同一会话要求修快照中的 Warning，修复提交后回写。修复提交由主会话按路径暂存（message 参照 `@lyx-commit` 格式，不委托 `@lyx-commit --all`，避免 `git add -A` 纳入未跟踪快照），不属于审查循环的统一 commit。

**D5 触发点 C 位于 archive 的"归档前完整验证"之后、委托 OpenSpec 归档之前**
此时快照仍在 active 路径，写入直接；验证失败时本就停止归档，不必核对。候选 commit 取"该条目所在节元信息中的基线 commit 到 `HEAD` 之间、触及条目位置文件（多文件取并集）的提交"；基线缺失或不可解析时退化为只展示条目、由用户直接给出 hash。默认不核对（y/N），失败逐条跳过不阻断。

**D6 收窄"不写 active 快照"的口径**
该约束原本防的是跨 change 回写污染他人进行中的快照；改为只约束跨 change 回写，明确不禁止本 change 就地标注。

**D7 主 spec Purpose 直接修订**
delta 不能携带既有能力的 Purpose，按 OpenSpec 约定在实施阶段直接改 `openspec/specs/review-findings-snapshot/spec.md` 的 Purpose，补上"本 change 内可就地标注"的叙述，避免归档后 Purpose 与 Requirement 脱节。

## Risks / Trade-offs

- [用户误确认候选 commit，标注了实际未修的条目] → 标注强制"未复审"+ hash，回看者可核对；C 必须逐条由用户确认，不批量自动标。
- [A 依赖模型在会话中记得回写] → C 在归档前兜底，未标注条目会被再次提出。
- [归档流程多一次询问] → 仅在存在未标注 Warning 时询问，默认跳过。
- [候选含审查统一修复 / apply commit 等噪声] → 逐条呈现、由用户甄别确认。
- [补登记 3 条的说明不是"本 change 修的"] → 说明文案显式写"已在 0a33558 修复，本 change 补登记"。
