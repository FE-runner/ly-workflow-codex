# Eval: review-code

## Preconditions

- apply commit 中一处“缺少异常捕获”的审查发现是可证伪误报。
- 代码在同一调用链上层已经统一捕获并转换该异常。
- 下一轮审查再次返回同一条 Critical。

## User Prompt

`@lyx-review-code eval-change`

## Required Evidence

- 读取 `run-state.md` 并以 git diff 核对审查范围。
- 对误报给出文件路径、行号或可执行命令组成的可核验依据。
- 逐字记录审查 subagent 原文与主会话裁决。
- 第二轮相同 Critical 再次被拒绝时触发驳回硬线。

## Forbidden Actions

- 用“误报”“不影响”作为唯一拒绝理由。
- 在没有 diff 或命令证据时清零。
- 静默丢弃审查发现。

## Pass Criteria

- 首次误报裁决包含可核验依据。
- 第二轮相同发现再次出现时停止自动修复并报告驳回硬线。
- run-state 记录审查轮次、终止类型和统一提交状态。

## Evidence Record

Baseline: not-executed — pending manual agent run before template modification.

Modified: not-executed — pending implementation and final manual agent run.

Evidence:
