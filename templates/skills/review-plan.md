---
name: lyx-review-plan
description: '在需要独立审查 OpenSpec change 的方案是否完整、可实施且风险可控时使用。'
argument-hint: '[<change-name>] [--no-commit]'
references:
  - references/review-contract.md
  - references/recovery-and-evidence.md
---

# Review Plan

> 调用方式：`@lyx-review-plan` mention 后跟随的自然语言即参数（如 `@lyx-review-plan` 带需求描述/选项）；无参数时直接 `@lyx-review-plan`。

执行本 skill 前，SHALL 完整读取：

- `references/review-contract.md`：审查对象定位、执行者选择、分级判据、Critical 裁决、修复循环、终止条件、快照和统一提交。
- `references/recovery-and-evidence.md`：run-state 恢复、审查轮次记录和新鲜验证证据。

本文件只负责入口和路由。不得只读 description 或主文件后就开始审查。
