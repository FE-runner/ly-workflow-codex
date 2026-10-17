## 1. 判级标准（六处逐字一致）

- [ ] 1.1 在 `templates/hosts/codex/prompts/reviewer.md` 与 `templates/hosts/claude/agents/lyx-reviewer.md` 的 `## 判级标准` 小节补「可自动修复」标注内容（Warning 专用字段、四条判据、负面信号与"建议显式给出推荐方向"例外、必须判「是」的反向清单、多子问题整条判级）；以脚本抽取两份 rubric 段比对 sha256 相等作为完成验证
- [ ] 1.2 同法补 `templates/hosts/codex/prompts/plan-reviewer.md` 与 `templates/hosts/claude/agents/lyx-plan-reviewer.md`（方案审查语境：proposal/design/tasks/delta spec）；同样以抽取段 sha256 相等验证
- [ ] 1.3 同法补 `templates/skills/review-code.md` 与 `templates/skills/review-plan.md`，确保 `reviewExecutor = "main"` 路径（不读角色词）也能读到同一份判据；以三方（codex 角色词 / claude 角色词 / 共享模板）抽取段 sha256 相等验证
- [ ] 1.4 扩展 `src/utils/__tests__/host-adapters.test.ts` 的三方一致性断言，覆盖新判据锚点（`可自动修复`、四条判据名、`SHALL NOT 半修`）；先红后绿，`pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 通过

## 2. 循环语义（review-code / review-plan 共用）

- [ ] 2.1 `templates/skills/review-code.md` 与 `templates/skills/review-plan.md`：正常清零定义改为「Critical 数 = 0 且首轮标注为「是」的 Warning 条目已全部确认修复」；同步 frontmatter `description`、开头 `main` 路径段落中"发现 Critical 时直接修复"的表述、终止条件 1 的措辞
- [ ] 2.2 两模板补「自动修只消费第 1 轮」与「未修好即降级」：次轮新出现的「是」条目直接落快照、不进循环、不参与清零判定；首轮「是」条目若次轮复审仍存在则降级为「否」并落快照、不再重试
- [ ] 2.3 两模板明确熔断 / 驳回硬线 / 无法安全自动修复 / 修复后验证失败 / 审查调用失败 / 审查对象类型持续系统性误判仍只以 Critical 为判定对象，全局 5 轮上限与"清零优先于轮数上限"不变
- [ ] 2.4 两模板的第 2 轮起增量 TASK 构造补「首轮全部「是」条目的逐字原文」（与 Critical 逐字原文同一增量语义），并说明未携带原文的条目 SHALL NOT 被当作已修复
- [ ] 2.5 `templates/skills/propose.md` 全自动流水线的 review-plan / review-code 两处推进条件与对应节点前置校验的判据表述同步为新的正常清零定义

## 3. 报告与留痕

- [ ] 3.1 两模板的报告区块补两项：自动修复的「是」条目单独列出修复结果（已修 / 降级为「否」及依据）；当前会话覆盖标注时逐条列出被覆盖条目、原标注、覆盖后取值与理由
- [ ] 3.2 核对两模板的 Warning 报告小节标题与"最后一轮结果"语义未被破坏（标注为增列，不改严重度分级结构），以渲染产物包含既有小节标题断言验证

## 4. 快照口径

- [ ] 4.1 两模板「循环结束后写入审查未修项快照」段落把"只收 Warning"改为"只收未被自动修复的 Warning"，写明三类情形：「否」条目一律收录；「是」但因非清零终止 / `--no-commit` / 统一 commit 失败而未修完的收录；「是」且已修复并进入统一 commit 的不收录
- [ ] 4.2 核对 `templates/skills/archive.md` 归档前核对与 `templates/skills/explore.md` 未解决计数：确认两者口径基于"快照里没有解决子项的 Warning"、本 change 下零改动；若核对发现需要改动，补对应任务与 spec 变更后再实施
- [ ] 4.3 `src/utils/__tests__/host-adapters.test.ts` 增加断言守护 4.2 的"零改动"结论（archive / explore 渲染产物仍含既有口径锚点，且未被本 change 改写）

## 5. 对称改动（断言 / 根文档 / 变更记录）

- [ ] 5.1 同步根文档中的行为描述：`AGENTS.md`（审查执行模型、审查未修项快照段）、`CLAUDE.md`（速览）、`README.md` 与 `README.zh-CN.md`（命令表与说明中的循环描述）
- [ ] 5.2 `CHANGELOG.md` 顶部新增本次条目（按 Keep a Changelog 分组归类）
- [ ] 5.3 全量验证：`pnpm typecheck`、`pnpm test`、`pnpm build` 全绿，且 `openspec validate --changes add-autofixable-warning-axis` 通过

## 6. 行为验证（两条执行者路径）

- [ ] 6.1 用一份临时 change 构造 1 条「是」+1 条「否」的 Warning，在 `reviewExecutor = "main"` 路径下演练：确认「是」进循环并参与清零判定、「否」直接落快照、次轮新出现的「是」不进循环
- [ ] 6.2 在 `reviewExecutor = "subagent"` 路径下重跑 6.1 的同一场景，确认两条路径的分级与标注口径一致（判据同源）
- [ ] 6.3 确认生效方式已在根文档说明：本 change 不含新配置字段，已装副本需 `lycx update`（或下次发版）重渲染后生效
