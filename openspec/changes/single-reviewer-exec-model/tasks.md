# Tasks: single-reviewer-exec-model

## 1. 审查关卡模板重写

- [ ] 1.1 重写 `templates/skills-codex/review-code.md` 执行模型：单审查 subagent 非 fork spawn（移除双审/交换结论/共识归并全部描述）；TASK 增加 context.md 路径引用；第 2 轮起 spawn 一个全新 subagent（增量 TASK 语义不变）；驳回硬线两口径写入终止条件（逐条 + 整轮"连续 2 轮全驳回"）；可核验依据要求与逐条并排展示写入裁决与报告章节；失败分类删除"另一 agent 结论完整"降级与"交换结论长链兜底"；模型指示改为仅 reviewModel + reviewReasoningEffort（reviewModelB 标注弃用不读取）
- [ ] 1.2 重写 `templates/skills-codex/review-plan.md` 执行模型：与 1.1 同一套语义（保持两模板一致，避免漂移），审查对象/修复对象/openspec validate 验证等 plan 特有内容保留
- [ ] 1.3 检查两模板中残留的"双审查/fork/分歧未决/agent A/B"措辞并清零（grep 验证）

## 2. propose / apply 模板与 context.md 生命周期

- [ ] 2.1 `templates/skills-codex/propose.md`：在"方案自审 → commit"之间新增 context.md 产出环节（内容边界按 review-context-artifact：决策/否决理由/范围边界/已知坑，≤100 行，无实质内容产出最小骨架），纳入 `propose:` commit
- [ ] 2.2 `templates/skills-codex/apply.md`：coding subagent 改为非 fork spawn（TASK 含 context.md 路径引用 + 只实施 change 范围点名）；新增"实施完成后回写 context.md（只增不删，随 apply: commit）"环节
- [ ] 2.3 `templates/prompts/codex/reviewer.md` 与 `plan-reviewer.md` 确认无需改动（角色词行为契约不重写；若其中含"等待另一 agent 结论"类措辞才做最小修正）

## 3. 配置字段降级与 doctor/向导代码

- [ ] 3.1 `src/types/index.ts`：`reviewModelB`/`reviewReasoningEffortB` 注释标注弃用（单审查执行模型不读取，字段保留）
- [ ] 3.2 `lycx doctor` 检查项（src/commands 或 utils 中对应实现）：`reviewModelB`/`reviewReasoningEffortB` 输出弃用提示（展示存量值，不 FAIL），其余逻辑不变；补充/更新对应单测
- [ ] 3.3 init 向导"模型三连"改"模型二连"（移除 reviewModelB 采集，保留 reviewModel/codingModel 候选语义与既有值默认）；所有重写 `[codexHost]` 路径确认保留存量 `reviewModelB`/`reviewReasoningEffortB` 原值；补充/更新对应单测
- [ ] 3.4 全量验证：`pnpm typecheck && pnpm lint && pnpm test && pnpm build` 通过

## 4. 文档同步

- [ ] 4.1 `AGENTS.md` 审查执行模型章节重写（单审 + 非 fork + context.md + 驳回硬线 + reviewModelB 弃用）；`templates/CLAUDE.md` 对应导航段同步
- [ ] 4.2 `README.md` 中描述双审查/模型三连的段落同步
- [ ] 4.3 归档后待办提醒（写入 change 备注或 issue）：archive 后手动同步 ly-review-gates / subagent-agent-config / ly-propose-flow 主 spec 的 Purpose 段（delta 不覆盖 Purpose）

## 验证方式

- 3.4 的构建/测试命令为硬验证；模板改动以 1.3 的 grep 清零检查 + 人工通读核对与新 spec 条目一致为准
