---
name: lyx-propose
description: '按 opsx:propose 编排流程生成方案；创建方案前先问隔离方式（worktree / 本项目切新分支 / 留在当前分支）与全自动/手动（各只一次）；产物生成后 commit 前执行方案自审（闭环+全面性），自审修复随 propose 阶段 commit（CC 前缀 + Change-Stage: propose trailer）一次落库；全自动 = 自动流水线到审完代码，手动 = 逐步确认'
argument-hint: '<需求描述>'
---

# Propose

> 调用方式：`@lyx-propose` mention 后跟随的自然语言即参数（如 `@lyx-propose` 带需求描述/选项）；无参数时直接 `@lyx-propose`。

收尾编排入口。创建方案前先问两件事（各只一次）：本次开发的隔离方式（隔离 worktree / 本项目切新分支 / 留在当前分支，不在 worktree 内才问）、本次走全自动还是手动。产物生成后、commit 前由方案提出者执行一次方案自审（逻辑闭环 + 业务全面性，见步骤 5）与 context.md 软上下文产出（见步骤 5.5），自审修复与 context.md 随 propose 阶段 commit（message 带 `Change-Stage: propose` 与 `Change-Name` trailer）一次干净落库；全自动路径在同一会话内自动跑 review-plan → apply → review-code 直到审完代码，手动路径逐步确认。

## 步骤

### 1. 是否已在 worktree 内 + 隔离方式询问（创建方案前，全局只问一次）

先检测当前是否已处于某个 worktree 内：比较 `git rev-parse --git-dir` 与 `--git-common-dir`（路径先 realpath 归一化再比较），并排除子模块误判（`git rev-parse --show-superproject-working-tree`）。

- **已在 worktree 内** → 跳过隔离方式询问，直接进入步骤 2。
- **不在任何 worktree 内** → 直接向用户提问一次（三选一；已在某个开发分支上时照常询问，不因当前分支非默认分支而跳过）：

  ```
  "本次开发的隔离方式？"
    ○ 隔离 worktree（从当前分支切出，目录 ~/.ly/worktrees/<项目名>/<开发分支名>，目录+分支双隔离）
    ○ 本项目切新分支（留在当前目录，git checkout -b <开发分支名>，仅分支隔离，零环境成本）
    ○ 留在当前分支（不隔离，propose/apply 提交直接落在当前分支上）
  ```

  - **隔离 worktree**：
    1. 先检查当前工作区未提交改动（`git status --porcelain`）：存在未提交草稿时提示"当前工作区的未提交改动将留在原 worktree、不会带入新 worktree"，待用户确认后再切换。
    2. 询问/确认本次开发的开发分支名 `<开发分支名>`（可含 `/`，如 `feature/xxx`）。
    3. 执行（从**当前分支 HEAD** 切出，不是默认分支、不做分支拓扑校验）：
       ```
       git worktree add -b <开发分支名> ~/.ly/worktrees/<项目名>/<开发分支名> <当前分支HEAD>
       ```
       （`<项目名>` 以 `git rev-parse --git-common-dir` 反推主仓库目录名；多级分支名按 `/` 展开路径，仍保持无来源前缀的单层语义。）
    4. 自动复制环境文件（`.env` 等，复用 `@lyx-worktree add` 规则），跑一次项目 baseline 验证。
    5. **baseline 失败** → 报告失败摘要并询问用户"仍继续 / 放弃"：**仍继续** → 同会话 cd 进 worktree 继续编排（失败摘要作为已知风险带入后续流程，按本步 6/7 执行）；**放弃** → 保留已创建的 worktree 与分支（不自动清理，需要时用 `@lyx-worktree remove` 显式删除），打印携带失败摘要的兜底续接命令（同 6 的格式），会话结束，change 尚未生成。
    6. 打印**兜底续接命令**（绝对路径 + shell 安全转义）——正常路径不使用，仅当本会话意外死亡（崩溃、终端关闭等）时，用于在新 worktree 中恢复：
       ```
       cd ~/.ly/worktrees/<项目名>/<开发分支名> && codex "继续 在隔离 worktree 中 @lyx-propose <同一需求>"
       ```
    7. **同一会话续跑（不结束会话）**——当前会话直接 `cd` 进新 worktree 并继续本编排（worktree 先于 change 创建的时序不变，change 尚未生成）：
       1. 以绝对路径 `cd "$HOME/.ly/worktrees/<项目名>/<开发分支名>"` 切换工作目录。
       2. **立即校验**当前工作目录确为该 worktree：`pwd` 与 worktree 绝对路径比对，或 `git rev-parse --show-toplevel` 归一化后等于该 worktree 绝对路径（SHALL NOT 仅以 `git rev-parse --git-dir` 成功作为判据——它在任意 git 仓库内都会成功，无法证明位于该 worktree）。**cd 失败或校验不通过 → 停止编排、报告原因，不执行后续任何 git/openspec/文件操作（不静默失败后继续）**。
       3. 校验通过后提示"已进入隔离 worktree `<路径>`，本会话继续"，继续步骤 2。
       4. **cwd 纪律**：自校验通过之时起，本次编排所有 Git 操作、openspec 命令与文件读写以 worktree 为工作目录（文件操作用 worktree 绝对路径），不回到主仓库路径执行本次 change 的任何产物操作。
       5. worktree 目录/分支锁定为 `<开发分支名>`，后续不因 change 名不同而对 worktree/分支重命名。
  - **本项目切新分支**：
    1. 询问/确认开发分支名 `<开发分支名>`（规则与 worktree 路径一致：可含 `/`，如 `feature/xxx`）。
    2. 检查当前工作区未提交改动（`git status --porcelain`）：非空时用一次三选一询问处置方式，各选项文案如实说明后果：
       - **提交（WIP commit）**：用 `MSG_FILE="$(git rev-parse --git-path COMMIT_EDITMSG)"` 获取 message 文件路径并写入完整 message（首行 `chore(wip): 切分支前暂存工作区改动`，正文按 `@lyx-commit` 规范写动机/改动/影响），执行 `git add -A && git commit -F "$MSG_FILE"` 后再切分支——新分支从含 WIP commit 的 HEAD 切出，改动固化为新分支上的提交，review-code 审查对象不受污染；
       - **Stash**：`git stash push -u` → 切分支 → `git stash pop`——如实说明"pop 回来后改动仍在工作区，stash 仅提供日志留底"；
       - **原样保留**：不做任何处理——明示"改动会进入 review-code 审查范围（`git diff HEAD`），可能污染审查对象"；且若这些改动与后续 apply 的实施目标文件重叠，apply 会直接停止转人工（停止报告会回指此处处置选择）。

       三种选择均直接执行（风险已写入文案，不二次确认）；处置动作失败（提交失败、stash 失败等）→ **如实报错停止编排，不自动兜底**。
    3. 执行 `git checkout -b <开发分支名>`（从当前 HEAD 建新分支并切换）。本路径**不运行 baseline 验证**（同一工作目录、同一 env、同一 node_modules，baseline 验证的"全新 worktree 可用性"前提不成立）、**不切换会话工作目录**、**不打印兜底续接命令**（无目录切换即无会话断链风险）。分支名已存在或非法导致 `git checkout -b` 失败时，**如实报错停止编排转人工**（不自动改名、不自动 stash），change 尚未生成。
    4. 进入步骤 2，后续编排（opsx:propose → 自审 → commit → 流水线）在当前工作目录原位继续。
  - **留在当前分支**：不创建 worktree、不切换分支，直接进入步骤 2。若 `git status --porcelain` 非空，触发与"本项目切新分支"相同的脏改动三选一处置询问（其中 Stash 选项因无切换动作**不自动 pop**——改动收进 stash 由用户日后 `git stash pop` 自取，执行时如实说明；WIP commit 选项将改动提交到当前分支，message 沿用同一文案）。

### 2. 询问全自动/手动（创建方案前，全局只问一次）

直接向用户提问：

```
"本次收尾走全自动（自动审查 + 自动实施 + 审完代码才停，非清零即停），还是手动逐步确认（每一步都问）？"
```

这是唯一决定"自动/手动"路径的开关询问。自动化程度与隔离正交：选全自动不隐含必须切 worktree，切了 worktree 也不隐含必须全自动。后续步骤不再重复问"要不要继续自动"。本轮若已在 worktree 内（跳过步骤 1 的询问），此询问照常进行。

### 3. 按 opsx:propose 编排流程生成方案

读取 `@openspec-propose skill`（opsx propose 编排 prompt）并按其定义的完整流程，围绕 `参数`（需求描述）生成 proposal/design/tasks 全部 artifacts。生成过程中遵循该编排 prompt 的全部步骤与约束（本命令的步骤 4-9 在其后继续编排）。

### 4. 确定真实 change 名（前后快照比对）

调用前记录一次 `openspec list --json` 的候选 change 名集合（快照 A，若步骤 3 之前尚未记录则在生成前先记录）；生成完成后再查询一次（快照 B）。取快照 B 相对快照 A 新增的那一条作为本次实际生成的 change 名。**不依赖 `参数`、不单纯依赖全局 `lastModified` 最新一条**——opsx:propose 会把用户输入的原始描述转成 kebab-case slug，两者不保证一致。若新增条目不唯一，或没有新增条目，**不猜测**，直接询问用户本次生成的 change 名，待确认后再继续。

### 5. 方案自审（commit 前，由方案提出者执行）

在确定真实 change 名（步骤 4）之后、暂存并 commit（步骤 6）之前，由当前会话（方案提出者）对该 change 的全部 artifacts（`proposal.md`/`design.md`/`tasks.md`/全部 delta spec）执行一次**方案自审**。提出者刚完成方案生成、上下文最全，负责查"逻辑闭环"与"业务全面性"这两类依赖上下文的问题；独立视角的"一致性 + 风险"仍归 `@lyx-review-plan` 的外部审查（职责分工，不重复）。

**四项检查（逐项执行，粒度按条目对齐，不做段落级语义对齐）：**

1. **正向闭环**：proposal 的每条 What Change 条目 SHALL 能对应到 design 的决策与 tasks 的任务（粒度：What Change 列表项 ↔ tasks checkbox 逐条映射）。design.md 缺失时容错跳过该段（What Change 直接对接 tasks），缺失本身不作为问题处理。
2. **反向闭环**：tasks 的每个任务 SHALL 能溯源到至少一条 What Change 条目；不可溯源的孤儿任务属于拆解时私自扩的范围，SHALL 处理（删除或补全对应的 What Change/设计依据）。
3. **基线波及**：对 proposal 声明的每个 Modified Capability，SHALL 逐条对照 `openspec/specs/<capability>/spec.md` 的现有 Requirements 检查本次改动是否波及（粒度：基线 Requirement 逐条）；被波及但方案只字未提的即为遗漏，SHALL 处理。New Capabilities 无基线可查，跳过该项。
4. **通用业务维度过网**：权限、失败路径、并发、兼容/迁移等通用业务维度 SHALL 逐项过一遍（按维度逐项给结论）；判定"不适用"的维度 MUST 写明理由，SHALL NOT 静默跳过。

**发现问题分两类处理：**

- **机械断链**（漏任务、范围未同步、design 决策缺失等可直接修复的缺陷）：由提出者直接修改对应 artifact，SHALL NOT 就此类问题询问用户。
- **业务判断类**（"这个场景要不要支持"等需要用户决策的开放问题）：SHALL 列为开放问题直接向用户提问，SHALL NOT 由提出者自行猜测决定。**全自动模式下同样询问**——该询问是自动流水线的人工确认点，与"需要人工介入"同级；用户回答后按回答更新对应 artifact 再继续。用户拒绝/取消回答 → 停止后续编排（不 commit、全自动流水线不启动），artifacts 留在工作区，报告结论清单与未决问题，转人工处理。

**逐项结论清单（硬约束，防走过场）：**

自审 MUST 产出可见的**逐项结论清单**，对四项检查的每一子项（每条 What Change 的闭环情况、每个 Modified Capability 的基线波及情况、每个通用维度）分别标注四值结论之一：**通过 / 不适用（含理由）/ 已修复（含改动说明）/ 待用户决策（含问题）**。SHALL NOT 以"自审通过，无问题"之类的一句总结代替逐项清单；未写理由的静默跳过视为未执行该项。存在"待用户决策"项时 SHALL 在清单中列出完整问题再询问。

**自审修改后验证**：自审产生任何 artifact 修改（尤其 delta spec）后，SHALL 运行 `openspec validate --changes <change-name>` 确认结构合法，再进入步骤 5.5。

### 5.5 产出 context.md 软上下文 artifact（commit 前）

在方案自审完成之后、步骤 6 commit 之前，由当前会话产出 `openspec/changes/<change-name>/context.md`（软上下文 artifact，详见 spec 能力 `review-context-artifact`）：

1. **收录内容**（只记文档之外的讨论结论）：关键决策与理由、已否决的备选方案及否决理由、范围边界（明确做什么/不做什么）、已知坑与注意事项。与 proposal/design/tasks/delta spec 重复的内容以一句话引用指路，SHALL NOT 整段摘抄。
2. **内容边界自检（产出质量关卡）**：产出时完成一次自检——(a) 无与 artifact 重复的整段内容；(b) 每条决策/否决理由可溯源到本 change 讨论或基线 artifact 对应条目；(c) 行数 ≤ 100 行（它是每次 subagent spawn 的固定读取成本）。自检不通过 → 修订后重检，SHALL NOT 带病产出。
3. **无实质内容时**：仍产出仅含标题与一行说明的最小骨架文件，SHALL NOT 省略文件——审查/实施 subagent 的 TASK 引用固定路径，文件缺失会造成断链。

### 6. 暂存并立即 commit（每步 commit）

自审完成（含其修复）与 context.md 产出后执行。自审产生的 artifact 修复与 context.md 属于本次待提交内容——产物、自审修复与 context.md 是同一个待提交单元，随这次 commit 一次干净落库，不产生"commit + 未提交自审修复"的混合状态。

1. `git add -- openspec/changes/<change-name>/`（该目录含 `.openspec.yaml` 元数据、proposal/design/tasks、context.md 与全部 delta spec，集群暂存，不用 `git add -A`）。
2. **按共用 index 隔离协议提交**——目标范围为 `openspec/changes/<change-name>/` 目录，协议分支：
   - index 中无该目录外的已暂存内容 → 直接 commit（见第 3 步命令）。
   - index 中存在该目录外的已暂存内容、且与目标范围无文件重叠 → 用 `git commit --only -F "$MSG_FILE" -- openspec/changes/<change-name>/` 隔离提交（**`-F` 必须放在 `--` 之前**；`MSG_FILE` 由 `git rev-parse --git-path COMMIT_EDITMSG` 获取；目标范围含未跟踪新文件时**必须先 `git add`**，否则 `--only` 报 `pathspec ... did not match any file(s) known to git`），或先 unstage 非目标文件、提交后恢复原暂存状态；范围外文件保留原暂存状态。
   - 同一文件内既存 staged hunk 与本次 hunk 混合、无法机械分离时 → **停止转人工**，如实报告，不猜测性提交。
3. **立即 commit**，先用 `MSG_FILE="$(git rev-parse --git-path COMMIT_EDITMSG)"` 获取路径并按 `@lyx-commit` 正文规范写入完整 message，message 采用 Conventional Commits 前缀 + 正文 + trailer 结构：
   ```
   docs(openspec): <subject>

   - 动机：<为什么发起本次方案>
   - 改动：<方案覆盖范围与关键决策>
   - 影响：<后续实施/审查/兼容性影响>

   Change-Stage: propose
   Change-Name: <change-name>
   ```
   （subject 用一句人话概括本次方案；正文按 `@lyx-commit` 规范；`Change-Stage` 固定 `propose`。提交命令使用 `git commit -F "$MSG_FILE"`。）
4. 用 `git show --name-only --format=` 校验这次 commit 的实际文件集合严格等于目标范围（该目录全部应提交文件，含 `.openspec.yaml` 与 `context.md`）——不许超出、不许漏项。
5. 若该目录下无可提交内容、`git commit` 失败，或校验发现文件集合与目标范围不相等，**停止后续自动化步骤**，报告具体原因。

该 propose 阶段 commit（含自审修复）即 `@lyx-review-plan` 的审查对象（见 `@lyx-review-plan` 的审查范围判定：按 trailer 定位 `Change-Stage: propose` + `Change-Name: <change-name>`，`git show <commit>` + `git diff HEAD` + 未跟踪清单；trailer 未命中时回退旧前缀 `^propose: <change-name>` 并打印 DEPRECATED 兼容通道提示）。

### 7. 按第 2 步选择分支

- **选"全自动"** → 进入步骤 8（自动流水线）。
- **选"手动"** → 进入步骤 9（逐步确认）。

### 8. 全自动：自动流水线直到审完代码

**全程无隔离方式询问、不自动 archive。**

**执行者语义（自 switchable-executor-flow 起）**：流水线每一步的主体按配置决定，不由本模板写死——review-plan / review-code 按 `[codexHost] reviewExecutor`（`main` = 主 agent 直接审查，默认；`subagent` = spawn 审查 subagent），apply 按 `[codexHost] codingExecutor`（`main` = 主 agent 直接实施，默认；`subagent` = spawn coding subagent）。**慢验证（测试 / 类型检查 / 构建）SHALL NOT 在流水线内的审查循环执行**——统一由 `@lyx-archive` 的归档前完整验证关卡执行一次。

1. 自动执行 `@lyx-review-plan <change-name>` 编排流程（完整指示见 `@lyx-review-plan skill 的指示`，按其指示逐轮执行审查-修复循环；审查对象为 propose 阶段 commit（带 `Change-Stage: propose` trailer），清零时由循环统一提交修复）。
   - Critical 清零 → 进入下一步。
   - 其余任一种终止（熔断、驳回硬线、无法安全修复、验证失败、审查调用失败、达到轮数上限）→ **停止流水线**，复用该循环已产出的终止报告（不重新生成或重复一份）报告终止原因，结束，不执行后续步骤。
2. **节点前置校验（进入 apply 前）**：进入 apply 之前 SHALL 校验 review-plan 是否以"正常清零"收尾——判据为**本会话记录的 review-plan 循环终止类型 == 正常清零**且无未决人工介入项（不依赖清零报告文件等会话外 artifact）。校验 SHALL 在该节点显式打印一行校验结论（含依据：终止类型、是否无未决项）；校验不过（终止类型为熔断/驳回硬线/无法安全修复/验证失败/审查调用失败/轮数上限，或存在未决项）SHALL 停在该节点，复用 review-plan 已产出的终止报告说明阻断原因，SHALL NOT 硬闯 apply。
3. 自动执行 `@lyx-apply <change-name>` 编排流程（完整指示见 `@lyx-apply skill 的指示`；实施主体按 `codingExecutor` 决定，实施完成后由主会话确认、回写 `context.md`（实施决策）并统一提交 apply 阶段 commit——message 为 CC 前缀（type 由主会话按实际改动判断）+ `Change-Stage: apply` + `Change-Name: <change-name>` trailer）。
4. **节点前置校验（进入 review-code 前）**：apply 实施完成并提交时 SHALL 以 `git rev-parse HEAD` 记录本次 apply 提交后的 HEAD SHA；进入 review-code 之前 SHALL 按 trailer 优先定位最近一期 apply 阶段 commit 的 SHA（`git log --grep="^Change-Stage: apply$" --grep="^Change-Name: <change-name>$" --all-match -1 --format=%H`；未命中时回退旧前缀 `git log --grep="^apply: <change-name>" -1 --format=%H` 并打印 DEPRECATED 兼容通道提示），并校验其等于本次记录（**历史存在旧 apply commit 不得绕过本次校验**）。校验 SHALL 在该节点显式打印一行校验结论（含依据：本次记录的 SHA、最近一期 apply 阶段 commit SHA、是否相等）。校验不过（SHA 不等、commit 缺失或实施阶段未正常收尾）SHALL 停在该节点如实报告实施收尾失败详情，SHALL NOT 以旧 commit 作为本次审查对象进入 review-code。
5. 自动执行 `@lyx-review-code <change-name>` 编排流程（完整指示见 `@lyx-review-code skill 的指示`；审查主体按 `reviewExecutor` 决定；审查对象为 apply 阶段 commit（带 `Change-Stage: apply` trailer），清零时由循环统一提交修复）。
   - Critical 清零 → 流水线结束，提示可手动 `@lyx-archive` 归档。
   - 其余任一种终止 → **停止流水线**，复用该循环已产出的终止报告报告终止原因，结束。
6. 流水线执行过程中任一环节 `git commit` 失败：如实报告 Git 原始错误，停止流水线。

### 9. 手动：逐步确认

1. propose 阶段 commit（带 `Change-Stage: propose` trailer）完成后，询问：
   ```
   "要不要现在跑一次 review-plan 审查循环？"
   ```
   询问时 SHALL 附带当前状态摘要：当前阶段（propose 阶段 commit 已完成）与下一步（选"是"将调用 `@lyx-review-plan <change-name>`，审查对象为该 commit），保证选"是"后的续接无歧义。
   - **否** → 编排结束。方案已 commit；日后由用户自行 `@lyx-apply` 实施、`@lyx-review-code` 审查。
   - **是** → 继续步骤 2。
2. 执行 `@lyx-review-plan <change-name>` 编排流程（审查由**单审查 subagent**（非 fork）执行；审查对象为 propose 阶段 commit，清零时由循环统一提交修复）。
3. 循环终止（无论何种原因）后编排结束，**不再询问隔离方式、不再询问提交、不自动衔接 apply**——日后的实施与代码审查由用户另行 `@lyx-apply`、`@lyx-review-code` 触发。

---

隔离方式询问（三选一：隔离 worktree / 本项目切新分支 / 留在当前分支）只发生在步骤 1（创建方案前，全局一次），且仅当当前不在任何 worktree 内时触发。
