## ADDED Requirements

### Requirement: proposal.md 声明解决的审查未修项

`/ly:propose` SHALL 允许（但不强制）在本次 change 的 `proposal.md` 中增加 `## 解决的审查未修项` 小节：当本次 change 明确解决某条历史 `review-findings.md` 的 Warning 时，逐条列出该 Warning 的精确引用与一句解决说明。该小节 SHALL 使用固定标题，供 `@lyx-archive` 机械定位；每条引用 SHALL 独占一个列表项，格式为 `<归档快照路径>#<节名>#<序号>`，说明紧随其后。本次 change 不解决任何历史 Warning 时 SHALL 省略该小节，SHALL NOT 创建空小节。该小节 SHALL 只做声明——propose 阶段 SHALL NOT 直接改写历史快照，实际回写发生在 `@lyx-archive`（见 `review-findings-snapshot` 的「追加式解决说明」Requirement）。

#### Scenario: 有声明时按固定格式写入

- **WHEN** 用户明确本次 change 解决了某条历史 Warning
- **THEN** `proposal.md` 出现 `## 解决的审查未修项` 小节，每条以 `<归档快照路径>#<节名>#<序号>` 引用并附一句说明

#### Scenario: 无声明时省略小节

- **WHEN** 本次 change 不解决任何历史 Warning
- **THEN** `proposal.md` SHALL NOT 包含 `## 解决的审查未修项` 小节，也 SHALL NOT 创建空小节

#### Scenario: propose 阶段不回写历史快照

- **WHEN** `proposal.md` 已声明解决某条历史 Warning，propose 阶段 commit 完成
- **THEN** 历史 `review-findings.md` 保持原样，解决说明直到 `@lyx-archive` 归档时才被追加
