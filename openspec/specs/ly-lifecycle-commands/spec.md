## Purpose

提供五个统一前缀的 `/ly:*` 命令：`explore` 是纯委托（不附加自定义编排逻辑）；`init`/`archive` 各自在 OpenSpec 原生 `init`/`archive` 能力前后串接文件生成与自动提交（`apply` 由当前会话本人实施 tasks，实施完成后立即提交 apply 阶段 commit（CC 前缀 + `Change-Stage: apply` trailer）——无隔离检测、无外部委托，隔离 worktree 由 `/ly:propose` 创建方案前决定）；`propose` 是收尾编排的入口——委托 `opsx:propose` 生成方案之外，还负责创建方案前的隔离方式三选一询问、全自动/手动询问、方案自审、每步 commit（CC 前缀 + `Change-Stage`/`Change-Name` trailer）与全自动流水线（review-plan → apply → review-code）。

## Requirements

### Requirement: init 命令串联 AGENTS.md 生成、OpenSpec 初始化与提交
`/ly:init` 必须（SHALL）按顺序执行三步：（1）由当前会话直接生成/更新项目根目录的 `AGENTS.md`（codex 单 Agent 模式，无外部技能委托）：以 `$ARGUMENTS` 为线索结合当前仓库结构，写清模块职责、入口与启动方式、核心类型、构建/测试命令、关键约定；已存在时增量更新，不推翻既有内容；（2）复用与 `lycx init` / `lycx doctor` 相同的 OpenSpec 依赖检查模型，检查 CLI、skills 与 OpenSpec root，并执行项目级修复：CLI 缺失时先安装 `@fission-ai/openspec@latest`；root 缺失时运行 `openspec init --tools codex`；root 存在但 skills 为 `missing` 时运行 `openspec update --force`（必要时回退 `openspec init --tools codex`）；仅全局可用时输出 WARN 并继续，不自动固化项目级；修复后复查，若 root 仍不健康或 required skills 仍缺失则停止并报告 `openspec doctor --json` / 缺失清单；（3）若步骤 1-2 产生了实际文件变动，暂存 `AGENTS.md`、`openspec/` 并执行一次 commit。前两步都不得静默跳过；如果 `openspec` CLI 未安装，命令必须先安装它再继续。第三步若无可提交内容或 `git commit` 本身失败，SHALL 跳过提交并在汇总中如实报告，SHALL NOT 因此中断或视为命令失败。

#### Scenario: 全新项目, 既无 AGENTS.md 也无 openspec/ 目录
- **WHEN** 用户在既无 AGENTS.md 也无 `openspec/` 目录的项目中运行 `/ly:init`
- **THEN** 命令由当前会话直接生成 AGENTS.md，通过共享检查器确认 CLI 可用后运行 `openspec init --tools codex` 初始化 `openspec/` 与项目级 skills，复查通过后提交这两部分产物

#### Scenario: openspec CLI 未安装
- **WHEN** 用户运行 `/ly:init` 且 PATH 中找不到 `openspec` 命令
- **THEN** 命令先全局安装 `@fission-ai/openspec`，再通过共享检查器确认 CLI 可用，随后运行 `openspec init --tools codex`，完成后提交产物

#### Scenario: 仅全局 skills 可用时 WARN 并继续
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但 required skills 仅能在全局 `~/.agents/skills` 或 `~/.codex/skills` 中可发现
- **THEN** 命令输出 `global-only` WARN，说明命令可用但未固化到当前项目，然后继续后续步骤，SHALL NOT 自动运行 `openspec update --force`

#### Scenario: 必需 skills 缺失时修复
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但某个 required skill 在项目级与全局级均缺失
- **THEN** 命令运行 `openspec update --force` 修复；若仍缺失则回退 `openspec init --tools codex`；复查仍失败时停止并输出缺失 skill 清单

#### Scenario: OpenSpec root 不健康时阻断
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 required skills 可用，但 `openspec doctor --json` 返回 root 不健康
- **THEN** 命令输出 `openspec doctor --json` 的错误状态与 fix 建议，停止初始化提交步骤，SHALL NOT 将不健康状态静默通过

#### Scenario: init 无新变动, 跳过提交
- **WHEN** 用户在 AGENTS.md 与 `openspec/` 均已存在且未发生变化，且共享 OpenSpec 依赖检查通过的项目中运行 `/ly:init`
- **THEN** 命令跳过 commit 步骤，在汇总中如实说明无变动可提交，不视为失败

### Requirement: Explore 命令是纯委托；Apply 由当前会话本人实施完成立即提交；Propose 是编排入口

**实施主体变更（自本 change 起）**：本 Requirement 标题中"Apply 由当前会话本人实施"为历史措辞——自 `switchable-executor-flow` 起，`@lyx-apply` 的实施主体由 `[codexHost] codingExecutor` 决定：`"subagent"`（显式配置）时由 coding subagent 实施，`"main"`（默认，含未配置）时由主 agent 在当前会话直接实施。语义以正文为准。

`/ly:explore` 必须（SHALL）只调用 `opsx:explore`，原样转发 `$ARGUMENTS`，不得包含自定义的多模型分派、环境校验，或超出底层技能本身的输出后处理逻辑；讨论收敛到"要落地方案"时提示用户切换 `/ly:propose`，explore 本身不接管 artifact 创建。

`/ly:apply` SHALL 在实施**之前**解析目标 change 名：按固定优先级 `$ARGUMENTS` 中显式且合法的 change 名 → `openspec/changes/` 下唯一未归档的 change → 无法唯一确定时直接询问用户。

**执行者分支（自本 change 起）**：`/ly:apply` SHALL 读取 `~/.codex/lyx/config.toml` 的 `[codexHost] codingExecutor`，按取值决定实施主体：

- **`"subagent"`**：主会话 spawn 一个 coding subagent（非 fork，任务点名"只实施 change 范围"，TASK 指示读取该 change 目录下 `context.md` 获取软上下文；模型按 `codingModel`、非空推理档按 `codingReasoningEffort` 传入），由它读取该 change 的 `tasks.md` 逐任务实施 + 验证（项目对应的测试/类型检查/构建）+ 勾选 checkbox，完成后将改动与结果回传主会话；coding subagent SHALL NOT 自行 commit。失败区分两阶段：**环境级不可用**（宿主无 subagent 能力、初始 spawn 失败）按 `subagent-agent-config` 的回退口径回退主 agent 直接实施并输出 `[回退] subagent 不可用: <原始报错>`，SHALL NOT 视为业务失败；**实施中/验证失败** SHALL 原样呈报失败详情转人工，不自动重试、不自动兜底。
- **`"main"`（默认，含未配置）**：主 agent SHALL 在当前会话直接实施——读取该 change 的 `tasks.md` 逐任务实施 + 验证（项目对应的测试/类型检查/构建）+ 勾选 checkbox；SHALL NOT spawn 子代理、SHALL NOT 读取 `codingModel` / `codingReasoningEffort`、SHALL NOT 产生回退标记。

两条路径共同遵守：实施过程 SHALL NOT 有 wrapper 调用、SHALL NOT 有 OVERALL 判定解析；SHALL NOT 再执行基于 worktree 的隔离检测——是否隔离由 `/ly:propose` 在创建方案前决定；apply 只负责在**当前工作区**（无论是否 worktree）实施 tasks，SHALL NOT 调用 `/ly:worktree switch`。

主会话（无论哪条执行者路径）收到结果并确认后，实施产生实际文件变动时 SHALL 按 `commit-conventions` 的"propose / apply 共用提交范围隔离协议"提交：先 `git add` 本次实际改动文件清单，提交前按共用协议处理范围外 staged 内容（`--only` 隔离或 unstage-提交-恢复；同一文件内混合 hunk 不可分离时停止转人工），提交后以 `git show --name-only` 校验文件集合严格等于本次待提交清单。commit message SHALL 采用 `<cc-type>(<scope>): <subject>` + `Change-Stage: apply` + `Change-Name: <change-name>` trailer 结构，CC type 由主会话按本次实际改动判断（`feat` / `fix` / `refactor` 等），SHALL NOT 固定为某个 type；无变动则跳过，SHALL NOT 创建空 commit。该 commit 即为 `/ly:review-code` 的审查对象（见 `ly-propose-flow` 的"审查对象 = 最近一次相关 commit"，定位见 `commit-conventions`）。若 `git commit` 失败，如实报告 Git 返回的原始错误，不重试不兜底。

若实施前工作区已存在该 change 目录之外的未提交改动（如审查修复残留），`/ly:apply` SHALL 先检查 `git status --porcelain`：存在与本次实施无关的预存改动时，`git add` 范围仅限本次实际改动的文件，SHALL NOT 将预存改动一并暂存/提交，并在报告中说明"预存改动未被提交"。

`/ly:archive` SHALL **先执行归档前完整验证**（见 `archive-verification-gate`：测试 / 类型检查 / 构建，按项目实际提供的脚本选择、缺失项跳过并注明），全部通过后才调用 `opsx:archive` 并原样转发 `$ARGUMENTS`；归档完成后若 `openspec/` 下存在实际文件变动，SHALL 提交（commit message 采用 `chore(openspec): <subject>` + `Change-Stage: archive` + `Change-Name: <change-name>` trailer 结构）；无变动或提交本身失败则跳过并如实报告。验证失败 SHALL 停止归档，SHALL NOT 移动 `openspec/changes/<change-name>/`，并如实报告失败的脚本与原始错误输出。

`/ly:propose` SHALL NOT 是纯委托——它是本能力集里唯一的编排入口：在调用 `opsx:propose` **之前** SHALL 先执行一次隔离方式询问（三选一：隔离 worktree / 本项目切新分支 / 留在当前分支，见 `worktree-create-before-propose`，仅当不在任何 worktree 内时询问，全局仅一次），再询问一次"本次收尾走全自动还是手动逐步确认"（也仅一次）；委托 `opsx:propose` 完成后 SHALL 先执行方案自审（四项检查 + 逐项结论清单，见 `ly-propose-flow`）与 context.md 产出（见 `review-context-artifact`）再对生成的 artifact `git add` 并**立即 commit**（message 采用 `docs(openspec): <subject>` + `Change-Stage: propose` + `Change-Name: <change-name>` trailer 结构），随后按自动/手动两路径分支：全自动路径 SHALL 依次自动调用 `/ly:review-plan <change-name>` → `/ly:apply <change-name>` → `/ly:review-code <change-name>`（任一非清零终止即停，见 `ly-propose-flow`）；手动路径 SHALL 询问一次"要不要跑 review-plan 审查"，选是则调用审查循环，选否则编排结束（方案已 commit）。具体分支细节见 `ly-propose-flow` 能力。

#### Scenario: explore 命令原样转发参数
- **WHEN** 用户运行 `/ly:explore "real-time collaboration"`
- **THEN** 命令以未经改动的参数调用 `opsx:explore` 技能，不附加任何额外步骤

#### Scenario: archive 命令归档后自动提交
- **WHEN** 用户运行 `/ly:archive`，项目完整验证全部通过，归档移动了 `openspec/changes/<change-name>/` 到 `archive/` 目录
- **THEN** 命令在归档前执行完整验证，通过后调用 `opsx:archive` 完成归档，并提交 `openspec/` 下的文件移动，commit message 带 `Change-Stage: archive` trailer

#### Scenario: archive 归档前验证失败阻断归档
- **WHEN** 用户运行 `/ly:archive`，测试脚本执行失败
- **THEN** 命令停止归档，SHALL NOT 移动 change 目录，如实报告失败的脚本与原始错误输出

#### Scenario: apply 由当前会话本人实施，完成后立即提交
- **WHEN** 用户运行 `/ly:apply`，未配置 `codingExecutor`（等价 `main`），主 agent 读 tasks.md 逐任务实施并验证通过，产生实际文件变动
- **THEN** 主 agent 按共用隔离协议 `git add` 本次实际改动的文件后立即提交，message 采用 CC 前缀 + `Change-Stage: apply` trailer（type 由实际改动判断），作为 `/ly:review-code` 的审查对象；实施不 spawn 子代理、不产生回退标记

#### Scenario: apply 配置为 subagent 时由 coding subagent 实施
- **WHEN** 用户配置 `codingExecutor = "subagent"` 运行 `/ly:apply`，coding subagent（非 fork spawn，经 context.md 获取软上下文）读 tasks.md 逐任务实施并验证通过，将改动回传主会话
- **THEN** 主会话确认后按共用隔离协议提交本次实际改动的文件，message 带 `Change-Stage: apply` trailer；coding subagent 不自行 commit

#### Scenario: apply 实施前工作区已有与本次无关的预存改动
- **WHEN** 用户在某个 worktree 内运行 `/ly:apply`，实施前该 worktree 已存在未提交的预存改动（如审查修复残留），实施产生新的实际改动
- **THEN** 主会话 `git add` 仅限本次实际改动的文件，SHALL NOT 将预存改动一并暂存/提交，并说明"预存改动未被提交"

#### Scenario: apply 不在 worktree 内时直接在当前工作区实施
- **WHEN** 用户在主工作区（非 worktree）运行 `/ly:apply`
- **THEN** 命令不询问是否切换 worktree、不调用 `/ly:worktree switch`，直接在当前工作区按执行者字段实施 tasks

#### Scenario: apply 无实际文件变动, 跳过提交
- **WHEN** 用户运行 `/ly:apply`，tasks.md 全部任务实施完毕但 `git status --porcelain` 无任何变动
- **THEN** 命令跳过提交, 不创建空 commit

#### Scenario: propose 命令在委托前先问隔离方式再问全自动/手动
- **WHEN** 用户在主工作区运行 `/ly:propose "add dark mode"`（未隔离）
- **THEN** 命令先询问隔离方式三选一；选择"隔离 worktree"则 `git worktree add` 切出并同会话 cd 进 worktree 续跑；选择"本项目切新分支"/"留在当前分支"则按 `worktree-create-before-propose` 处置后，再询问"全自动 or 手动"，随后以原样参数调用 `opsx:propose`；委托完成后先方案自审，再 `git add` 该 change 目录并立即提交，message 带 `Change-Stage: propose` trailer

#### Scenario: propose 命令全自动路径下的编排
- **WHEN** 用户运行 `/ly:propose`，选择"全自动"，propose 阶段 commit 完成
- **THEN** 命令自动调用 `/ly:review-plan`（审查对象为 propose 阶段 commit，按 `ly-review-gates` 的执行者语义执行，清零时由循环统一提交修复）；清零后自动进入 `/ly:apply`（按 `codingExecutor` 决定实施主体）→ 自动进入 `/ly:review-code`（审查对象为 apply 阶段 commit）；任一环节非清零终止则停止流水线并报告；全程无 worktree 询问、无 `/ly:worktree switch` 调用，不自动归档

