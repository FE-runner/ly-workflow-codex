## Why

`@lyx-explore` 列出审查未修项快照时，会把已标注解决的 Warning 一起计数展示（当前 17 条里 16 条已解决），真正待处理的条目被淹没。复审机制（`## 复审的审查未修项` 声明 + `- 复审：` 回写 + "未复审 / 复审未通过"计数）只服务于这类展示，隐藏已解决条目后就失去了意义，却让 propose / archive / explore 多出一整套规则。

## What Changes

- **BREAKING（展示口径）** `@lyx-explore` 只展示**未解决**的 Warning：只要 Warning 顶层条目下有任意一条 `- 解决：` 子项，就视为已解决并隐藏；某 change 的快照没有剩余未解决条目时，整个 change 不出现；所有快照都没有剩余条目时**不发出询问**，直接进入探索；不提供"展开已隐藏条目"的入口。计数里删掉"已标注解决 / 未复审 / 复审未通过"三项。
- **BREAKING** 删除复审机制：移除 `proposal.md` 的 `## 复审的审查未修项` 声明，以及 `@lyx-archive` 的"回写审查未修项复审说明"步骤和 `- 复审：` 子项格式。
- 本 change 内修复的就地标注格式去掉"未复审"：`- 解决：本 change 内修复（未复审，commit <短 hash>）— …` → `- 解决：本 change 内修复（commit <短 hash>）— …`。
- 一次性清理已归档快照（冻结规则的显式例外，只在本 change 执行一次）：删除现有的 `- 复审：` 子项行，把现有就地标注里的"未复审，"去掉。
- 同步模板（explore / archive / propose / review-plan / review-code）、测试断言，以及 AGENTS.md / CLAUDE.md / README.md / README.zh-CN.md 的速览段落。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `review-findings-snapshot`：explore 列出口径改为只展示未解决条目、全部已解决时不询问；就地标注格式去掉"未复审"；冻结后只允许追加解决说明；删除「追加式复审说明」Requirement。
- `ly-propose-flow`：删除「proposal.md 声明复审的审查未修项」Requirement。

## Impact

- 模板：`templates/skills/explore.md`、`archive.md`、`propose.md`、`review-plan.md`、`review-code.md`（两个宿主共享正文，渲染产物随之变化）。
- 测试：`src/utils/__tests__/host-adapters.test.ts` 中与复审 / 已标注解决计数相关的断言。
- 文档：AGENTS.md、CLAUDE.md、README.md、README.zh-CN.md 的审查未修项快照段落；主 spec `review-findings-snapshot` 的 Purpose 叙述。
- 数据：`openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/`、`2026-09-30-host-subagent-model-config/`、`2026-09-30-review-findings-rereview-and-residual-fixes/` 三份已归档快照（一次性清理）。
- 兼容：已安装用户重新 `lycx init` 后生效；已在途 change 的 `proposal.md` 若含 `## 复审的审查未修项` 小节，归档时会被忽略（不再回写）。

## 解决的审查未修项

- openspec/changes/archive/2026-09-30-review-findings-rereview-and-residual-fixes/review-findings.md#方案审查#1 — 复审机制与"未复审 / 复审未通过"括注一并删除，括注组合格式问题不再存在
