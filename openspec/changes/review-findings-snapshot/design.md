## Context

审查关卡的分级模型固定为 Critical/Warning/Info：只有 Critical 驱动修复循环、参与终止判定与统一提交；Warning/Info 是过程信号，只在当轮与最终报告的"最后一轮结果"里出现，载体是对话输出。`context.md`（见 `review-context-artifact`）已经确立了"change 目录内非 artifact 文件 + 审查范围排除"的先例，但它承担的是子代理软上下文通道，有 ≤100 行体积约束、且每轮 spawn 必读，不适合承载只供事后回看的审查发现。

提交流程的关键事实（已核对模板）：`@lyx-review-plan`、`@lyx-apply`、`@lyx-review-code` 的 commit 均使用**显式文件清单**（不做范围外 `git add`），只有 `@lyx-archive` 用 `git add -- openspec/` 兜底扫全目录。这个差异决定了快照可以"审查阶段留未跟踪草稿、归档时随该命令落库"，而不会被中间提交提前吞掉。

参见 `proposal.md` — Why、以及 delta spec `review-findings-snapshot` 的行为契约。

## Goals / Non-Goals

**Goals:**

- 让"某次审查提出过哪些未处理的 Warning"可持久回看，且不引入跟踪/关闭职责。
- 复用既有 change 目录与归档通道，不新增命令、不改动 `src/` 运行时代码。
- 快照不干扰审查循环、不进入任何中间 commit、不成为新的审查对象。

**Non-Goals:**

- 不记录 Info（噪声控制）、不记录未被修复的 Critical（非正常终止场景由用户手动解决，见 proposal 非目标）。
- 不引入 open/closed 状态、不做"关闭"收尾动作（区别于台账式 backlog）。
- 不在归档瞬间重新校验 Warning 是否已被手工修复。
- 不改变"只有 Critical 驱动修复循环"的既有分级语义。

## Decisions

**D1：快照承载在 change 目录内（`openspec/changes/<change-name>/review-findings.md`），而非全局 backlog 或追加进 `context.md`。**
替代方案：全局台账（`openspec/review-backlog.md`）需要维护关闭动作、会长成坟场，且与"快照式"意图不符；追加进 `context.md` 会污染软上下文通道并突破其 ≤100 行约束。change 目录方案让快照随归档自动搬入 `archive/`，无需额外搬运逻辑。

**D2：单文件两节（`## 方案审查` / `## 代码审查`），而非两个文件。**
归档后一个 change 只多一个文件，explore 的扫描与展示也只需一个 glob。两节的来源命令互不重叠（review-plan 写方案节、review-code 写代码节），节级 upsert 即可，无合并冲突。

**D3：写入时机 = 循环结束；正常清零场景在统一 commit 之后写入。**
放在 commit 之后可让"快照是否该进本次提交"这个问题根本不存在——写完就是未跟踪文件；同时覆盖异常终止场景（无 commit，照写）。替代方案"循环中逐轮写入"被否：只有最后一轮才是要留存的结论，逐轮写入会放大噪声并让文件语义模糊。

**D4：快照保持未跟踪，直到 `@lyx-archive` 的 `git add -- openspec/` 将其纳入归档 commit。**
这是"归档时落库"最省事的实现——无需在 archive 命令里新增生成步骤，也无需在审查时提交。替代方案"审查时直接提交"会与"归档时才固化"的意图错位，且把快照带进下一次审查范围；替代方案"搭 review-code commit 正文的车"在零 Critical 时无 commit 可用，恰好丢失最需要留痕的场景。

**D5：审查命令的未跟踪清单显式排除 `review-findings.md`。**
与 `context.md` 同待遇。若只做 D4 不做 D5，上一轮遗留的未跟踪快照会在下一次 review 的 `??` 清单里被当成审查对象，并可能被 review 循环的统一 commit 吞掉。该排除规则只落在 `ly-review-gates` 中已承担 `context.md` 同类排除的共享 Requirement（「审查关卡以单审查 subagent（非 fork）执行」）——它显式覆盖"两个命令共同遵守"，可避免在 `方案审查分级输出发现` 与 `代码审查读取 git diff 并分级输出发现` 两条各自定义一次范围里重复同一规则。

**D6：`@lyx-explore` 先询问、后列出，且发生在委托 `opsx:explore` 之前。**
替代方案"进 explore 就自动列出"会打断用户带着具体话题进入的场景；"只在用户主动问时才列"又不够可发现。先问后列是折中，且不改写 `$ARGUMENTS` 原样转发。

## Risks / Trade-offs

- [快照在"审查结束 → 归档前"是工作区未跟踪文件，用户不归档则不会进 git 历史] → 接受：快照式语义下，未归档的 change 本就未固化为历史；若日后归档则自动落库。
- [遗留的未跟踪快照可能触发 `@lyx-propose` 的脏工作区处置询问（切分支前 `git status --porcelain` 非空）] → 接受：属既有的通用脏工作区提示行为，不为此改动 propose。
- [Warning 在归档前已被手工修掉，快照仍列出] → 接受并写明：快照记录的是"审查当时的结论"，不是"归档瞬间的代码状态"；文件头部说明其非跟踪性质即可。
- [审查 subagent 把真问题误判为 Warning，快照只把它记下来而不处理] → 本变更不解决分级误判（那是另一个漏口），只保证"记录不丢失"。
- [Warning 数量多导致文件较长] → 不加体积上限：该文件被排除在审查范围外，不是每次 spawn 的固定读取成本，篇幅不构成成本问题。

## Migration Plan

- 模板层改动（`review-plan.md` / `review-code.md` / `archive.md` / `explore.md`）随包升级落到 `~/.agents/skills/lyx-*/`；已安装环境经 `lycx init --force` 或 `npx ly-workflow-codex update` 刷新。
- 无数据迁移；历史 change 目录没有 `review-findings.md` 属正常，`@lyx-explore` 扫描无命中即不问。
- 回滚策略：删除模板中的快照写入与 explore 询问段落即可；已归档快照为普通文件，无需清理。
