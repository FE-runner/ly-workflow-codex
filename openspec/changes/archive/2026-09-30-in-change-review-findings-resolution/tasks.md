## 1. 审查关卡模板（触发点 A）

- [x] 1.1 `templates/skills/review-code.md`：在"循环结束后写入审查未修项快照"段之后新增"审查后同会话修复的就地标注"段——格式 `- 解决：本 change 内修复（未复审，commit <短 hash>）— <说明>`、修复提交后才标注、标注前确认、修复提交排除快照、hash 幂等、原文与编号不变、不新增提交、写入失败逐条跳过并报告、报告列出已标注条目编号
- [x] 1.2 `templates/skills/review-plan.md`：同 1.1（对应 `## 方案审查` 节）
- [x] 1.3 两个模板的"节级 upsert"条目补一句：重跑后整节替换，已有就地标注随旧节消失，不合并

## 2. 归档模板（触发点 C + 口径收窄）

- [x] 2.1 `templates/skills/archive.md`：在"归档前完整验证"之后、委托 OpenSpec 归档之前新增"归档前核对本 change 未标注 Warning"段——统计无解决子项的 Warning；为 0 或无快照不询问；非零询问一次（默认不核对）；逐条以快照基线..HEAD 触及位置文件的提交为候选（基线不可解析时由用户给出 hash）、用户逐条确认后标注（节基线、多文件并集）；否认 / 无候选跳过并说明；失败不阻断归档
- [x] 2.2 `templates/skills/archive.md`：失败容错中"SHALL NOT 改写 active 快照"限定为跨 change 回写，注明不影响本 change 就地标注；快照落库段注明归档前就地标注不视为重建

## 3. 探索模板

- [x] 3.1 `templates/skills/explore.md`：列出时在"已标注解决"计数之外显示其中"未复审"条数（按 Warning 条目计），示例 `3 条 Warning，其中 3 条已标注解决（3 条未复审）`；更新快照说明句，注明解决说明也可来自本 change 内就地标注

## 4. 主 spec Purpose、文档与测试

- [x] 4.1 直接修订 `openspec/specs/review-findings-snapshot/spec.md` 的 `## Purpose`，补充"同一 change 内修复可就地标注（未复审）"的叙述
- [x] 4.2 同步 `AGENTS.md` / `CLAUDE.md` / `README.md` 的快照机制描述（就地标注、归档前核对、未复审计数）
- [x] 4.3 `src/utils/__tests__/host-adapters.test.ts`：新增断言——review-plan / review-code 含就地标注格式与"未复审"、archive 含归档前核对与口径收窄、explore 含"未复审"计数；确认既有断言仍成立
- [x] 4.4 运行 `openspec validate in-change-review-findings-resolution --strict` 与项目测试确认通过
