---
name: lyx-explore
description: '进入探索模式，想清楚再动手；讨论收敛到落地方案时按规模引导走 @lyx-fix（小改动）或 @lyx-propose'
argument-hint: '[<想探索的问题或想法>]'
---

# Explore - 探索模式

> 调用方式：`@lyx-explore` mention 后跟随的自然语言即参数（如 `@lyx-explore` 带需求描述/选项）；无参数时直接 `@lyx-explore`。

## 进入前：审查未修项快照询问（SHALL）

在委托 `@openspec-explore` **之前**，先扫描 active 与 archive 两个位置的快照：

```bash
find openspec/changes -maxdepth 2 -name review-findings.md 2>/dev/null
find openspec/changes/archive/ -maxdepth 2 -name review-findings.md 2>/dev/null
```

命中后 SHALL 读取每份快照，判定每条 Warning 是否已解决：Warning 顶层编号条目下存在至少一条 `- 解决：` 子项（跨 change 解决说明或本 change 内就地标注均可）即为**已解决**，否则为**未解决**。本命令只展示未解决条目——已解决条目 SHALL NOT 展示、SHALL NOT 计数，也 SHALL NOT 提供展开已隐藏条目的入口。

- **无命中，或所有可读快照都没有未解决条目** → 不发出询问，直接进入下面的探索流程（此时若有快照读取失败，仍如实注明，SHALL NOT 静默）。
- **存在含未解决条目的 change** → SHALL **先询问**用户是否列出（SHALL NOT 直接列出），例如："检测到 N 个 change 留有未解决的审查 Warning（review-findings.md），要列出吗？(y/n)"——N 只计含未解决条目的 change。
  - 用户同意 → 按 change 分组展示：change 名 + 各节未解决 Warning 条数（如 `代码审查 2 条未解决 Warning`；某节没有未解决条目时不展示该节；全部已解决的 change 不出现）+ 一行摘要；active 的标注"进行中"，archive 的标注归档日期。用户要细节时再展开未解决条目的原文。
  - 用户拒绝 → 不展示任何快照内容，直接进入探索流程。
- 个别快照读取失败时 SHALL 跳过该条并如实注明，SHALL NOT 中断扫描或虚构内容。
- 该询问与列出 SHALL NOT 改变 `$ARGUMENTS` 的原样转发，也不接管 artifact 创建。

快照的格式与生命周期见 `review-findings-snapshot` 能力；它是快照式留痕（`@lyx-explore` 对快照只读展示；供回看某次审查提出过哪些未处理的 Warning），不是待办台账——解决说明由 `@lyx-archive` 在归档时追加（跨 change 声明回写，或归档前核对的本 change 内就地标注）；审查后同会话修复也会追加本 change 内就地标注。

按 `@openspec-explore skill`（opsx explore 编排 prompt）定义的流程进入探索模式：作为思考伙伴，围绕 `参数` 讨论、调研代码库、澄清需求，保持纯讨论态，不直接创建 change artifact。

opsx:explore 原生支持在讨论中直接创建 proposal/design/spec，但这样会跳过 `@lyx-propose` 的编排（隔离方式询问、全自动/手动询问、commit、review-plan 审查循环、worktree 询问）。当讨论收敛到"要落地方案"这一步时，不要直接创建 artifact，改为按规模提示用户：

- 小改动（真 bug：代码对齐既有 spec；或只改变 / 新增少量 Scenario 级行为，即 `@lyx-fix` 的分流 A / B 范围）：

  ```
  讨论已收敛，这是小改动，建议用 @lyx-fix 落地（spec 分流 + 自审 + 单 commit）
  ```

- 其余（新增 capability、多条 Requirement、跨模块设计取舍、需要产品决策等）：

  ```
  讨论已收敛，建议用 @lyx-propose 落地方案（走完整的审查+commit 流程）
  ```

提示只给建议，不自动切换命令、不创建 artifact，由用户决定是否切换。
