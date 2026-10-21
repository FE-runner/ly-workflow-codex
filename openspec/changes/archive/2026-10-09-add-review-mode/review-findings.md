# 审查未修项快照

## 方案审查

- 轮次：1（Critical 0，正常清零；执行者 subagent 不可用，回退主会话）
- 记录时间：2026-10-09T12:00:00+0800
- 基线：propose 阶段 commit `1dde70f`
- 基线状态：循环无实际改动，未创建 review-plan-fix commit；本快照保持未跟踪

1. [specs/subagent-agent-config/spec.md] — 新增 `reviewMode` 契约用 ADDED Requirement 承载，但既有的「init 向导…采集…」与「doctor 校验子代理模型配置」两条 Requirement 仍按旧采集面 / 体检面描述，未点名 `reviewMode`；读者可能理解为"两套采集面 / 体检面并存"。
   建议: 如需彻底消歧，可把这两条既有 Requirement 改为 MODIFIED 并在正文点名 `reviewMode`；当前以 ADDED Requirement 作为新字段权威、既有 Requirement 保持对旧字段集的描述，属可接受但需注意的表述并存。
   - 解决：lyx-fix（commit 062c7f1，2026-10-21）— subagent-agent-config 的 init 采集集合与 doctor 检查项已点名 reviewMode
2. [design.md] — Risks 段落写"`reviewMode` 的取值解析集中在配置层清洗函数，模板只读解析结果"，但模板运行时直接读 `config.toml` 原文（清洗只发生在写入路径）；用户手改 TOML 写入非法值时，模板须自行按"非法等价 `full`"处理。
   建议: 措辞改为"写入路径经清洗函数收敛取值；运行时模板对未配置 / 空白 / 非法一律按 `full` 处理"。
   - 解决：lyx-fix（commit 062c7f1，2026-10-21）— 10-09 design.md 的 Risks 措辞已改为"写入路径收敛、模板运行时归一化"

## 代码审查

- 轮次：1（Critical 0，正常清零；执行者 subagent）
- 记录时间：2026-10-09T12:20:00+0800
- 基线：apply 阶段 commit `3f7c0b5`
- 基线状态：循环无实际改动，未创建 review-code-fix commit；本快照保持未跟踪

1. [openspec/changes/add-review-mode/specs/subagent-agent-config/spec.md:30, src/hosts/codex/doctor.ts:146, src/hosts/claude/doctor.ts:123] — doctor 在 `reviewMode=off` 且 review 侧字段非空时会把检查项整体置为 `warn`，但 spec 场景写"整体判定不因此变化" — 统一口径：建议把 spec 修正为"整体判定变为 warn"，或让该提示不改检查项 status。
   建议: 二选一对齐：改 spec 场景文案，或让 `reviewOffWarn` 不参与检查项 `status`。
   - 解决：lyx-fix（commit 062c7f1，2026-10-21）— spec 场景改为"检查项 warn、整体判定随之变为 warn（不报 FAIL）"，与代码对齐
2. [src/commands/__tests__/menu-config.test.ts:337, openspec/changes/add-review-mode/specs/subagent-agent-config/spec.md:25] — proposal/tasks/spec 要求菜单配置入口也覆盖 `off` 跳过与保留，但菜单测试没有该用例 — 补一个走 `configExecutorsAndModels` 的菜单分支测试。
   建议: 新增菜单分支测试：`reviewMode=off` 时跳过 review 侧提问、既有值原样保留、coding 侧照常采集。
   - 解决：lyx-fix（commit ba32e3c，2026-10-21）— 新增 reviewMode=off 菜单用例，覆盖跳过 review 侧提问、既有值保留、coding 侧照常采集
