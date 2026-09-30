## 1. 全量暂存排除进行中快照（A）

- [ ] 1.1 `templates/skills/commit.md`：`--all` 分支由 `git add -A` 改为 `git add -A -- . ':(exclude,glob)openspec/changes/*/review-findings.md'`，并注明排除原因（进行中 change 快照须保持未跟踪、不波及 `archive/`）与"已被跟踪时如实报告、不自动 `git rm --cached`"
- [ ] 1.2 `templates/skills/propose.md`：WIP commit 的 `git add -A` 同 1.1 改写（切新分支与留在当前分支共用同一段文案，确认两处均生效）

## 2. 归档模板（C + D 回写）

- [ ] 2.1 `templates/skills/archive.md`：核对段"先确定目标 change"补一句——确定的 change 名在委托 `openspec-archive-change` 时作为参数传入，不让其二次推断或询问；文件开头委托说明同步（显式参数原样转发，未指定时传已确定的名字）
- [ ] 2.2 `templates/skills/archive.md`：在"回写审查未修项解决说明"段之后新增"回写审查未修项复审说明"段——读取归档后目录 `proposal.md` 的 `## 复审的审查未修项`；格式 `- 复审：<change-name>（归档于 <YYYY-MM-DD>，结论：成立|不成立）— <说明>`；结论仅 成立/不成立；目标须已有解决子项；只引用已归档快照；追加在现有子项之后、同 change 解决先于复审；按 change 名幂等、多次复审以最后一行为准；失败逐条跳过不阻断；随 `git add -- openspec/` 落库；不改写既有子项、无状态
- [ ] 2.3 `templates/skills/archive.md`：快照落库段注明复审说明与解决说明同属对更早快照的追加、不属于重建当前快照；"回写解决说明"段生命周期描述中"冻结后仅允许追加式解决说明"改为"仅允许追加式解决说明与复审说明"

## 3. propose 与 explore 模板（D）

- [ ] 3.1 `templates/skills/propose.md`：在"解决的审查未修项声明"段之后新增"复审的审查未修项声明（可选）"——固定标题 `## 复审的审查未修项`、列表项格式 `- <归档快照路径>#<节名>#<序号>（结论：成立|不成立）— <说明>`、与解决小节分开、结论来自用户明确判断、无复审时省略、propose 不改写历史快照
- [ ] 3.2 `templates/skills/explore.md`：计数口径改为——已标注解决不计复审说明；未复审 = 有"未复审"就地标注且无任何复审说明；复审未通过 = 最后一条复审结论为"不成立"；两者互斥、为 0 时省略括注；补示例 `3 条 Warning，其中 3 条已标注解决（1 条复审未通过）`；快照说明句补"复审说明由后续 change 归档时追加"

## 4. 主 spec Purpose 与文档（B + D）

- [ ] 4.1 直接修订 `openspec/specs/review-findings-snapshot/spec.md` 的 `## Purpose`，补"后续 change 可追加复审说明（成立/不成立）"叙述
- [ ] 4.2 `README.zh-CN.md`：命令表 `@lyx-explore` / `@lyx-review-plan` / `@lyx-review-code` 三行补快照相关描述（对齐 `README.md` 第 45、49、50 行）；架构段新增快照机制条目（对齐 `README.md` 第 74 行，含就地标注、复审说明、全量暂存排除）
- [ ] 4.3 `README.md` 第 74 行、`AGENTS.md` 快照段、`CLAUDE.md`「审查执行模型（速览）」快照条目：补复审说明（声明小节、归档回写、未复审 / 复审未通过计数）与全量暂存排除

## 5. 测试与验证

- [ ] 5.1 `src/utils/__tests__/host-adapters.test.ts`：新增断言——commit / propose 含 `:(exclude,glob)openspec/changes/*/review-findings.md`；archive 含复审说明格式与"传入已确定的 change 名"；propose 含 `## 复审的审查未修项`；explore 含"复审未通过"与新示例；确认既有断言（含 `其中 3 条已标注解决（3 条未复审）`）仍成立或按新口径调整
- [ ] 5.2 运行 `openspec validate review-findings-rereview-and-residual-fixes --strict` 与项目测试确认通过
- [ ] 5.3 归档前置提醒：在 `context.md` 与报告中注明本 change 归档前须先更新本机已安装 skills（重新 `init` / 菜单 update），使 `@lyx-archive` 识别 `## 复审的审查未修项`
