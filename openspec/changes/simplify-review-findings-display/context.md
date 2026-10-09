# context：simplify-review-findings-display

## 关键决策与理由

- 已解决 = Warning 顶层条目下有任意 `- 解决：` 子项，不分来源（design D1）。
- explore 不提供"展开已隐藏条目"的入口：用户明确不要。
- 复审机制整体删除：已解决条目隐藏后，复审结论失去展示出口；修复没站住的问题由后续审查关卡重新报为新 Warning 兜底。
- 已归档快照的一次性清理是冻结规则的**单次例外**，不在 spec 中新增"允许清理"条款（design D4），以免变成长期口子。

## 已否决的方案

- "未复审"条目降级展示为一行汇总：复审删除后"未复审"永远不会变化，展示后没有可执行的后续动作。
- explore Requirement 用 MODIFIED：OpenSpec 不允许 MODIFIED 丢弃基线 Scenario，改用 REMOVED + ADDED（design D3）。

## 范围边界

- 做：explore 展示口径、删除复审、就地标注格式、清理 3 份归档快照、模板 / 测试 / 文档 / 主 spec Purpose 同步。
- 不做：快照写入 / upsert / 归档落库 / 跨 change 解决回写 / 归档前核对流程本身不变；不加状态字段。

## 已知坑

- `ly-review-gates`、`ly-wrapper` spec 里的"复审"是泛指"重新审一遍"，与本机制无关，不要改。
- 清理归档快照时只删 `- 复审：` 行、只把 `（未复审，commit` 改为 `（commit`；Warning 原文、编号与 `- 解决：` 的其余文字逐字不变。
- 本 change 的 `proposal.md` 声明解决 rereview 快照 `#方案审查#1`，归档时会向该快照追加 `- 解决：` 行。这是正常回写，不属于清理范围。
