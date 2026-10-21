# 审查未修项快照

## 方案审查

- 轮次：2（第 1 轮 Critical 0、Warning 2；第 2 轮复查 Critical 0，正常清零；执行者 main——`[回退] subagent 不可用`）
- 记录时间：2026-10-21T13:00:00+08:00
- 基线：propose 阶段 commit `e4bfe28`
- 基线状态：清零后已执行统一提交 `8b8dc1c`（Change-Stage: review-plan-fix）；本快照在其之后写入，保持未跟踪

1. [openspec/specs/worktree-create-before-propose/spec.md:22,69] — 既有正文与 Scenario 仍写旧 WIP 文案 `wip: 切分支前暂存工作区改动`，与新模板的 `chore(wip): ...` 不一致；本 change 的 ADDED Requirement 已声明对其为权威，但旧文本未删
   问题细节：同一 spec 内出现两套文案，读者可能照旧文案执行；清理它需要 MODIFIED 整块替换，超出本 change 的最小改动面
   建议: 下次触碰该 Requirement 时用 MODIFIED 整块替换，删除旧文案与旧命令

2. [openspec/specs/worktree-create-before-propose/spec.md:22] — 既有 WIP 命令写 `git add -A && git commit -m ...`，而模板实际使用带快照排除的 pathspec 暂存；这是本 change 之前就存在的漂移
   问题细节：`git add -A` 会把进行中快照带进提交，与模板的排除规则相反；本 change 未扩大范围去改它
   建议: 后续以 MODIFIED 方式把 spec 的命令同步为模板的 pathspec 版本

## 代码审查

- 轮次：1（Critical 0，正常清零；执行者 main——`[回退] subagent 不可用`）
- 记录时间：2026-10-21T13:10:00+08:00
- 基线：apply 阶段 commit `b821c9d`（Change-Stage: apply / Change-Name: fix-workflow-issues-2026-10）
- 基线状态：循环无实际改动，未创建 review-code-fix commit；本快照保持未跟踪

1. [src/utils/preflight.ts] — `isWithinProject` 把"项目顶层之下的任意子目录"也判为 healthy；若项目内存在嵌套 OpenSpec root，预检结论与 `openspec` 在项目顶层执行时的 nearest root 解析可能不一致
   问题细节：当前 issue 2 的目标是拦住家目录兜底 root，本实现已覆盖；嵌套 root 是另一个边界，未在本 change 定义口径
   建议: 后续明确"root 必须等于项目顶层"或补一条嵌套 root 的 Scenario 与测试
