## 1. 模板

- [ ] 1.1 `templates/skills/explore.md`：改写"进入前：审查未修项快照询问"段——扫描后读取快照，按"Warning 顶层条目下有任意 `- 解决：` 子项即已解决"判定；只展示未解决条目（各节未解决条数 + 一行摘要，节内无未解决条目时不展示该节，全部已解决的 change 不出现）；所有快照都没有未解决条目时不询问；询问中的 change 数只计含未解决条目的 change；读取失败照常跳过并注明；不提供展开已隐藏条目的入口。删除"已标注解决 / 未复审 / 复审未通过"计数及其示例，删除末段关于复审说明与"未复审"就地标注的叙述
- [ ] 1.2 `templates/skills/archive.md`：删除"回写审查未修项复审说明"整节；冻结口径改为"冻结后仅允许追加式解决说明"；归档前核对的就地标注格式改为 `- 解决：本 change 内修复（commit <短 hash>）— <一句说明>`；第 82 行附近"解决说明与复审说明同理"改为只提解决说明
- [ ] 1.3 `templates/skills/review-plan.md` 与 `templates/skills/review-code.md`：就地标注格式改为 `- 解决：本 change 内修复（commit <短 hash>）— <一句说明>`，删除"一律带'未复审'，SHALL NOT 产出不带'未复审'的变体"
- [ ] 1.4 `templates/skills/propose.md`：删除"复审的审查未修项声明（可选）"整段
- [ ] 1.5 验证：`grep -rn "复审" templates/` 零命中

## 2. 测试

- [ ] 2.1 `src/utils/__tests__/host-adapters.test.ts`：删除 `templates declare and write back re-review notes` 用例中的复审断言（保留"作为参数传入，SHALL NOT 让其再次推断或询问目标 change"断言，迁到合适用例）；就地标注 `note` 改为新格式；删除 explore 的"未复审 / 已标注解决（3 条未复审）"断言
- [ ] 2.2 新增断言：explore 模板包含"只展示未解决"、"全部已解决时不询问"、"不提供展开"的口径，且不含"已标注解决""复审"；archive / propose / review-plan / review-code 模板不含"复审"
- [ ] 2.3 运行 `npx vitest run src/utils/__tests__/host-adapters.test.ts` 通过

## 3. 主 spec Purpose 与文档

- [ ] 3.1 直接编辑 `openspec/specs/review-findings-snapshot/spec.md` 的 `## Purpose`：删除"'未复审'就地标注"与"后续 change 可在已归档快照上追加复审说明（结论成立 / 不成立）"的叙述，`@lyx-explore` 改为"只列出未解决条目"，"允许追加式解决说明与复审说明"改为"允许追加式解决说明"；只改 Purpose，不改 Requirements
- [ ] 3.2 AGENTS.md / CLAUDE.md / README.md / README.zh-CN.md 的审查未修项快照段落：删除复审声明与回写、"未复审 / 复审未通过"计数的描述；explore 改为"只列出未解决条目、全部已解决时不询问"；就地标注格式去掉"未复审"
- [ ] 3.3 验证：`grep -n "复审" AGENTS.md CLAUDE.md README.md README.zh-CN.md` 零命中

## 4. 一次性清理已归档快照（冻结规则的显式例外，见 design D4）

- [ ] 4.1 `openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/review-findings.md`：删除全部 5 行 `- 复审：…`；把 `（未复审，commit` 改为 `（commit`（5 处）
- [ ] 4.2 `openspec/changes/archive/2026-09-30-host-subagent-model-config/review-findings.md` 与 `openspec/changes/archive/2026-09-30-review-findings-rereview-and-residual-fixes/review-findings.md`：各把 1 处 `（未复审，commit` 改为 `（commit`
- [ ] 4.3 验证：`grep -rn "复审" openspec/changes/archive/*/review-findings.md` 零命中；`git diff --stat` 只涉及上述三个快照文件中的这些行，Warning 原文与编号不变
