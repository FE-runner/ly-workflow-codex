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

**范围简化审查镜头（SHALL）**：开始审查前 SHALL 读取并遵循 `{{HOST_SKILLS_DIR}}/lyx-ponytail/SKILL.md`，重点识别方案中的无依据扩权、投机抽象、可删除配置或用户未要求的扩展；只有会改变交付范围、实施方式或验收结论的问题才按既有 Critical/Warning/Info 判级，不得为“看起来更简”强制要求重构。

## 全自动执行不变量（最高优先级）

- `run-state.md` frontmatter 的 `lyx.executionMode` 为 `full-auto` 时，正常清零报告是中间状态，不是流水线最终回复。
- 正常清零且无待用户决策、失败或终止条件时，SHALL 以当前 skill 目录为锚点，读取同级 `lyx-apply/SKILL.md` 及其 frontmatter 声明的全部 references，再在同一回合继续 apply 前置校验与 apply，SHALL NOT 等待用户再次触发。
- 只输出 `@lyx-apply <change-name>` 或说明“下一步应执行 apply”SHALL NOT 视为已交接；无法定位同级 bundle 时停止并报告。
- 准备结束全自动回合前 SHALL 核对 run-state frontmatter 的 `lyx.pipelineStage` 与 `lyx.nextSafeAction`；仅正常终态或明确人工介入条件允许结束。

除上述 references 与全自动执行不变量外，本文件只负责入口和路由。不得只读 description 或主文件后就开始审查。
