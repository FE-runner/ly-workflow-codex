---
name: lyx-explore
description: '进入探索模式，想清楚再动手；讨论收敛到落地方案时引导走 @lyx-propose'
argument-hint: '[<想探索的问题或想法>]'
---

# Explore - 探索模式

> 调用方式：`@lyx-explore` mention 后跟随的自然语言即参数（如 `@lyx-explore` 带需求描述/选项）；无参数时直接 `@lyx-explore`。

按 `@openspec-explore skill`（opsx explore 编排 prompt）定义的流程进入探索模式：作为思考伙伴，围绕 `参数` 讨论、调研代码库、澄清需求，保持纯讨论态，不直接创建 change artifact。

opsx:explore 原生支持在讨论中直接创建 proposal/design/spec，但这样会跳过 `@lyx-propose` 的编排（隔离方式询问、全自动/手动询问、commit、review-plan 审查循环、worktree 询问）。当讨论收敛到"要落地方案"这一步时，不要直接创建 artifact，改为提示用户：

```
讨论已收敛，建议用 @lyx-propose 落地方案（走完整的审查+commit 流程）
```

由用户决定是否切换到 `@lyx-propose`。
