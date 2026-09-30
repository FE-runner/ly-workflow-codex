# 审查未修项快照

## 方案审查

- 轮次：1（Critical 0，正常清零）
- 记录时间：2026-09-30T11:55:00+0800
- 基线：propose 阶段 commit `756bbdca4ff5aef0160cc1fbfbe8d32af106c0bc`
- 基线状态：循环无实际改动，未创建 review-plan-fix commit；本快照保持未跟踪

1. [specs/review-findings-snapshot/spec.md:ADDED「本 change 内修复标注」触发点 2；design.md:D5；tasks.md:2.1] — 三份文档对"没有候选 commit"的处理不一致：design D5 / tasks 2.1 写"基线缺失或不可解析时退化为只展示条目、由用户直接给出 hash"，delta spec 只写"找不到候选 commit 或用户否认的条目 SHALL 跳过并如实说明"，没有"由用户直接给出 hash"这条路径。基线 Requirement 允许元信息只记"明确的基线状态"（如 `--no-commit` / 统一 commit 失败），这时基线本就不是 commit，按 spec 实施会直接跳过，按 design 实施会让用户补 hash。
   建议: 在 delta spec 触发点 2 补"基线缺失或不可解析时只展示条目、由用户直接提供修复 commit hash，并按『必须引用已存在的修复 commit』校验"，并加对应 Scenario；或反向改 design/tasks，三处口径统一。
   - 解决：本 change 内修复（未复审，commit cb66b28）— delta spec 触发点 2 补"节基线不可用时由用户提供 hash"及对应 Scenario，与 design D5 / tasks 2.1 对齐
   - 复审：review-findings-rereview-and-residual-fixes（归档于 2026-09-30，结论：成立）— delta spec 触发点 2 已补"节基线不可用时由用户提供 hash"及 Scenario，与 design D5 / archive 模板一致

2. [design.md:D4；specs/review-findings-snapshot/spec.md:ADDED「本 change 内修复标注」不新增提交；tasks.md:1.1/1.2] — 触发点 A 的修复提交"沿用 `@lyx-commit` 规范"，而 `templates/skills/commit.md` 的 `--all` 会 `git add -A`，可能把未跟踪的 `review-findings.md` 带进修复 commit：既违反基线「快照随归档落库」的"未归档 change 快照保持未跟踪"，也让"就地标注只改工作区中未跟踪的快照文件"的前提失效。方案未对此边界做约束。
   建议: 在 ADDED Requirement 与 tasks 1.1/1.2 明确触发点 A 的修复提交 SHALL 排除 `review-findings.md`（只按路径暂存修复文件或显式 `git reset -- <快照>`），并说明快照已被意外跟踪时的处理（如实报告，或照常追加随后续提交落库）。
   - 解决：本 change 内修复（未复审，commit cb66b28）— delta spec 与 review 模板补"修复提交只按路径暂存、排除快照"
   - 解决：本 change 内修复（未复审，commit 699abd9）— review 模板写明不委托 `@lyx-commit --all`，design D4 同步
   - 复审：review-findings-rereview-and-residual-fixes（归档于 2026-09-30，结论：成立）— review 模板修复提交按路径暂存、排除快照；`@lyx-commit --all` 等全量暂存路径的残留由本 change A 项另行覆盖

3. [proposal.md:Impact；AGENTS.md:137；CLAUDE.md:审查执行模型（速览）；README.md:74] — AGENTS.md（权威开发文档）/ CLAUDE.md / README.md 均描述快照机制为"只有后续 change 经 `## 解决的审查未修项` 才能标注解决；explore 显示已标注解决条数"。本 change 新增就地标注、归档前核对询问与"未复审"计数，但 Impact 与 tasks 均未列这些文档的同步更新，实施后会文档/行为脱节（CLAUDE.md 自身声明须与 AGENTS.md 对齐）。README.zh-CN.md 是否有对应段落也需确认。
   建议: 在 proposal Impact 补 AGENTS.md / CLAUDE.md / README.md（及 README.zh-CN.md，如有对应段落），并在 tasks.md 增加"文档同步"任务。
   - 解决：本 change 内修复（未复审，commit cb66b28）— proposal Impact 与 tasks 4.2 补文档同步，AGENTS.md / CLAUDE.md / README.md 已更新
   - 复审：review-findings-rereview-and-residual-fixes（归档于 2026-09-30，结论：成立）— AGENTS / CLAUDE / README.md 已同步；README.zh-CN.md 的既存缺口由本 change B 项补齐

## 代码审查

- 轮次：1（Critical 0，正常清零）
- 记录时间：2026-09-30T12:05:00+0800
- 基线：apply 阶段 commit `cb66b2849167b3893c073ae3616f2af7e8123ca1`
- 基线状态：循环无实际改动，未创建 review-code-fix commit；本快照保持未跟踪

1. [templates/skills/archive.md:23-33, templates/skills/archive.md:11] — 未传参数时，归档前核对不知道该读哪个 change 的快照：第 11 行规定无参数时目标 change 由 opsx:archive 按默认规则确定，而新增核对段在委托 opsx 归档之前运行，却直接读 `openspec/changes/<change-name>/review-findings.md`，此时 `<change-name>` 可能尚未确定。执行时可能猜一个 change，或因"快照不存在"静默跳过核对，后者正好违背触发点 C 的兜底初衷。
   建议: 在核对段开头加"未指定参数时，先按 opsx:archive 的默认规则确定目标 change；不能唯一确定时询问用户，再做核对"，或写明没有确定的 change 名时如实说明并跳过、不猜测。
   - 解决：本 change 内修复（未复审，commit 699abd9）— archive 核对段先确定目标 change，不能唯一确定时询问，不猜测
   - 复审：review-findings-rereview-and-residual-fixes（归档于 2026-09-30，结论：成立）— archive 核对段先确定目标 change、不能唯一确定时询问；向委托传名由本 change C 项补齐

2. [templates/skills/review-code.md:162, templates/skills/review-plan.md:165, templates/skills/commit.md:49, openspec/changes/in-change-review-findings-resolution/design.md（D4）] — 修复提交的做法各处未对齐：design D4 说修复提交沿用 `@lyx-commit` 规范，新段落没写修复提交由谁、用什么方式完成；而 `@lyx-commit --all` 在暂存区为空时执行 `git add -A`，会把未跟踪的 `review-findings.md` 纳入提交，正是"修复提交排除快照"禁止的方式。用户同会话顺手用 `@lyx-commit --all` 提交修复很常见，现有规则只能事后"如实报告已被意外跟踪"，事前防不住。
   建议: 二选一——在两个 review 模板写明修复提交由主会话按路径暂存、message 参照 `@lyx-commit` 格式、不委托 `@lyx-commit --all`；或在 `commit.md` 的 `--all` 分支排除 change 目录下未跟踪的 `review-findings.md`（超出本 change 声明范围，需同步改 proposal/tasks）。
   - 解决：本 change 内修复（未复审，commit 699abd9）— review 模板写明修复提交按路径暂存，不委托 `@lyx-commit --all`
   - 复审：review-findings-rereview-and-residual-fixes（归档于 2026-09-30，结论：成立）— design D4 与两个 review 模板口径一致，测试断言覆盖"不委托 `@lyx-commit --all`"
