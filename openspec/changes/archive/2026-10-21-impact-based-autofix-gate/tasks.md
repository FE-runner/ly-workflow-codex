## 1. 判级标准（六处逐字一致）

- [x] 1.1 在 `templates/hosts/codex/prompts/reviewer.md` 与 `templates/hosts/claude/agents/lyx-reviewer.md` 的 `## 判级标准` 增加 `影响落地：是 / 否` 标注与判据（四条成立条件、双向清单、多子问题整条判定）；抽取两文件 rubric 段比对 sha256 相等
- [x] 1.2 同法补 `templates/hosts/codex/prompts/plan-reviewer.md` 与 `templates/hosts/claude/agents/lyx-plan-reviewer.md`；比对 sha256 相等
- [x] 1.3 同法补 `templates/skills/review-code.md` 与 `templates/skills/review-plan.md`，保证 `main` 路径也拿到同一判据；三方（codex / claude / 共享模板）逐字相等

## 2. 循环语义（review-code / review-plan 共用）

- [x] 2.1 两模板把「自动修复条目的范围与降级（只消费首轮）」整段替换为四象限消费规则：`是+是` 不限轮次自动修并参与清零；`是+否` 落快照；`否+是` 停止转人工；`否+否` 落快照
- [x] 2.2 两模板把正常清零改为「Critical 为 0 且所有 `影响落地=是` 的 Warning 都已自动修复」，并同步 frontmatter description 与开头 `main` 路径段落
- [x] 2.3 两模板把终止条件扩为 7-9：影响项熔断、不可自动修的影响项、第 3 轮起新增影响项；同步"出现终止条件 2-6"为"2-9"
- [x] 2.4 两模板的下一轮 TASK 增量语义改为携带「上一轮 `影响落地=是` 条目的逐字原文」，删除对已移除 Requirement 的引用
- [x] 2.5 `templates/skills/propose.md` 两处推进条件的括号定义同步为「Critical 为 0 且所有 `影响落地=是` 的 Warning 都已解决」

## 3. 报告与输出契约

- [x] 3.1 两模板的 `OUTPUT 约定` / `OUTPUT 约束` 行补「每条 Warning 须同时附 `可自动修复` 与 `影响落地` 两项标注」
- [x] 3.2 两模板报告区块改为按四象限列出结果（已修 / 落快照 / 触发停止转人工及依据），并保留覆盖留痕要求

## 4. 主 spec 同步

- [x] 4.1 `ly-review-gates` 主 spec 已通过 delta 落库：新增「审查发现的影响落地标注」、移除「自动修只消费首轮发现且不返工」、修改「审查-修复循环与终止条件」与「循环结束后统一提交」
- [x] 4.2 `ly-propose-flow` 主 spec 的关卡推进条件括号定义已通过 delta 同步
- [x] 4.3 核对 `review-findings-snapshot`、`archive.md`、`explore.md` 无需改动；在 `src/utils/__tests__/host-adapters.test.ts` 加断言守护既有口径锚点

## 5. 断言

- [x] 5.1 扩展 `host-adapters.test.ts`：三方判级标准一致、`影响落地` 锚点、四象限段落、三条新终止条件、旧「只消费首轮/降级」文本不再出现
- [x] 5.2 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 全绿

## 6. 文档与变更记录

- [x] 6.1 同步 `AGENTS.md` 的自动修复轴条目（轮次制 → 影响面制）、`CLAUDE.md` 速览、`README.md` / `README.zh-CN.md` 的审查循环描述
- [x] 6.2 `CHANGELOG.md`：按仓库惯例随下一次发版 commit 写版本节，本 change 不改

## 7. 验证

- [x] 7.1 `openspec validate --changes impact-based-autofix-gate` 通过
- [x] 7.2 `pnpm typecheck`、`pnpm test`、`pnpm build` 全绿
- [x] 7.3 确认生效方式：纯模板改动，需 `lycx update` 或发版后对已装副本生效
