## Why

小需求与 bug 修复目前只能走 `@lyx-propose` 全流程：两次询问、proposal/design/tasks/delta/context.md 约百行文档、最多 5 个 commit（如 `fix-review-mode-summary-label` 为十几行代码产出约 100 行文档）。流程越重，绕开流程直接改代码的冲动越大，主 spec 反而更容易漂移（`ly-wrapper` 已是僵尸 spec）。需要一条轻量路径，既省掉仪式，又把 spec 同步作为强制步骤留住。

## What Changes

- 新增 `@lyx-fix` 命令（第 15 个 skill）：单命令完成「定位 → spec 分流 → 实施 → 自审 → 最终验证 → 提交」，不创建 OpenSpec change、不写 context.md / 审查快照、不询问隔离方式与自动化档位，直接在当前分支工作。
- spec 分流为强制步骤：A（真 bug，代码对齐 spec，spec 不动）/ B（小幅行为变化，同一 commit 内就地改主 spec，不走 delta 与归档）/ C（超出轻流程，停止并建议 `@lyx-propose`）；C 由 agent 按判断标准给出理由，用户显式坚持时可留在轻流程。
- 实施先写回归测试并观察其失败（无法写测试时记录原因）。
- 自审固定由主 agent 执行一轮，只查五项：①修对了吗 ②spec 一致吗（用实际 diff 复核分流结论）③漏改了吗（同类路径与成对位置，成对清单优先读项目 AGENTS.md 约定小节、缺失时由 agent 推断）④改多了吗 ⑤有回归测试吗；不分级、不留快照、不受 `reviewExecutor` / `reviewMode` 影响。
- 最终验证在自审之后作为提交门禁运行；验证失败修复后只对新增 diff 重跑③④，连续失败转人工。
- A 类直接提交；B 类提交前展示 spec 改动等待用户确认。
- 提交为单个非 change 生命周期 commit：CC 前缀（type 按实际改动），正文为动机/改动/影响 + `- spec：` / `- 自审：` / `- 验证：` 三条，不追加 `Change-Stage` / `Change-Name` trailer。
- `@lyx-explore` 讨论收敛时按规模分流提示：小改动提示 `@lyx-fix`，其余提示 `@lyx-propose`。
- 本仓库 AGENTS.md 新增「改动对称清单」小节，供 `@lyx-fix` 自审③读取。
- 文档与测试中的 skill 计数 14 → 15，命令表补 `@lyx-fix`。

## Capabilities

### New Capabilities

- `lightweight-fix-flow`: `@lyx-fix` 轻量修复流程的行为契约——适用范围与 A/B/C 分流、实施与回归测试、五项自审、最终验证门禁、B 类确认、提交约定。

### Modified Capabilities

- `ly-lifecycle-commands`: Explore 收敛提示由"固定提示 `@lyx-propose`"改为按规模分流提示 `@lyx-fix` / `@lyx-propose`。
- `commit-conventions`: 「非 change 生命周期 lyx 提交」与「lyx 生成提交统一复用 `@lyx-commit` 正文规范」两条的列举清单纳入 `@lyx-fix`，并约定其正文附加条目。

## Impact

- 模板：新增 `templates/skills/fix.md`（共享正文，无宿主片段）；修改 `templates/skills/explore.md` 收敛提示。
- 代码：`src/utils/installer-data.ts` 注册 `fix` 命令。
- 测试：`host-adapters.test.ts` / `installer.test.ts` / `host-ops.test.ts` 的数量断言 14 → 15，新增 fix 模板内容断言与 explore 分流提示断言。
- 文档：AGENTS.md（命令表、计数、新增「改动对称清单」小节）、CLAUDE.md、README.md、README.zh-CN.md、`templates/CLAUDE.md`、CHANGELOG。
- 兼容：纯新增命令；既有命令行为不变（explore 仅改收敛提示文案）。两宿主重装后生效。
