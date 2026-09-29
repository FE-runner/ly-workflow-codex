# context.md — review-findings-resolution-notes

软上下文（文档之外的讨论结论）。行为契约见 delta specs；决策与备选理由见 `design.md`，本文件不重复。

## 用户确认结论

- 用户原始诉求：`review-findings.md` 里的 Warning 在后续新 change 里解决后，应把解决情况标注到 Warning 上。
- 用户确认口径：**追加式解决说明**——只追加、不改原 Warning 原文；不引入 open/closed 状态字段。
- 声明载体：`proposal.md` 的固定小节 `## 解决的审查未修项`（用户采纳推荐，未选 `context.md`）。
- 回写主体：`@lyx-archive` 归档时读取声明并回写，随既有归档 commit 落库；propose 不回写。

## 实现注意

- 解决说明不含 commit SHA——写入发生在归档 commit 之前，该 SHA 尚不存在；用 `<change-name>（归档于 <YYYY-MM-DD>）` 引用，追溯走 `git log` / `git blame`。
- 只允许引用已归档快照；active 快照未跟踪且可被重跑替换，锚点不稳定。
- 幂等键是 `<change-name>`；不同 change 解决同一 Warning 时按归档先后追加多行。
- 不做自动语义匹配、不做全局 backlog、不提供查询/关闭接口——这些是明确非目标。
- 主 spec 的 Purpose 文本不在本 change 内直接改写（propose 提交范围只含 change 目录）；口径由 delta 的 MODIFIED Requirement 收敛。
- `CHANGELOG.md` / `AGENTS.md` 按仓库既有约定在发版时同步，本 change 不改。

## 受影响文件（实施范围）

- `templates/skills-codex/review-plan.md` / `review-code.md`：Warning 条目连续编号
- `templates/skills-codex/propose.md`：声明小节产出规则
- `templates/skills-codex/archive.md`：回写解决说明
- `templates/skills-codex/explore.md`：展示已标注解决条数
- `src/utils/__tests__/host-adapters.test.ts`：模板断言
- `README.md` / `CLAUDE.md`：行为摘要同步
