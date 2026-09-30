## ADDED Requirements

### Requirement: proposal.md 声明复审的审查未修项

`/ly:propose` SHALL 允许（但不强制）在本次 change 的 `proposal.md` 中增加 `## 复审的审查未修项` 小节：当用户在本次讨论中明确复审了历史 `review-findings.md` 中某条已带解决说明的 Warning、并给出结论时，逐条列出该 Warning 的精确引用、结论与一句说明。该小节 SHALL 使用固定标题，供 `@lyx-archive` 机械定位，且 SHALL 与 `## 解决的审查未修项` 分开声明、SHALL NOT 混用。每条 SHALL 独占一个列表项，格式为 `- <归档快照路径>#<节名>#<序号>（结论：成立|不成立）— <一句说明>`；节名仅允许 `方案审查` / `代码审查`，结论仅允许 `成立` / `不成立`，路径 SHALL 指向 `openspec/changes/archive/**/review-findings.md` 下的已归档快照。本次 change 未复审任何历史 Warning 时 SHALL 省略该小节，SHALL NOT 创建空小节。结论 SHALL 来自用户在讨论中的明确判断，propose SHALL NOT 自行推断复审结论。该小节 SHALL 只做声明——propose 阶段 SHALL NOT 直接改写历史快照，实际回写发生在 `@lyx-archive`（见 `review-findings-snapshot` 的「追加式复审说明」Requirement）。

#### Scenario: 讨论中完成复审时声明

- **WHEN** 用户在讨论中复审了某归档快照 `#代码审查#1` 的修复并确认结论为"成立"，随后运行 `/ly:propose`
- **THEN** `proposal.md` 出现 `## 复审的审查未修项` 小节，该条以 `- <归档快照路径>#代码审查#1（结论：成立）— <说明>` 列出

#### Scenario: 未复审任何条目时省略小节

- **WHEN** 本次 change 没有复审任何历史 Warning
- **THEN** `proposal.md` SHALL NOT 包含 `## 复审的审查未修项` 小节，也 SHALL NOT 创建空小节

#### Scenario: 解决与复审分开声明

- **WHEN** 本次 change 既解决了一条历史 Warning、又复审了另一条
- **THEN** 前者列入 `## 解决的审查未修项`，后者列入 `## 复审的审查未修项`，两个小节互不混写

#### Scenario: propose 不直接改写历史快照

- **WHEN** `proposal.md` 已声明复审项，propose 阶段 commit 完成
- **THEN** 历史 `review-findings.md` 保持原样，复审说明直到 `@lyx-archive` 归档时才被追加
