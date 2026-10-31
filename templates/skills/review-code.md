---
name: lyx-review-code
description: '在需要独立审查一个已完成实施 commit 的代码变更时使用。'
argument-hint: '[<change-name>] [--no-commit]'
references:
  - references/review-contract.md
  - references/recovery-and-evidence.md
---

# Review Code

> 调用方式：`@lyx-review-code` mention 后跟随的自然语言即参数（如 `@lyx-review-code` 带需求描述/选项）；无参数时直接 `@lyx-review-code`。

执行本 skill 前，SHALL 完整读取：

- `references/review-contract.md`：审查范围、执行者选择、分级判据、Critical 裁决、修复循环、终止条件、快照和统一提交。
- `references/recovery-and-evidence.md`：run-state 恢复、审查轮次记录和新鲜验证证据。

本文件只负责入口和路由。不得只读 description 或主文件后就开始审查。
