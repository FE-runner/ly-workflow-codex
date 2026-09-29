## 1. 快照条目编号（锚点基础）

- [x] 1.1 更新 `templates/skills-codex/review-plan.md` 的「循环结束后写入审查未修项快照（Warning）」段落：明确 `## 方案审查` 节内 Warning 条目 SHALL 使用从 1 起的连续编号（`1.` / `2.` / ...），作为 `<归档路径>#方案审查#<序号>` 锚点的定位基础；验证模板出现"连续编号"与"#方案审查#"措辞。
- [x] 1.2 更新 `templates/skills-codex/review-code.md` 的同名段落：明确 `## 代码审查` 节内 Warning 条目连续编号；验证模板出现"连续编号"与"#代码审查#"措辞。

## 2. propose 声明小节

- [x] 2.1 更新 `templates/skills-codex/propose.md`：在方案生成/自审相关步骤中新增规则——当用户明确本次 change 解决了某条历史 Warning 时，在 `proposal.md` 写入可选小节 `## 解决的审查未修项`，每条以 `<归档快照路径>#<节名>#<序号>` 引用并附一句说明；不适用时省略该小节；propose 阶段 SHALL NOT 直接改写历史快照。验证模板出现小节标题、锚点格式与"不回写"约束。

## 3. archive 回写解决说明

- [x] 3.1 更新 `templates/skills-codex/archive.md`：在 opsx:archive 成功之后、提交归档改动之前新增"回写审查未修项解决说明"步骤——读取 `proposal.md` 的 `## 解决的审查未修项`，向已归档快照对应 Warning 条目追加 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>`；原 Warning 原文逐字不改；仅允许已归档快照；只处理显式声明、不做自动扫描或语义匹配；不引入 open/closed 状态字段；同 change 名幂等；锚点无法解析时逐条跳过并如实报告、不阻断归档；不新增独立提交。验证模板出现锚点格式、幂等、跳过并报告、随归档 commit 落库、不引入状态字段与不做自动匹配的措辞。

## 4. explore 展示已解决计数

- [x] 4.1 更新 `templates/skills-codex/explore.md`：列出快照时在各节 Warning 计数之外标注"其中已标注解决 M 条"，保留先询问后列出流程与参数原样转发约束；验证模板出现"已标注解决"措辞且 `SHALL NOT 直接列出` 仍在。

## 5. 测试与结构验证

- [x] 5.1 更新 `src/utils/__tests__/host-adapters.test.ts`：在现有快照断言基础上补充——review 模板含连续编号规则；propose 模板含 `## 解决的审查未修项` 与锚点格式；archive 模板含解决说明回写、幂等与跳过容错；explore 模板含已标注解决计数；验证 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 通过。
- [x] 5.2 运行 `openspec validate --changes review-findings-resolution-notes --strict`，确认 change artifacts 结构合法。

## 6. 文档同步

- [x] 6.1 同步 `README.md` 与 `CLAUDE.md` 的 review/explore 行为摘要：说明历史 Warning 可在后续 change 的 `proposal.md` 声明解决，由 `@lyx-archive` 追加解决说明、原文不改，`@lyx-explore` 列出时显示已标注解决条数；验证两份文档均出现等价描述（`CHANGELOG.md` / `AGENTS.md` 按仓库约定发版时同步，本次不改）。
