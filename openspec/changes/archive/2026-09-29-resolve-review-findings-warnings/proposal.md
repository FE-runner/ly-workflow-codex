## Why

上一个 change（`review-findings-resolution-notes`）的审查留下 6 条未修 Warning（方案审查 4 条、代码审查 2 条），集中在四处：主 spec Purpose 与新增能力口径脱节；归档回写的生命周期与写入时点存在时间差；快照条目最小结构和旧快照定位规则缺失；回写失败与 active 引用处理未显式归口。这些歧义会让实现者按不同理解落地，需要一次收口。

## What Changes

- 修正 `review-findings-snapshot` 主 spec Purpose：从"只读留痕、不承担跟踪或关闭职责"更新为"允许追加式解决说明、仍不承担状态跟踪与自动关闭"。
- 归档回写明确三段生命周期（active → OpenSpec archive 移入 archive 目录 → archive commit 后冻结），并明确 SHALL 从**归档后目录**读取 `proposal.md`，SHALL NOT 再访问已不存在的 active 路径。
- 定义快照条目最小 Markdown 结构：节内先写元信息，再写连续编号的顶层 Warning 条目，问题细节与 `建议:` 为缩进行；解决说明为缩进子项且不计入 Warning 计数。
- 定义旧快照（无显式编号）按顶层 Warning 条目出现顺序从 1 起定位；无法唯一解析时按锚点无法解析处理。
- 把"引用 active 快照""追加写入失败"显式并入逐条跳过并如实报告、不阻断归档的失败容错规则。
- 在本 change 的 `proposal.md` 声明解决的 6 条历史 Warning，归档时由 `@lyx-archive` 向旧快照追加解决说明。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `review-findings-snapshot`: 收紧快照最小结构与旧快照定位规则，明确归档回写的三段生命周期、proposal.md 读取路径与失败容错；主 spec Purpose 同步更新。

## 解决的审查未修项

- `openspec/changes/archive/2026-09-29-review-findings-resolution-notes/review-findings.md#方案审查#1` — 修正主 spec Purpose，使其与追加式解决说明能力一致，不再保留"只读留痕"旧叙述
- `openspec/changes/archive/2026-09-29-review-findings-resolution-notes/review-findings.md#方案审查#2` — 归档模板明确三段生命周期与写入时点，消除"必须在 commit 后写入"的歧义
- `openspec/changes/archive/2026-09-29-review-findings-resolution-notes/review-findings.md#方案审查#3` — 补充快照条目最小结构与旧快照无编号时的定位规则
- `openspec/changes/archive/2026-09-29-review-findings-resolution-notes/review-findings.md#方案审查#4` — 失败容错显式覆盖"锚点有效但追加写入失败"
- `openspec/changes/archive/2026-09-29-review-findings-resolution-notes/review-findings.md#代码审查#1` — 归档回写明确从归档后目录读取 proposal.md
- `openspec/changes/archive/2026-09-29-review-findings-resolution-notes/review-findings.md#代码审查#2` — active 快照引用显式并入逐条跳过并报告、不阻断归档

## Impact

- Specs：`openspec/specs/review-findings-snapshot/spec.md`（Purpose 直接修正 + delta Requirement）
- 模板：`templates/skills-codex/archive.md`（生命周期 / proposal 路径 / 失败容错）、`review-plan.md` 与 `review-code.md`（快照条目最小结构）
- 测试：`src/utils/__tests__/host-adapters.test.ts` 补充对应断言
- 文档：`README.md` / `CLAUDE.md` 仅在行为口径确有变化时同步
- 兼容性：不改动 `src/` 运行时代码；历史快照内容不改，只在归档时追加解决说明
