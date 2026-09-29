---
name: lyx-explore
description: '进入探索模式，想清楚再动手；讨论收敛到落地方案时引导走 @lyx-propose'
argument-hint: '[<想探索的问题或想法>]'
---

# Explore - 探索模式

> 调用方式：`@lyx-explore` mention 后跟随的自然语言即参数（如 `@lyx-explore` 带需求描述/选项）；无参数时直接 `@lyx-explore`。

## 进入前：审查未修项快照询问（SHALL）

在委托 `@openspec-explore` **之前**，先扫描 active 与 archive 两个位置的快照：

```bash
ls openspec/changes/*/review-findings.md 2>/dev/null
ls openspec/changes/archive/*/review-findings.md 2>/dev/null
```

- **无命中** → 不发出询问，直接进入下面的探索流程。
- **有命中** → SHALL **先询问**用户是否列出（SHALL NOT 直接列出），例如："检测到 N 个 change 留有审查未修项快照（review-findings.md），要列出吗？(y/n)"。
  - 用户同意 → 按 change 分组展示：change 名 + `## 方案审查` / `## 代码审查` 各自的 Warning 计数 + 其中已标注解决的条数（按 Warning 编号条目统计：该条目下至少有一条解决说明子项则计 1；同一 Warning 有多条解决说明时仍只计 1，SHALL NOT 按 `- 解决：` 行数累加）+ 一行摘要；active 的标注"进行中"，archive 的标注归档日期。用户要细节时再展开原文。
  - 用户拒绝 → 不展示任何快照内容，直接进入探索流程。
- 个别快照读取失败时 SHALL 跳过该条并如实注明，SHALL NOT 中断扫描或虚构内容。
- 该询问与列出 SHALL NOT 改变 `$ARGUMENTS` 的原样转发，也不接管 artifact 创建。

快照的格式与生命周期见 `review-findings-snapshot` 能力；它是快照式留痕（`@lyx-explore` 对快照只读展示；供回看某次审查提出过哪些未处理的 Warning），不是待办台账——解决说明由 `@lyx-archive` 在归档时追加。

按 `@openspec-explore skill`（opsx explore 编排 prompt）定义的流程进入探索模式：作为思考伙伴，围绕 `参数` 讨论、调研代码库、澄清需求，保持纯讨论态，不直接创建 change artifact。

opsx:explore 原生支持在讨论中直接创建 proposal/design/spec，但这样会跳过 `@lyx-propose` 的编排（隔离方式询问、全自动/手动询问、commit、review-plan 审查循环、worktree 询问）。当讨论收敛到"要落地方案"这一步时，不要直接创建 artifact，改为提示用户：

```
讨论已收敛，建议用 @lyx-propose 落地方案（走完整的审查+commit 流程）
```

由用户决定是否切换到 `@lyx-propose`。
