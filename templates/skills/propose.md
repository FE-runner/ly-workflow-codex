---
name: lyx-propose
description: '在需要创建 OpenSpec change、整理方案并编排后续审查与实施时使用。'
argument-hint: '<需求描述>'
---

# Propose

> 调用方式：`@lyx-propose` mention 后跟随的自然语言即参数（如 `@lyx-propose` 带需求描述/选项）；无参数时直接 `@lyx-propose`。

本文件是 `propose` 的完整编排源，不得把隔离、自审、提交、恢复或流水线关键步骤只放在 sidecar references。

**方案范围 skill（SHALL）**：生成 artifacts 前 SHALL 读取并遵循 `{{HOST_SKILLS_DIR}}/lyx-ponytail/SKILL.md`，用最小完整方案覆盖用户目标；不得生成用户未要求的功能、选项、扩展点或“以后可能用”的抽象。省略项只在 proposal 范围边界需要时简短说明，不自行扩成 Requirement、Scenario 或 task。方案阶段不运行 `lyx-code-simplification`；代码改动后的行为不变简化由 `@lyx-apply` / `@lyx-fix` 执行，代码审查视角由 `@lyx-review-code` 执行。skill 缺失或不可读时 SHALL 停止并报告缺失路径。

## 全自动执行不变量（最高优先级）

- 用户选择全自动后，真实 change 名一经确认，SHALL 立即创建 `run-state.md`，在固定 YAML frontmatter 写入 `lyx.executionMode: full-auto`、当前阶段、测试模式（如已选择）、隔离信息和下一步；该初始化 SHALL 早于方案自审。
- `@openspec-propose` 的 Planning boundary 只结束它自己的 artifacts 生成阶段，不结束 `@lyx-propose` 编排；artifacts 返回后 SHALL 继续方案自审、context/run-state、propose commit 与后续流水线。
- 方案自审逐项结论 MUST 写入 `run-state.md` 的 `## 方案自审`；SHALL NOT 作为独立 assistant 消息输出。写账本后 SHALL 立即执行步骤 5.5→5.6→5.7→6，完成 propose commit 后才读取 review-plan bundle，SHALL NOT 在自审后结束回合。
- review-plan 报告、apply 完成证据和节点校验结论都只是中间状态，SHALL NOT 被当作最终回复。
- 当前阶段正常完成且不存在待用户决策、失败或终止条件时，SHALL 以当前 skill 目录为锚点完整读取同级 `lyx-review-plan/SKILL.md`、`lyx-apply/SKILL.md` 或 `lyx-review-code/SKILL.md`，再继续同一回合。
- 只输出 `@lyx-*`、写出下一阶段名称或说明“下一步应执行”SHALL NOT 视为已进入下一阶段；无法定位同级 bundle 时停止并报告，不得回退为等待用户再次触发。
- 恢复时若目标 change 的 run-state frontmatter 已是 `lyx.stage: propose-self-review` 且方案 artifacts 完整，SHALL 沿用既有 isolation / `lyx.executionMode` 并从方案自审或 5.5 继续，SHALL NOT 重复询问隔离方式或全自动/手动。旧 change 无 YAML frontmatter 时 MAY 只读回退旧 `.openspec.yaml lyx`；frontmatter 损坏时停止。
- review-plan 正常清零后 SHALL 继续 apply；apply 正常完成并提交后 SHALL 继续 review-code。
- 只有 review-code 正常清零，或出现明确业务决策、失败、终止条件时，才允许结束全自动回合。
- 准备结束回合前 SHALL 核对 `run-state.md` frontmatter；若 `lyx.executionMode=full-auto` 且流水线尚未到正常终态，不得结束当前回合。

收尾编排入口。创建方案前先问两件事（各只一次）：本次开发的隔离方式（隔离 worktree / 本项目切新分支 / 留在当前分支，不在 worktree 内才问）、本次走全自动还是手动。产物生成后、commit 前由方案提出者执行一次方案自审（逻辑闭环 + 业务全面性，见步骤 5）与 context.md 软上下文产出（见步骤 5.5），自审修复与 context.md 随 propose 阶段 commit（message 带 `Change-Stage: propose` 与 `Change-Name` trailer）一次干净落库；全自动路径在同一会话内自动跑 review-plan → apply → review-code 直到审完代码，手动路径逐步确认。

## 步骤

### 0. 启动恢复（创建方案前）

若 `参数` 显式包含一个活跃 change 名，或 `openspec/changes/` 下恰好只有一个活跃 change，且其 `run-state.md` 的 `lyx.stage` 为 `propose-self-review`、`lyx.executionMode` 为 `full-auto`，同时 proposal/design/tasks（及已声明的 delta spec）完整：SHALL 视为恢复未完成的 propose 阶段。此时沿用 run-state frontmatter 中的 change、isolation 与 `executionMode`，跳过步骤 1-4 的隔离/模式询问和 artifact 重生成，核对 git/files 后从步骤 5 继续；若 run-state 已包含 `## 方案自审` 逐项结论但尚无 `context.md` 或 propose 阶段 commit，则从步骤 5.5 继续。未写入自审结论的旧中断记录仍从步骤 5 重新自审。不得再次询问隔离方式或全自动/手动，也不得新建第二个 change。旧 change 没有 YAML frontmatter 时 MAY 只读回退旧 `.openspec.yaml lyx`；frontmatter 损坏时停止，不得静默回退。

### 1. 是否已在 worktree 内 + 隔离方式询问（创建方案前，全局只问一次）

先读取当前分支：`SOURCE_BRANCH="$(git branch --show-current)"`。若为空（detached HEAD），**停止编排**，要求用户切到命名分支后再运行。

再检测当前是否已处于某个 worktree 内：比较 `git rev-parse --git-dir` 与 `--git-common-dir`（路径先 realpath 归一化再比较），并排除子模块误判（`git rev-parse --show-superproject-working-tree`）。

- **已在 worktree 内** → 跳过隔离方式询问，捕获 `ISOLATION=worktree`、`DEVELOPMENT_BRANCH="$SOURCE_BRANCH"`、`WORKTREE_PATH="$(git rev-parse --show-toplevel)"`、`ISOLATION_SOURCE_BRANCH=null`，直接进入步骤 2。
**unborn branch 预检（SHALL）**：呈现隔离选项前执行 `git rev-parse --verify HEAD >/dev/null 2>&1`；失败（仓库尚无任何提交）时，"隔离 worktree"选项 SHALL 标注不可用并说明需先创建 baseline commit，"本项目切新分支"与"留在当前分支"照常可选。

- **不在任何 worktree 内** → 直接向用户提问一次（三选一；已在某个开发分支上时照常询问，不因当前分支非默认分支而跳过）：

  ```
  "本次开发的隔离方式？"
    ○ 隔离 worktree（从当前分支切出，目录 ~/.ly/worktrees/<项目名>/<开发分支名>，目录+分支双隔离）
    ○ 本项目切新分支（留在当前目录，git checkout -b <开发分支名>，仅分支隔离，零环境成本）
    ○ 留在当前分支（不隔离，propose/apply 提交直接落在当前分支上）
  ```

  - **隔离 worktree**：
    1. 捕获 `ISOLATION=worktree`、`ISOLATION_SOURCE_BRANCH="$SOURCE_BRANCH"`，并设置 `WORKTREE_PATH=~/.ly/worktrees/<项目名>/<开发分支名>`。
    2. 先检查当前工作区未提交改动（`git status --porcelain`）：存在未提交草稿时提示"当前工作区的未提交改动将留在原 worktree、不会带入新 worktree"，待用户确认后再切换。
    3. 询问/确认本次开发的开发分支名 `<开发分支名>`（可含 `/`，如 `feature/xxx`），捕获 `DEVELOPMENT_BRANCH=<开发分支名>`。
    4. 执行（从**当前分支 HEAD** 切出，不是默认分支、不做分支拓扑校验）：
       ```
       git worktree add -b <开发分支名> ~/.ly/worktrees/<项目名>/<开发分支名> <当前分支HEAD>
       ```
       （`<项目名>` 以 `git rev-parse --git-common-dir` 反推主仓库目录名；多级分支名按 `/` 展开路径，仍保持无来源前缀的单层语义。）
    5. 自动复制环境文件（`.env` 等，复用 `@lyx-worktree add` 规则），跑一次项目 baseline 验证。
    6. **baseline 失败** → 报告失败摘要并询问用户"仍继续 / 放弃"：**仍继续** → 同会话 cd 进 worktree 继续编排（失败摘要作为已知风险带入后续流程，按本步 7/8 执行）；**放弃** → 保留已创建的 worktree 与分支（不自动清理，需要时用 `@lyx-worktree remove` 显式删除），打印携带失败摘要的兜底续接命令（同 7 的格式），会话结束，change 尚未生成。
    7. 打印**兜底续接命令**（绝对路径 + shell 安全转义）——正常路径不使用，仅当本会话意外死亡（崩溃、终端关闭等）时，用于在新 worktree 中恢复：
       ```
       {{HOST_FRAGMENT:resume-command}}
       ```
    8. **同一会话续跑（不结束会话）**——当前会话直接 `cd` 进新 worktree 并继续本编排（worktree 先于 change 创建的时序不变，change 尚未生成）：
       1. 以绝对路径 `cd "$HOME/.ly/worktrees/<项目名>/<开发分支名>"` 切换工作目录。
       2. **立即校验**当前工作目录确为该 worktree：`pwd` 与 worktree 绝对路径比对，或 `git rev-parse --show-toplevel` 归一化后等于该 worktree 绝对路径（SHALL NOT 仅以 `git rev-parse --git-dir` 成功作为判据——它在任意 git 仓库内都会成功，无法证明位于该 worktree）。**cd 失败或校验不通过 → 停止编排、报告原因，不执行后续任何 git/openspec/文件操作（不静默失败后继续）**。
       3. 校验通过后提示"已进入隔离 worktree `<路径>`，本会话继续"，继续步骤 2。
       4. **cwd 纪律**：自校验通过之时起，本次编排所有 Git 操作、openspec 命令与文件读写以 worktree 为工作目录（文件操作用 worktree 绝对路径），不回到主仓库路径执行本次 change 的任何产物操作。
       5. worktree 目录/分支锁定为 `<开发分支名>`，后续不因 change 名不同而对 worktree/分支重命名。
  - **本项目切新分支**：
    1. 捕获 `ISOLATION=branch`、`ISOLATION_SOURCE_BRANCH="$SOURCE_BRANCH"`；询问/确认开发分支名 `<开发分支名>`（规则与 worktree 路径一致：可含 `/`，如 `feature/xxx`），捕获 `DEVELOPMENT_BRANCH=<开发分支名>`。
    2. 检查当前工作区未提交改动（`git status --porcelain`）（SHALL 忽略进行中 change 目录下审查未修项快照的新增或修改状态，即 `??` / ` M` 形式的 `openspec/changes/<change-name>/review-findings.md` 行——该文件由审查关卡的独立快照 commit 或 archive 负责，不属于待处置的脏改动；过滤后为空视为干净，不发出询问）：非空时用一次三选一询问处置方式，各选项文案如实说明后果：
       - **提交（WIP commit）**：用 `MSG_FILE="$(git rev-parse --git-path COMMIT_EDITMSG)"` 获取 message 文件路径并写入完整 message（首行 `chore(wip): 切分支前暂存工作区改动`，正文按 `@lyx-commit` 规范写动机/改动/影响），执行 `git add -A -- ':/' ':(top,exclude,glob)openspec/changes/*/review-findings.md' && git commit -F "$MSG_FILE"` 后再切分支（全量暂存但排除进行中 change 的未跟踪快照 `review-findings.md`，顶层锚定，见 `review-findings-snapshot`；暂存后暂存区仍为空时 SHALL 跳过 `git commit`，如实说明"仅有进行中快照改动，已跳过 WIP 提交"并继续，SHALL NOT 视为处置失败）——新分支从含 WIP commit 的 HEAD 切出，改动固化为新分支上的提交，review-code 审查对象不受污染；
       - **Stash**：`git stash push -u` → 切分支 → `git stash pop`——如实说明"pop 回来后改动仍在工作区，stash 仅提供日志留底"；
       - **原样保留**：不做任何处理——明示"改动会进入 review-code 审查范围（`git diff HEAD`），可能污染审查对象"；且若这些改动与后续 apply 的实施目标文件重叠，apply 会直接停止转人工（停止报告会回指此处处置选择）。

       三种选择均直接执行（风险已写入文案，不二次确认）；处置动作失败（提交失败、stash 失败等）→ **如实报错停止编排，不自动兜底**。
    3. 执行 `git checkout -b <开发分支名>`（从当前 HEAD 建新分支并切换）。本路径**不运行 baseline 验证**（同一工作目录、同一 env、同一 node_modules，baseline 验证的"全新 worktree 可用性"前提不成立）、**不切换会话工作目录**、**不打印兜底续接命令**（无目录切换即无会话断链风险）。分支名已存在或非法导致 `git checkout -b` 失败时，**如实报错停止编排转人工**（不自动改名、不自动 stash），change 尚未生成。
    4. 进入步骤 2，后续编排（opsx:propose → 自审 → commit → 流水线）在当前工作目录原位继续。
  - **留在当前分支**：捕获 `ISOLATION=none`、`ISOLATION_SOURCE_BRANCH="$SOURCE_BRANCH"`、`DEVELOPMENT_BRANCH=null`；不创建 worktree、不切换分支，直接进入步骤 2。若 `git status --porcelain` 按同一规则忽略进行中快照后仍非空，触发与"本项目切新分支"相同的脏改动三选一处置询问（其中 Stash 选项因无切换动作**不自动 pop**——改动收进 stash 由用户日后 `git stash pop` 自取，执行时如实说明；WIP commit 选项将改动提交到当前分支，提交首行用 `chore: 暂存工作区改动`（区别于切分支路径的 `chore(wip): 切分支前暂存工作区改动`），暂存命令与快照排除沿用同一规则）。

**隔离动作成功后的公共失败路径**：从步骤 1 捕获/创建隔离环境成功开始，步骤 2-4 任一后续中止、失败或用户取消时，命令 SHALL 报告 `ISOLATION`、`DEVELOPMENT_BRANCH`、`WORKTREE_PATH` 与“已保留、未清理”的状态，SHALL NOT 自动合并或删除。

### 2. 询问全自动/手动（创建方案前，全局只问一次）

直接向用户提问：

```
"本次收尾走全自动（自动审查 + 自动实施 + 审完代码才停，非清零即停），还是手动逐步确认（每一步都问）？"
```

这是唯一决定"自动/手动"路径的开关询问。自动化程度与隔离正交：选全自动不隐含必须切 worktree，切了 worktree 也不隐含必须全自动。后续步骤不再重复问"要不要继续自动"。本轮若已在 worktree 内（跳过步骤 1 的询问），此询问照常进行。

用户回答后 SHALL 捕获 `EXECUTION_MODE=full-auto` 或 `EXECUTION_MODE=manual`，并在 change 确定后写入 `run-state.md`。后续阶段恢复时 SHALL 读取该字段，SHALL NOT 仅依赖会话记忆。

### 3. 按 opsx:propose 编排流程生成方案

读取 `@openspec-propose skill`（opsx propose 编排 prompt）并按其定义的完整流程，围绕 `参数`（需求描述）生成 proposal/design/tasks 全部 artifacts。生成过程中遵循该编排 prompt 的全部步骤与约束（本命令的步骤 4-9 在其后继续编排）。

**Planning boundary 从属规则（SHALL）**：`@openspec-propose` 的 “planning artifacts only / stop after artifacts” 约束只限定它自己的委托阶段，防止该阶段直接修改项目代码；它不是 `@lyx-propose` 编排入口的终止条件。用户调用 `@lyx-propose` 并选择全自动后，已授权当前会话在 artifacts 返回后继续方案自审、context/metadata、propose commit 与 review-plan → apply → review-code。SHALL NOT 因 opsx 的 “wait for a new user request” 文案在 artifacts 或方案自审后结束回合，也不得要求用户再次说“继续”。

**范围最小化（SHALL）**：生成 artifacts 前读取并应用 `{{HOST_SKILLS_DIR}}/lyx-ponytail/SKILL.md`。proposal 的 What Changes、delta spec 与 tasks 只覆盖用户目标及完成任务必需的调用方、验证、错误处理、安全与迁移；用户未要求的扩展点、可选配置、向后兼容层和投机抽象 SHALL NOT 被自动生成。确实主动省略时，可在 proposal 的边界说明保留一句，不额外制造 Requirement、Scenario 或 task。该 skill 缺失或不可读时停止并报告缺失路径。

**产物语言（SHALL）**：生成 artifacts 前读取 `{{LYX_CONFIG_FILE}}` 的 `[general].language`（缺失、空白或非法时按 `zh-CN`）。proposal.md、design.md、tasks.md、delta spec、context.md 与 run-state.md 的标题、说明、决策、任务、场景和验收描述 SHALL 使用该语言；`zh-CN` 用中文，`en` 用英文。OpenSpec 提供的模板栏目结构必须保留，但栏目标题和自然语言内容要按配置语言表达；代码标识符、命令、路径、错误原文和必要技术术语 MAY 保留英文。该规则同样约束方案自审对 artifacts 的修改与后续各阶段对 run-state.md 的续写，SHALL NOT 因 OpenSpec 默认模板是英文而生成英文正文。

**测试模式与风险策略适配（SHALL）**：生成 artifacts 前读取 `{{LYX_CONFIG_FILE}}` 并解析当前项目的有效配置 `testMode`：项目路径按主仓库根归一（普通 checkout 与 separate-git-dir checkout 用 `show-toplevel`，子模块用自身 `show-toplevel`，非 bare linked worktree 能确定主工作树时用主树根，bare worktree 或 separate-git-dir 无法反推主树时用当前 worktree 的 `show-toplevel`，非 Git 目录用规范化 cwd）；优先级为 `[projects."<项目根>"].testMode` > `[host].testMode` > `normal`。项目覆盖缺失时回退宿主默认，项目覆盖取值非法时回退宿主默认并由 doctor 告警；配置文件整体缺失、不可读或 TOML 解析失败时停止并提示运行 `lycx doctor`；宿主默认字段缺失、空白或非法时按 `normal` 处理。

配置为 `normal` / `off` 时直接作为最终模式。配置为 `ask` 时，SHALL 在生成 artifacts 前询问一次：`normal` 表示写测试、跑测试；`off` 表示不写测试、不跑测试。用户取消或环境无法交互时停止，不生成 artifacts。该选择在当前会话暂存为 `TEST_MODE_DECISION`；步骤 4 确认真实 change 名后，SHALL 在步骤 4.5 创建 run-state 时写入 `lyx.testModeDecision`。若在这之前中断，恢复时重新询问，不得声称决策已持久化。新 change SHALL NOT 把该值写入 `.openspec.yaml`。

最终模式为 `testMode = "off"` 时 SHALL NOT 生成测试文件、测试修改或测试命令任务；行为或契约所需 spec 仍照常生成，tasks 的验证限定为 typecheck、build、视觉检查或其他非测试检查。来源为项目覆盖时，状态行写为 `[跳过] ...（testMode=off，项目配置）`。

最终模式为 `normal` 时按 `risk-based-testing-policy` 分类并决定测试义务：

- 纯 UI、文案或样式改动只涉及静态展示且不改变行为或契约时，MAY 在 `proposal.md` 明确声明“展示型改动，无行为或契约变化”，保持 New/Modified Capabilities 为空，并在 `.openspec.yaml` 设置 `skip_specs: true`；此时 SHALL NOT 生成 delta spec 或测试任务，`tasks.md` 仍须包含实现任务与相称验证任务（如 typecheck、build 或视觉检查）。
- 行为或契约改动 SHALL 生成对应 delta spec，并在可自动化时生成与风险相称的测试任务。
- 补充边界覆盖 SHALL NOT 被自动扩为核心 tasks；若 proposal 的核心 What Change 完全没有对应实施任务，仍按机械断链处理。

**解决的审查未修项声明（可选）**：若用户在本次讨论中明确本次 change 解决了某条历史 `review-findings.md` 的 Warning，SHALL 在生成的 `proposal.md` 末尾新增 `## 解决的审查未修项` 小节，每条以 `- <归档快照路径>#<节名>#<序号> — <一句解决说明>` 列出。节名仅允许 `方案审查` / `代码审查`（如 `...#方案审查#1` / `...#代码审查#2`），序号为该节 Warning 条目的 1 起连续编号，路径 SHALL 指向 `openspec/changes/archive/**/review-findings.md` 下的已归档快照。本次 change 不解决任何历史 Warning 时 SHALL 省略该小节，SHALL NOT 创建空小节。propose 阶段 SHALL NOT 直接改写历史快照——实际回写由 `@lyx-archive` 在归档时完成（见 `review-findings-snapshot` 的「追加式解决说明」）。

### 4. 确定真实 change 名（前后快照比对）

调用前记录一次 `openspec list --json` 的候选 change 名集合（快照 A，若步骤 3 之前尚未记录则在生成前先记录）；生成完成后再查询一次（快照 B）。取快照 B 相对快照 A 新增的那一条作为本次实际生成的 change 名。**不依赖 `参数`、不单纯依赖全局 `lastModified` 最新一条**——opsx:propose 会把用户输入的原始描述转成 kebab-case slug，两者不保证一致。若新增条目不唯一，或没有新增条目，**不猜测**，直接询问用户本次生成的 change 名，待确认后再继续。

真实 change 名（需求名）一经确认，SHALL 在进入步骤 5 前立即同步当前会话标题，标题文本使用 `<change-name>` 原值：

{{HOST_FRAGMENT:session-title}}

标题同步是附属动作：失败或宿主不提供自动调用能力时，SHALL 如实报告实际状态并继续方案流程，SHALL NOT 伪造成功，也 SHALL NOT 因标题同步失败中断 propose。

### 4.5 初始化 run-state.md（方案自审前）

真实 change 名确认后、进入步骤 5 之前，SHALL 按本文件「运行账本与证据」的骨架立即创建 `run-state.md`，不得等到自审或 context.md 完成后再创建。初始 frontmatter 至少写入：

- `lyx.schemaVersion: 1`
- `lyx.change: <change-name>`
- `lyx.stage: propose-self-review`
- `lyx.executionMode: <EXECUTION_MODE>`
- `lyx.pipelineStage: review-plan | apply | review-code | none`（按 `reviewMode` 与执行模式确定）
- `lyx.testModeDecision: normal | off | null`（effective `ask` 且已选择时写所选值）
- `lyx.isolation`：`mode`、`sourceBranch`、`developmentBranch`、`worktreePath`
- `lyx.lastGoodCommit: <propose 基线或 null>`
- `lyx.completedTasks`、`lyx.review` 与 `lyx.nextSafeAction`

`run-state.md` 无法创建或写入时 SHALL 立即停止并报告原始错误，SHALL NOT 进入方案自审。该文件后续由步骤 5.7 增量更新并随步骤 6 一起提交。

### 5. 方案自审（commit 前，由方案提出者执行）

在确定真实 change 名（步骤 4）之后、暂存并 commit（步骤 6）之前，由当前会话（方案提出者）对该 change 的全部 artifacts（`proposal.md`/`design.md`/`tasks.md`/全部 delta spec）执行一次**方案自审**。提出者刚完成方案生成、上下文最全，负责查"逻辑闭环"与"业务全面性"这两类依赖上下文的问题；独立视角的"一致性 + 风险"仍归 `@lyx-review-plan` 的外部审查（职责分工，不重复）。

**五项检查（逐项执行，粒度按条目对齐，不做段落级语义对齐）：**

1. **正向闭环**：proposal 的每条 What Change 条目 SHALL 能对应到 design 的决策与 tasks 的核心实施任务（粒度：What Change 列表项 ↔ tasks checkbox 逐条映射）。补充边界覆盖不属于核心实施任务，其缺失 SHALL NOT 判为断链。design.md 缺失时容错跳过该段（What Change 直接对接 tasks），缺失本身不作为问题处理。
2. **反向闭环**：tasks 的每个任务 SHALL 能溯源到至少一条 What Change 条目或测试风险策略要求的验证；不可溯源的孤儿任务属于拆解时私自扩的范围，SHALL 处理（删除或补全对应的 What Change/设计依据）。不得为“额外覆盖率”新增不可溯源任务。
3. **基线波及**：对 proposal 声明的每个 Modified Capability，SHALL 逐条对照 `openspec/specs/<capability>/spec.md` 的现有 Requirements 检查本次改动是否波及（粒度：基线 Requirement 逐条）；被波及但方案只字未提的即为遗漏，SHALL 处理。New Capabilities 无基线可查，跳过该项。
4. **通用业务维度过网**：权限、失败路径、并发、兼容/迁移等通用业务维度 SHALL 逐项过一遍（按维度逐项给结论）；判定"不适用"的维度 MUST 写明理由，SHALL NOT 静默跳过。
5. **实施就绪**：每个核心 task SHALL 有明确文件路径或可检索定位锚点、跨任务接口（参数/返回值/数据结构）、可运行验证命令与预期结果，并能作为独立交付、验证和审查单元。禁止“完善处理”“适当校验”“补充相关逻辑”等不可执行描述；发现机械缺失直接补齐，涉及产品语义或取舍的未知项列为待用户决策。

**发现问题分两类处理：**

- **机械断链**（核心实施任务漏项、范围未同步、design 决策缺失等可直接修复的缺陷）：由提出者直接修改对应 artifact，SHALL NOT 就此类问题询问用户。补充边界测试、额外 Scenario 或额外测试任务缺失 SHALL NOT 归入机械断链。
- **业务判断类**（"这个场景要不要支持"等需要用户决策的开放问题）：SHALL 列为开放问题直接向用户提问，SHALL NOT 由提出者自行猜测决定。**全自动模式下同样询问**——该询问是自动流水线的人工确认点，与"需要人工介入"同级；用户回答后按回答更新对应 artifact 再继续。用户拒绝/取消回答 → 停止后续编排（不 commit、全自动流水线不启动），artifacts 留在工作区，报告结论清单与未决问题，转人工处理。

**逐项结论写入账本（硬约束，防走过场）：**

自审 MUST 把**逐项结论**写入 `run-state.md` 的 `## 方案自审` 正文，对五项检查的每一子项（每条 What Change 的闭环情况、每个 Modified Capability 的基线波及情况、每个通用维度、每个核心 task 的实施就绪情况）分别标注四值结论之一：**通过 / 不适用（含理由）/ 已修复（含改动说明）/ 待用户决策（含问题）**。SHALL NOT 以"自审通过，无问题"之类的一句总结代替逐项结论；未写理由的静默跳过视为未执行该项。存在"待用户决策"项时，SHALL 从 run-state 提炼完整问题后询问用户。

自审结论 SHALL NOT 作为独立的 assistant 消息输出。宿主会把没有后续工具调用的 assistant 消息当作 `task_complete`，导致后续文件工具动作没有执行；当前模型不得用“下一步将生成 context.md”一类文字代替工具动作。

**自审修改后验证**：自审产生任何 artifact 修改（尤其 delta spec）后，SHALL 运行 `openspec validate --changes <change-name>` 确认结构合法，再进入步骤 5.5。

**自审收口非终态（SHALL）**：自审判定完成后，SHALL 直接通过文件工具把逐项结论写入 `run-state.md` 的 `## 方案自审`，再立即执行步骤 5.5→5.6→5.7→6 propose commit。只要不存在"待用户决策"项、失败或终止条件，SHALL NOT 先输出独立自审消息、结束回合或等待用户再次确认，也 SHALL NOT 在 propose commit 前读取 review-plan bundle。

### 5.5 产出 context.md 软上下文 artifact（commit 前）

在方案自审完成之后、步骤 6 commit 之前，由当前会话产出 `openspec/changes/<change-name>/context.md`（软上下文 artifact，详见 spec 能力 `review-context-artifact`）：

1. **收录内容**（只记文档之外的讨论结论）：关键决策与理由、已否决的备选方案及否决理由、范围边界（明确做什么/不做什么）、已知坑与注意事项。与 proposal/design/tasks/delta spec 重复的内容以一句话引用指路，SHALL NOT 整段摘抄。
2. **内容边界自检（产出质量关卡）**：产出时完成一次自检——(a) 无与 artifact 重复的整段内容；(b) 每条决策/否决理由可溯源到本 change 讨论或基线 artifact 对应条目；(c) 行数 ≤ 100 行（它是每次 subagent spawn 的固定读取成本）。自检不通过 → 修订后重检，SHALL NOT 带病产出。
3. **无实质内容时**：仍产出仅含标题与一行说明的最小骨架文件，SHALL NOT 省略文件——审查/实施 subagent 的 TASK 引用固定路径，文件缺失会造成断链。

### 5.6 完成 run-state metadata（commit 前）

步骤 4.5 已创建 run-state；在本步骤确认并补全 `lyx.isolation`：

- `mode: worktree | branch | none`
- `sourceBranch: <ISOLATION_SOURCE_BRANCH 或 null>`
- `developmentBranch: <DEVELOPMENT_BRANCH 或 null>`
- `worktreePath: <WORKTREE_PATH 或 null>`

`mode: none` 时 `sourceBranch` 仍记录当前分支，`developmentBranch` / `worktreePath` 为 `null`。`sourceBranch` 缺失时写 `null`，不得猜测。effective `testMode = ask` 且已有选择时，同一 frontmatter 的 `testModeDecision` SHALL 已写入所选值。

新 change SHALL NOT 在 `.openspec.yaml` 写入 `lyx:` 或 `x-lyx:`。run-state 属于 propose 提交单元，随步骤 6 的 `git add -- openspec/changes/<change-name>/` 一起提交。写入后 SHALL 再运行一次 `openspec validate --changes <change-name>`；若验证失败，停止在 commit 前并报告原始错误。

### 5.7 更新 run-state.md（commit 前）

在方案自审、context.md 与 metadata 完成后、步骤 6 commit 前，SHALL 增量更新步骤 4.5 已创建的 `run-state.md`，至少更新：

- `lyx.stage: propose`
- `lyx.executionMode: <EXECUTION_MODE>`
- `lyx.pipelineStage: review-plan | apply | review-code | none`（按 `reviewMode` 与执行模式确定）
- `lyx.lastGoodCommit`：propose 基线
- `lyx.nextSafeAction`：全自动时写明下一命令、同级 `SKILL.md` 路径、change 参数与继续条件；手动时写明等待用户选择是否审查
- 正文中的方案自审结论摘要与验证证据；`## 方案自审` 必须包含五项检查的全部逐项结论

`run-state.md` 不存在、不可读或无法写入时 SHALL 停止在 commit 前并如实报告，SHALL NOT 跳过后继续 commit。该文件 SHALL 随步骤 6 的 propose 阶段 commit 一并提交。

### 6. 暂存并立即 commit（每步 commit）

自审完成（含其修复）与 context.md 产出后执行。自审产生的 artifact 修复与 context.md 属于本次待提交内容——产物、自审修复与 context.md 是同一个待提交单元，随这次 commit 一次干净落库，不产生"commit + 未提交自审修复"的混合状态。

1. `git add -- openspec/changes/<change-name>/`（该目录含 `.openspec.yaml` 元数据、proposal/design/tasks、context.md、run-state.md 与全部 delta spec，集群暂存，不用 `git add -A`）。
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

**阶段报告非终态（SHALL）**：本流水线中的所有阶段报告、节点校验结论和“完成证据”都是中间状态，SHALL NOT 被当作最终回复。只要当前阶段正常完成且不存在未决业务决策、失败或终止条件，当前回合 SHALL 立即继续下一阶段：

- review-plan 正常清零并输出报告后，立即执行步骤 2 的节点校验，再执行步骤 3 apply。
- apply 完成、提交并输出完成证据后，立即执行步骤 4 的节点校验，再执行步骤 5 review-code。
- 只有 review-code 正常清零并输出最终报告后，才允许结束全自动回合。

各阶段命令 SHALL 从 `run-state.md` frontmatter 读取 `lyx.executionMode`、`lyx.pipelineStage` 与 `lyx.nextSafeAction`，并在阶段结束时更新；SHALL NOT 只依赖会话记忆判断是否自动续跑。阶段报告不是人工确认点，SHALL NOT 等待用户再次触发下一阶段。

**下一阶段 bundle 读取协议（SHALL）**：进入任何下一阶段前，以当前已加载 skill 所在目录为锚点解析并完整读取同级 `lyx-<next-command>/SKILL.md`，再按该 bundle 执行。`@lyx-*` 在本流程中是命令标识；只输出命令标识、写出下一阶段名称或说明“下一步应执行”SHALL NOT 触发 skill。同级 bundle 缺失或无法定位时停止并报告缺失路径，SHALL NOT 猜测绝对路径后继续。

**执行者语义（自 switchable-executor-flow 起）**：流水线每一步的主体按配置决定，不由本模板写死——review-plan / review-code 按 `[host] reviewExecutor`（`main` = 主 agent 直接审查，默认；`subagent` = spawn 审查 subagent），apply 按 `[host] codingExecutor`（`main` = 主 agent 直接实施，默认；`subagent` = spawn coding subagent）。**慢验证中的测试 / 类型检查 SHALL NOT 在流水线内的审查循环执行**——统一由 `@lyx-archive` 的归档前验证关卡执行一次；生产构建不在归档门禁范围。

**审查范围门控（自 add-review-mode 起）**：流水线执行哪些审查关卡 SHALL 由当前宿主 `[host]` 的 `reviewMode` 决定（未配置 / 空白 / 非法取值等价 `full`）：`full` = 两级都跑；`plan-only` = 跑 review-plan、跳过 review-code；`code-only` = 跳过 review-plan、跑 review-code；`off` = 两级都跳过。apply 在任何取值下都执行。被跳过的审查关卡 SHALL 打印显式状态行（形如 `[跳过] review-plan（reviewMode=code-only）`），SHALL NOT 静默跳过；被跳过关卡对应的节点前置校验一并跳过。

1. **review-plan 关卡（仅 `full` / `plan-only`）**：完整读取同级 `lyx-review-plan/SKILL.md`，再按该 bundle 以 `<change-name>` 执行审查-修复循环（审查对象为 propose 阶段 commit（带 `Change-Stage: propose` trailer），清零时由循环统一提交修复）。`code-only` / `off` 时跳过本步（连同第 2 步一并跳过），并打印 `[跳过] review-plan（reviewMode=<取值>）` 状态行。
   - 正常清零（Critical 为 0 且所有 `影响落地=是` 的 Warning 都已解决）→ 进入下一步。
   - 其余任一种终止（熔断、驳回硬线、无法安全修复、验证失败、审查调用失败、达到轮数上限）→ **停止流水线**，复用该循环已产出的终止报告（不重新生成或重复一份）报告终止原因，结束，不执行后续步骤。
2. **节点前置校验（进入 apply 前，仅 `full` / `plan-only`）**：进入 apply 之前 SHALL 校验 review-plan 是否以"正常清零"收尾——判据为 **`run-state.md` 记录的 review-plan 循环终止类型 == 正常清零**且无未决人工介入项；会话记忆与该记录冲突时以可核验的 run-state、git 和审查报告事实为准。校验 SHALL 在该节点显式打印一行校验结论（含依据：终止类型、是否无未决项）；校验不过（终止类型为熔断/驳回硬线/无法安全修复/验证失败/审查调用失败/轮数上限，或存在未决项）SHALL 停在该节点，复用 review-plan 已产出的终止报告说明阻断原因，SHALL NOT 硬闯 apply。校验通过后 SHALL 在同一回合立即进入第 3 步。第 1 步跳过 review-plan 时本节一并跳过。
3. 完整读取同级 `lyx-apply/SKILL.md`，再按该 bundle 以 `<change-name>` 执行实施（实施主体按 `codingExecutor` 决定，实施完成后由主会话确认、回写 `context.md`（实施决策）并统一提交 apply 阶段 commit——message 为 CC 前缀（type 由主会话按实际改动判断）+ `Change-Stage: apply` + `Change-Name: <change-name>` trailer）。apply 完成报告输出后 SHALL 在同一回合继续第 4 步，SHALL NOT 把实施完成报告当作全自动终点。
4. **节点前置校验（进入 review-code 前，仅 `full` / `code-only`）**：apply 实施完成并提交时 SHALL 以 `git rev-parse HEAD` 记录本次 apply 提交后的 HEAD SHA；进入 review-code 之前 SHALL 按 trailer 优先定位最近一期 apply 阶段 commit 的 SHA（`git log --grep="^Change-Stage: apply$" --grep="^Change-Name: <change-name>$" --all-match -1 --format=%H`；未命中时回退旧前缀 `git log --grep="^apply: <change-name>" -1 --format=%H` 并打印 DEPRECATED 兼容通道提示），并校验其等于本次记录（**历史存在旧 apply commit 不得绕过本次校验**）。校验 SHALL 在该节点显式打印一行校验结论（含依据：本次记录的 SHA、最近一期 apply 阶段 commit SHA、是否相等）。校验不过（SHA 不等、commit 缺失或实施阶段未正常收尾）SHALL 停在该节点如实报告实施收尾失败详情，SHALL NOT 以旧 commit 作为本次审查对象进入 review-code。第 5 步跳过 review-code 时本节一并跳过。
5. **review-code 关卡（仅 `full` / `code-only`）**：完整读取同级 `lyx-review-code/SKILL.md`，再按该 bundle 以 `<change-name>` 执行代码审查（审查主体按 `reviewExecutor` 决定；审查对象为 apply 阶段 commit（带 `Change-Stage: apply` trailer），清零时由循环统一提交修复）。`plan-only` / `off` 时跳过本步（连同第 4 步一并跳过），并打印 `[跳过] review-code（reviewMode=<取值>）` 状态行。
   - 正常清零（Critical 为 0 且所有 `影响落地=是` 的 Warning 都已解决）→ 流水线结束，提示可手动 `@lyx-archive` 归档。
   - 其余任一种终止 → **停止流水线**，复用该循环已产出的终止报告报告终止原因，结束。
6. 流水线执行过程中任一环节 `git commit` 失败：如实报告 Git 原始错误，停止流水线。

### 9. 手动：逐步确认

**审查范围门控（自 add-review-mode 起）**：手动路径的 review-plan 询问 SHALL 由当前宿主 `[host]` 的 `reviewMode` 决定（未配置 / 空白 / 非法取值等价 `full`）——`full` / `plan-only` 照常询问；`code-only` / `off` 不询问（该询问只针对方案审查），propose 阶段 commit 完成后打印 `[跳过] review-plan 询问（reviewMode=<取值>）` 并结束编排。

1. propose 阶段 commit（带 `Change-Stage: propose` trailer）完成后，按 `reviewMode` 分支：
   - **`full` / `plan-only`** → 询问：
     ```
     "要不要现在跑一次 review-plan 审查循环？"
     ```
     询问时 SHALL 附带当前状态摘要：当前阶段（propose 阶段 commit 已完成）与下一步（选"是"将调用 `@lyx-review-plan <change-name>`，审查对象为该 commit），保证选"是"后的续接无歧义。
     - **否** → 编排结束。方案已 commit；日后由用户自行 `@lyx-apply` 实施、`@lyx-review-code` 审查。
     - **是** → 继续步骤 2。
   - **`code-only` / `off`** → 不询问，打印 `[跳过] review-plan 询问（reviewMode=<取值>）` 状态行后结束编排（方案已 commit；日后由用户自行 `@lyx-apply` 实施、`@lyx-review-code` 审查）。
2. 执行 `@lyx-review-plan <change-name>` 编排流程（审查由**单审查 subagent**（非 fork）执行；审查对象为 propose 阶段 commit，清零时由循环统一提交修复）。
3. 循环终止（无论何种原因）后编排结束，**不再询问隔离方式、不再询问提交、不自动衔接 apply**——日后的实施与代码审查由用户另行 `@lyx-apply`、`@lyx-review-code` 触发。

---

隔离方式询问（三选一：隔离 worktree / 本项目切新分支 / 留在当前分支）只发生在步骤 1（创建方案前，全局一次），且仅当当前不在任何 worktree 内时触发。

## 运行账本与证据

### Run State

在 change 确定后创建 `openspec/changes/<change-name>/run-state.md`。读取 `{{LYX_CONFIG_FILE}}` 的 `[general].language`（缺失、空白或非法时按 `zh-CN`）：frontmatter 键名和技术枚举使用固定英文，Markdown 正文按语言配置使用中文或英文。后续阶段续写时沿用正文现有语言，不得无理由切换。

```md
---
lyx:
  schemaVersion: 1
  change: <change-name>
  stage: propose-self-review | propose | review-plan | apply | review-code | archive-ready | archived
  executionMode: full-auto | manual
  pipelineStage: review-plan | apply | review-code | none
  testModeDecision: normal | off | null
  isolation:
    mode: worktree | branch | none
    sourceBranch: <branch> | null
    developmentBranch: <branch> | null
    worktreePath: <absolute-path> | null
  lastGoodCommit: <sha> | null
  completedTasks:
    done: <number>
    total: <number>
  review:
    planRounds: <number>
    codeRounds: <number>
    terminationType: normal | <other> | null
  nextSafeAction:
    command: <command-id> | null
    skillPath: <relative-skill-path> | null
    change: <change-name> | null
    condition: <short-condition> | null
---

# 运行状态

## 任务证据

- 已完成任务: <done>/<total>

## 基线评测

- <skill>: passed|failed|not-executed — <summary>

## 修改后评测（中间）

- <skill>: passed|failed|not-executed — <summary>

## 修改后评测（最终）

- <skill>: passed|failed|not-executed — <summary>

## 审查状态

## 方案自审

- <每条 What Change / 每个 Modified Capability Requirement / 每个通用维度 / 每个核心 task 的四值结论>

## 验证

## 裁决
```

- YAML frontmatter 是阶段、执行模式、测试模式、隔离、commit、任务计数、审查状态和下一步安全动作的唯一机器状态来源；Markdown 正文不得作为这些字段的第二权威来源。正文与 frontmatter 冲突时以 frontmatter 为准，并在报告中记录不一致。
- `context.md` 记录“为什么这样做”，run-state 记录“做到哪、证据是什么、下一步做什么”。
- run-state 作为 change artifact 纳入 propose 阶段 commit，不得用它替代 proposal/design/tasks。
- 任务、阶段和验证后增量更新；尚未归属统一 commit 时，frontmatter `lastGoodCommit` 保持 `null`，Markdown 正文写“待本次阶段提交归属”，不得填不存在的 SHA。
- 执行模式在用户完成全自动/手动选择且 run-state 创建后立即写入 frontmatter；恢复时直接沿用该值，SHALL NOT 重复询问。
- 全自动模式下，`lyx.pipelineStage` 与 `lyx.nextSafeAction` 是阶段报告后的续跑依据。`nextSafeAction` SHALL 写明下一阶段命令、同级 skill 路径、change 参数和继续条件；坐标模糊时，SHALL 从当前阶段和 `reviewMode` 重建后再执行。
- 新 change 的 lyx 状态 SHALL NOT 写入 `.openspec.yaml`。旧 change 没有 YAML frontmatter 时 MAY 只读回退旧 `.openspec.yaml lyx`；frontmatter 存在但损坏、`lyx` 缺失或不是 mapping、`schemaVersion` 缺失或不受支持时 SHALL 停止，不得静默回退。
- 方案自审结论 SHALL 写入正文 `## 方案自审`，作为自审已执行的证据；SHALL NOT 作为独立 assistant 消息发送。
- 阶段正常完成且无未决业务决策时，报告只是中间状态；当前回合 SHALL 完整读取下一阶段同级 `lyx-<next-command>/SKILL.md` 后继续，SHALL NOT 把命令标识或文字说明当作执行。

### Rulings

机械歧义可自行选择并立即记录：

```text
裁决：<选择>；理由：<依据>；如果判断错误：<代价与重做范围>
```

涉及产品语义、公开契约、安全或不可逆操作时停止询问，不得用机械裁决绕过。

### Evidence

完成声明必须引用本轮执行的命令、退出码和结果摘要。字符串测试通过不等于行为评测通过；行为评测未执行时写 `not-executed` 和原因。
