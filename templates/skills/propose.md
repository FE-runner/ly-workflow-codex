---
name: lyx-propose
description: '在需要创建 OpenSpec change、整理方案并编排后续审查与实施时使用。'
argument-hint: '<需求描述>'
references:
  - references/propose-contract.md
  - references/recovery-and-evidence.md
---

# Propose

> 调用方式：`@lyx-propose` mention 后跟随的自然语言即参数（如 `@lyx-propose` 带需求描述/选项）；无参数时直接 `@lyx-propose`。

执行本 skill 前，SHALL 完整读取：

- `references/propose-contract.md`：隔离询问、自动/手动选择、artifact 生成、change 名确认、方案自审、context/run-state、提交和流水线。
- `references/recovery-and-evidence.md`：运行账本、机械裁决和新鲜验证证据规则。

本文件只负责入口和路由。除上述 references 明确规定外，不得根据 frontmatter description 自行简化流程。
