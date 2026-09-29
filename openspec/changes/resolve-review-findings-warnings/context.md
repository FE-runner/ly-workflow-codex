# context.md — resolve-review-findings-warnings

软上下文（文档之外的讨论结论）。行为契约见 delta spec；决策与备选理由见 `design.md`，本文件不重复。

## 用户确认结论

- 用户要求解决上一 change（`review-findings-resolution-notes`）归档快照里的全部 6 条 Warning：方案审查 4 条 + 代码审查 2 条。
- 本 change 在 `proposal.md` 逐条声明解决这 6 条，归档时由 `@lyx-archive` 写回旧快照——即用刚发布的"追加式解决说明"能力闭环自己的 warning。
- 沿用本会话此前选择：留在当前分支 + 全自动（未新建 worktree、未切分支）。

## 实现注意

- 主 spec Purpose 不走 delta：OpenSpec 的 delta 不支持改 Purpose，且 propose 提交范围只含 change 目录；因此在 apply 阶段直接编辑 `openspec/specs/review-findings-snapshot/spec.md` 并纳入 apply commit，archive 的 sync 不会覆盖 Purpose。
- 历史已归档快照不回填编号；回写时对无显式编号的旧快照按节内顶层 Warning 条目出现顺序从 1 起定位，无法唯一解析按锚点无效处理。
- 失败（引用 active 快照、锚点无法解析、追加写入失败）一律逐条跳过并如实报告，不阻断归档、不改写 active 快照。
- 本 change 的 6 条声明由 `@lyx-archive` 归档时消费；apply 阶段只校验声明格式，不执行回写。
- 本机已安装的 `~/.agents/skills/lyx-archive/SKILL.md` 可能是 0.6.0 旧版（不含回写步骤）；本 change 按仓库模板执行回写，不依赖已安装副本。

## 受影响文件（实施范围）

- `openspec/specs/review-findings-snapshot/spec.md`：Purpose 直接修正（apply 阶段）
- `templates/skills-codex/archive.md`：三段生命周期、归档后目录读取、统一失败容错、旧快照定位
- `templates/skills-codex/review-plan.md` / `review-code.md`：条目最小结构
- `src/utils/__tests__/host-adapters.test.ts`：模板断言
