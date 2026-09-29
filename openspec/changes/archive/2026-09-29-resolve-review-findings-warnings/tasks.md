## 1. 主 spec Purpose 修正

- [x] 1.1 直接编辑 `openspec/specs/review-findings-snapshot/spec.md` 的 `## Purpose`：把"只读留痕……不承担跟踪或关闭职责"更新为"允许追加式解决说明、仍不承担状态跟踪与自动关闭职责"，并把本文件纳入 apply 阶段待提交清单；验证 Purpose 不再含"只读留痕"且含"追加式解决说明"。

## 2. 模板收紧

- [x] 2.1 更新 `templates/skills-codex/archive.md` 的回写段落：明确三段生命周期（active → archive 目录 → archive commit 后冻结）与写入时点；明确从归档后目录读取 `proposal.md`（SHALL NOT 用 active 路径）；把引用 active 快照、锚点无法解析、追加写入失败统一并入"逐条跳过并如实报告、不阻断归档、不改写 active 快照"；补充旧快照无编号时按顶层条目出现顺序定位。验证模板出现"三段""归档后目录""出现顺序"等措辞。
- [x] 2.2 更新 `templates/skills-codex/review-plan.md` 与 `templates/skills-codex/review-code.md` 的快照写入段落：补充条目最小结构（元信息 → 顶层编号条目 `1. [位置] — 问题` → 缩进的建议/解决子项；解决子项不计入 Warning 计数、不重排编号）；验证两个模板均出现最小结构与"不计入"措辞。

## 3. 测试与结构验证

- [x] 3.1 更新 `src/utils/__tests__/host-adapters.test.ts`：断言 archive 模板含三段生命周期、归档后目录读取与统一失败容错；断言两个 review 模板含条目最小结构；验证 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 通过。
- [x] 3.2 运行 `openspec validate --changes resolve-review-findings-warnings --strict`，确认 change artifacts 合法。
- [x] 3.3 校验 `proposal.md` 的 `## 解决的审查未修项` 含 6 条锚点且格式为 `<归档快照路径>#<节名>#<序号> — <说明>`；apply 阶段不执行回写，这 6 条由 `@lyx-archive` 归档时消费。

## 4. 文档核对

- [x] 4.1 核对 `README.md` / `CLAUDE.md` 是否需要同步：本 change 只收紧内部契约与失败口径，若对外行为摘要未变化则不改并在报告中说明；确需变化时同步对应段落。
