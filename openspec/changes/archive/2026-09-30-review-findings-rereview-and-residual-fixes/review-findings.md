# 审查未修项快照

## 方案审查

- 轮次：2（第 1 轮 Critical 1，认可修复；第 2 轮复查 Critical 0，正常清零；执行者 main）
- 记录时间：2026-09-30T14:10:00+0800
- 基线：propose 阶段 commit `4a229d7cf690a1ab9054524e678b74fa0c17dec8`
- 基线状态：清零后已执行统一提交 `abc7b15`（Change-Stage: review-plan-fix）；本快照在其之后写入，保持未跟踪

1. [specs/review-findings-snapshot/spec.md:MODIFIED「@lyx-explore 先询问后列出快照」；tasks.md:3.2] — "未复审"与"复审未通过"两项括注的组合格式没有定义：spec 只写了"两者均为 0 时 SHALL 省略对应括注"，没有说明两项都非 0 时怎么合并展示（如 `（1 条未复审，1 条复审未通过）`），也没说明"对应括注"是指逐项省略还是整体省略。实施时 explore 模板和测试断言可能各写各的。
   建议: 在 spec 与 tasks 3.2 写明：各项为 0 时省略该项，两项都为 0 时省略整个括注，都非 0 时按 `（X 条未复审，Y 条复审未通过）` 合并，并补一个两项都非 0 的 Scenario。

## 代码审查

- 轮次：1（Critical 0，正常清零；执行者 main）
- 记录时间：2026-09-30T15:05:00+0800
- 基线：apply 阶段 commit `fe8d10e6eb8dea0cb3df06a107d289d339202514`
- 基线状态：循环无实际改动，未创建 review-code-fix commit；本快照保持未跟踪

1. [templates/skills/propose.md:55、templates/skills/propose.md:62、templates/skills/commit.md:49] — 工作区里唯一的改动是**另一个进行中 change 的未跟踪快照**时，排除规则会让全量暂存什么都不暂存：propose 的脏改动检查（`git status --porcelain` 非空）仍会弹出三选一，用户选 WIP commit 后 `git add -A -- ':/' ':(top,exclude,glob)…' && git commit` 以"nothing added to commit"失败（临时仓库实测 exit=1），按"处置动作失败 → 如实报错停止编排"直接中断 propose；`@lyx-commit --all` 同理，暂存后暂存区仍为空，但阶段 2 之后没有"仍为空"的分支，会一路走到 `git commit` 才失败。改动前这两处会把快照错误地提交进去但能成功，改动后变成硬失败。
   建议: propose 的脏改动检查排除 `openspec/changes/*/review-findings.md` 未跟踪项（排除后为空则视为干净、不询问）；WIP 与 `--all` 在排除后暂存区仍为空时如实说明"仅有进行中快照改动，已跳过提交"并继续，而不是报错中断。
   - 解决：本 change 内修复（未复审，commit ac8ce44）— 脏改动检测忽略进行中快照，WIP / commit --all 排除后为空时跳过提交并说明，不再硬失败
