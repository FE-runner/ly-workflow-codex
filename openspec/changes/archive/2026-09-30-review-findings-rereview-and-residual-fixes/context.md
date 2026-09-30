# context：review-findings-rereview-and-residual-fixes

## 来源

- 本 change 源于 `/lyx-explore` 中对 `in-change-review-findings-resolution` 5 条「本 change 内修复（未复审）」的复审：5 条修复均成立，同时发现残留 A/B/C（见 proposal Why）。A/B/C 不在任何快照中，故无 `## 解决的审查未修项` 锚点。
- 复审结论（5 条均"成立"）由用户在讨论中确认，已写入 proposal 的 `## 复审的审查未修项`。

## 关键决策（讨论中选定）

- 复审标记选"方案 1：加复审说明子项"。否决的备选：
  - 方案 2 仅改 explore 展示文案、把"未复审"解释为历史事实——否决：计数永远无法下降，提示价值随时间归零。
  - 方案 3 不记录复审结论——否决：复审成本白费，下次仍会被当作待复审。
- A/B/C 与复审机制合成一个 change（用户指定）。
- 声明小节独立（`## 复审的审查未修项`），不与解决小节混用；允许"不成立"，explore 单独显示"复审未通过"，不引入状态字段（见 design D2/D4）。
- A 选择在 `commit.md` / `propose.md` 源头排除快照，而非仅靠 review 模板的纪律性约束（原代码审查 W2 的方案 B）。

## 范围边界

- 做：commit/propose 全量暂存排除；README.zh-CN 快照机制补齐；archive 传名；复审说明（propose 声明 + archive 回写 + explore 计数）；四份文档同步；测试断言。
- 不做：active 快照复审说明；修正 `worktree-create-before-propose` 中过时的 WIP 示例文本；自动 `git rm --cached` 已被跟踪的快照。

## 已知坑

- **归档前必须先更新本机已安装 skills**（重新 `init` / 菜单 update）：本机 `~/.claude/skills/lyx-archive` 与 `~/.agents/skills/lyx-archive` 仍是旧版，不识别 `## 复审的审查未修项`，直接归档会让 5 条复审说明不写入。
- pathspec 写法固定为 `git add -A -- ':/' ':(top,exclude,glob)openspec/changes/*/review-findings.md'`：必须带 `glob`（否则 `*` 跨 `/`，会误排除 `archive/` 下已跟踪快照）且以顶层锚定（`':/'` + `top`；写成 `.` 时在子目录执行只暂存当前子目录，属行为回退）。
- explore 模板的既有示例 `其中 3 条已标注解决（3 条未复审）` 被测试断言引用，调整示例时保留或同步改断言。
- 复审说明追加位置在该 Warning 现有全部子项之后（部分条目有两行解决说明，如方案审查 #2）。

## 实施决策（apply 阶段追加）

- explore 模板顺带明确括注组合格式：某项为 0 省略该项、两项都为 0 省略整个括注、都非 0 合并为 `（X 条未复审，Y 条复审未通过）`——对应 review-plan 快照 `#方案审查#1` 的 Warning，与 spec "两者均为 0 时省略对应括注"不冲突；delta spec 未改（留待 review-code / 后续复审判断是否需要补 Scenario）。
- archive 复审段放在"回写解决说明"之后、"提交归档改动"之前，与解决说明共用归档后 `proposal.md`；文件开头委托说明同步改为"显式参数原样转发、未指定时传入核对段确定的名字"。
- 测试断言额外锁定 `not.toContain('git add -A &&')`，防止 WIP 命令回退为无排除的全量暂存。
