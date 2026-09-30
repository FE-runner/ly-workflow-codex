## Why

审查未修项快照（`review-findings.md`）目前只有一条"已解决"留痕路径：由**后续 change** 在 `proposal.md` 声明、`@lyx-archive` 回写到**已归档**快照。可实际常见的是在**同一 change 内**审查结束后顺手修掉 Warning（如 `add-claude-host` 在 `0a33558` 修复了代码审查的 3 条 Warning），此时快照没有任何机制被更新，归档后显示"0 条已解决"，回看时误导。现在补上"本 change 内修复"的就地标注路径。

## What Changes

- 新增"本 change 内修复标注"：在 active 快照对应 Warning 条目下追加缩进子项 `- 解决：本 change 内修复（未复审，commit <短 hash>）— <说明>`；必须引用已存在的修复 commit，以 commit hash 作幂等键；原 Warning 原文与编号不变。
- 触发点 A：`@lyx-review-plan` / `@lyx-review-code` 写完快照后，同一会话内用户接着要求修复快照中的 Warning，修复**提交之后**回写 active 快照（快照仍保持未跟踪，不新增提交）。
- 触发点 C：`@lyx-archive` 在归档前完整验证通过后、委托 OpenSpec 归档之前，统计当前 change 快照中无解决子项的 Warning；非零时询问一次是否逐条核对，逐条用 `git log <基线>..HEAD -- <位置文件>` 找候选修复 commit，用户逐条确认后标注；默认可跳过，失败不阻断归档。
- 收窄既有口径：跨 change 解决说明仍 SHALL NOT 写入 active 快照，但本 change 自己的就地标注允许写入 active 快照；`@lyx-archive` 的归档前核对标注不属于"重新生成或重建当前 change 快照"。
- `@lyx-explore` 列出快照时，在"已标注解决"计数之外补充其中"未复审"的条数。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `review-findings-snapshot`：新增「本 change 内修复标注」Requirement；修订「快照随归档落库」「追加式解决说明」「@lyx-explore 先询问后列出快照」中与 active 快照写入、归档前追加、列出计数相关的口径。

## Impact

- 模板：`templates/skills/review-plan.md`、`templates/skills/review-code.md`、`templates/skills/archive.md`、`templates/skills/explore.md`（两个宿主共享正文，无需改宿主片段）。
- 测试：`src/utils/__tests__/host-adapters.test.ts` 补充模板断言。
- 主 spec：`openspec/specs/review-findings-snapshot/spec.md`（归档时由 delta 合并）。
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md` 的快照机制描述同步（`README.zh-CN.md` 无对应段落，不改）。
- 不涉及 `src/` 下的运行时逻辑，无配置 / 安装产物结构变化；已安装用户需重新 `init` / update 才能拿到新模板。

## 解决的审查未修项

- openspec/changes/archive/2026-09-30-add-claude-host/review-findings.md#代码审查#1 — 已在 0a33558 修复（collectHostDoctorChecksWith 捕获 doctorChecks 抛错并返回 fail 体检项），本 change 补登记
- openspec/changes/archive/2026-09-30-add-claude-host/review-findings.md#代码审查#2 — 已在 0a33558 修复（legacy 清理失败设置 report.success = false），本 change 补登记
- openspec/changes/archive/2026-09-30-add-claude-host/review-findings.md#代码审查#3 — 已在 0a33558 修复（菜单先解析宿主集合再用 describeUninstallTargets 生成确认范围），本 change 补登记
