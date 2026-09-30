## Why

复审 `in-change-review-findings-resolution` 的 5 条「本 change 内修复（未复审）」时确认修复均成立，但暴露两类问题：一是复审结论无处留痕——就地标注固定带"未复审"、已归档快照冻结后只允许追加解决说明，`@lyx-explore` 会永远显示"5 条未复审"，计数失去提示意义；二是复审中发现的 3 处残留（A：`@lyx-commit --all` / propose WIP 的 `git add -A` 仍会把未跟踪快照提前纳入；B：`README.zh-CN.md` 自快照功能引入起从未同步其机制；C：archive 核对阶段确定的 change 名未传给后续委托）。

## What Changes

- **A 快照排除扩展到全量暂存**：`@lyx-commit --all`（暂存区为空时的 `git add -A`）与 `@lyx-propose` 的 WIP commit（`git add -A`）SHALL 排除进行中 change 目录下的 `review-findings.md`（`git add -A -- ':/' ':(top,exclude,glob)openspec/changes/*/review-findings.md'`，以仓库顶层为锚点）；"未归档快照保持未跟踪"约束从 review-plan / apply / review-code 三类提交扩展到所有 lyx 全量暂存路径。
- **B README.zh-CN.md 同步快照机制**：命令表 explore / review-plan / review-code 三行与架构段补齐快照写入、先询问后列出、跨 change 解决说明、就地标注与复审说明，对齐 `README.md`。
- **C archive 传递已确定的 change 名**：`@lyx-archive` 未指定参数时，归档前核对阶段确定的目标 change 名 SHALL 作为参数交给 `openspec-archive-change`，SHALL NOT 让其二次推断。
- **D 追加式复审说明**：新增 `proposal.md` 可选小节 `## 复审的审查未修项`（`- <归档快照路径>#<节名>#<序号>（结论：成立|不成立）— <说明>`）；`@lyx-archive` 归档时向已归档快照对应 Warning 追加 `- 复审：<change-name>（归档于 <YYYY-MM-DD>，结论：成立|不成立）— <说明>`，规则同解决说明（原文不改、按 change 名幂等、失败逐条跳过不阻断、不新增提交）。
- **D explore 计数口径**：「未复审」= 带"未复审"就地标注且无任何复审说明的条目；新增「复审未通过」= 最后一条复审说明结论为"不成立"的条目；两者互斥。
- **自举**：本 change 声明复审上述 5 条，结论均为"成立"。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `review-findings-snapshot`：新增「追加式复审说明」Requirement；修订「快照随归档落库」（全量暂存排除 + 允许复审说明追加）、「追加式解决说明」（冻结后的允许写入由"仅解决说明"放宽为"解决说明与复审说明"）与「@lyx-explore 先询问后列出快照」（未复审 / 复审未通过计数）。
- `ly-propose-flow`：新增「proposal.md 声明复审的审查未修项」Requirement。
- `ly-lifecycle-commands`：修订 archive 委托口径——未指定参数时以核对阶段确定的 change 名委托 `opsx:archive`。

## Impact

- 模板：`templates/skills/commit.md`、`propose.md`、`archive.md`、`explore.md`（共享正文，不涉及宿主片段）。
- 主 spec：`openspec/specs/review-findings-snapshot/spec.md` 的 `## Purpose` 直接修订；其余由 delta 合并。
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`README.zh-CN.md`。
- 测试：`src/utils/__tests__/host-adapters.test.ts` 补模板断言。
- 不涉及 `src/` 运行时逻辑与安装产物结构；已安装用户需重新 `init` / update 才能拿到新模板——**本 change 归档前须先更新本机已安装的 skills**，否则旧版 `@lyx-archive` 不识别复审声明。

## 复审的审查未修项

- openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/review-findings.md#方案审查#1（结论：成立）— delta spec 触发点 2 已补"节基线不可用时由用户提供 hash"及 Scenario，与 design D5 / archive 模板一致
- openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/review-findings.md#方案审查#2（结论：成立）— review 模板修复提交按路径暂存、排除快照；`@lyx-commit --all` 等全量暂存路径的残留由本 change A 项另行覆盖
- openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/review-findings.md#方案审查#3（结论：成立）— AGENTS / CLAUDE / README.md 已同步；README.zh-CN.md 的既存缺口由本 change B 项补齐
- openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/review-findings.md#代码审查#1（结论：成立）— archive 核对段先确定目标 change、不能唯一确定时询问；向委托传名由本 change C 项补齐
- openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/review-findings.md#代码审查#2（结论：成立）— design D4 与两个 review 模板口径一致，测试断言覆盖"不委托 `@lyx-commit --all`"
