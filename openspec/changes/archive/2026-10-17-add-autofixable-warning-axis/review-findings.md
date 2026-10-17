# 审查未修项快照

## 方案审查

- 轮次：2（第 1 轮 Critical 2，认可并修复；第 2 轮复查 Critical 0，正常清零；执行者 main——`[回退] subagent 不可用: 当前宿主未提供 spawn_agent / send_input 工具`）
- 记录时间：2026-10-17T17:12:44+08:00
- 基线：propose 阶段 commit `d498ffe`
- 基线状态：清零后已执行统一提交 `273e21b`（Change-Stage: review-plan-fix）；本快照在其之后写入，保持未跟踪

1. [templates/CLAUDE.md:34] — 模板导航文档把 review-code 描述为"Critical/Warning/Info 分级"，未提及本 change 新增的「可自动修复」轴；该行在实现后仍成立（三级分级结构未变）但不完整，且 `templates/CLAUDE.md` 未列进本 change 的文档同步范围
   问题细节：`AGENTS.md` 的「改动对称清单」只要求"命令增删"时同步 `templates/CLAUDE.md` 的命令表与计数，本 change 不增删命令，因此该文件未被 tasks 5.1 覆盖；读者从模板导航看不到新轴的存在
   建议: 实施阶段（tasks 5.1）顺带核对 `templates/CLAUDE.md` 的 review 相关行，若保持现状则在报告中说明理由，若补一句"含可自动修复标注"则同步更新
   - 解决：本 change 内修复（commit 470e17b）— apply 提交为 templates/CLAUDE.md 的 review-code 行补上「可自动修复」标注说明

2. [README.md] — 本轮只按中文短语（`只收 Warning` / `Critical 清零`）grep 定位了 `README.zh-CN.md`、`CLAUDE.md` 的同步点，未逐条核对英文 `README.md` 是否有对应的英文描述需要同步
   问题细节：greps 未命中不等于英文侧没有等价表述（英文可能写作 "Critical-clear"、"warnings only" 等），而 tasks 5.1 只笼统写了"同步 README.md 与 README.zh-CN.md"
   建议: 实施阶段按语义而非字面检索核对英文 README 的审查循环描述，并在 tasks 5.1 的完成判据里写明核对方式
   - 解决：本 change 内修复（commit 470e17b）— apply 提交按语义核对英文 README，同步 normal clear 与 unresolved warnings only 表述

## 代码审查

- 轮次：1（Critical 0，正常清零；执行者 main——`[回退] subagent 不可用: 当前宿主未提供 spawn_agent / send_input 工具`）
- 记录时间：2026-10-17T17:20:00+08:00
- 基线：apply 阶段 commit `470e17b`（Change-Stage: apply / Change-Name: add-autofixable-warning-axis）
- 基线状态：循环无实际改动，未创建 review-code-fix commit；本快照保持未跟踪

1. [templates/skills/review-code.md / templates/skills/review-plan.md] — 新增的「自动修复条目的范围与降级（只消费首轮）」段落近乎逐字重复（5 条子弹，仅结尾的步骤号 `转步骤 4` / `转步骤 5` 不同），当前完全靠人工同步，没有任何断言守护
   问题细节：本轮实测 `diff` 该段除步骤号外完全一致；本仓库没有"共享片段"机制可承载它（`{{HOST_FRAGMENT:*}}` 只做宿主差异），一旦日后只改一侧，两份模板的降级规则就会静默分叉——而这条规则直接决定"清零是否算数"
   建议: 在 `host-adapters.test.ts` 增加一条断言：抽取两份模板的该段落、归一化步骤号后要求逐字相等；或后续抽成共享片段

2. [templates/CLAUDE.md:34] — 模板导航只给 review-code 行补了「（每条 Warning 附「可自动修复」标注）」，review-plan 行未同步提及；两行都描述同一个审查分级契约，读者会以为标注只适用于代码审查
   问题细节：review-plan 行本身没有"分级"字样，所以不构成事实性错误，但对称度不足；该文件也不在本 change 的文档同步清单里（命令增删才触发）
   建议: 在 review-plan 行补一句「Warning 附「可自动修复」标注」，或把标注说明提到表格上方的通用段落里
