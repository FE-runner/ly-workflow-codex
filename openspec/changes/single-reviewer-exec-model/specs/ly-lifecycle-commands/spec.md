## MODIFIED Requirements

### Requirement: Explore 命令是纯委托；Apply 由当前会话本人实施完成立即提交；Propose 是编排入口

**实施主体变更（自本 change 起）**：本 Requirement 中 `/ly:apply` 的"由当前会话本人实施"语义 SHALL 依 `ly-propose-flow` 的 MODIFIED Requirement"apply 实施由 coding subagent 执行"（见 `ly-propose-flow` 基线既有 Requirement，本次 delta 为修改而非新增）改写——实施环节由 coding subagent（**非 fork spawn（只携带 TASK）** + 只实施 change 范围 + 经 `context.md` 获取软上下文 + 按 `codexHost.codingModel` 指定模型）执行，主会话保留 git 提交权；本 Requirement 中"无外部委托、无 wrapper 调用"SHALL 解读为"无 wrapper/外部进程调用，subagent 委托除外"。本块场景名沿用历史标签、不作为行为依据，语义以正文为准；涉及 apply 的场景标题中"当前会话本人实施"为历史措辞，实施主体以正文（coding subagent）为准。

`/ly:explore` 必须（SHALL）只调用 `opsx:explore`，原样转发 `$ARGUMENTS`，不得包含自定义的多模型分派、环境校验，或超出底层技能本身的输出后处理逻辑；讨论收敛到"要落地方案"时提示用户切换 `/ly:propose`，explore 本身不接管 artifact 创建。

`/ly:apply` SHALL 在实施**之前**解析目标 change 名：按固定优先级 `$ARGUMENTS` 中显式且合法的 change 名 → `openspec/changes/` 下唯一未归档的 change → 无法唯一确定时直接询问用户。SHALL 由 **coding subagent** 实施：主会话 spawn 一个 coding subagent（非 fork，任务点名"只实施 change 范围"，TASK 指示读取该 change 目录下 `context.md` 获取软上下文），由它读取该 change 的 `tasks.md`，逐任务实施 + 验证（项目对应的测试/类型检查/构建）+ 勾选 checkbox，完成后将改动与结果回传主会话；coding subagent SHALL NOT 自行 commit；实施过程无 wrapper 调用、无 OVERALL 判定解析。SHALL NOT 再执行基于 worktree 的隔离检测——是否隔离由 `/ly:propose` 在创建方案前决定；apply 只负责在**当前工作区**（无论是否 worktree）实施 tasks，SHALL NOT 调用 `/ly:worktree switch`。主会话收到回传并确认后，实施产生实际文件变动时 SHALL `git add` 本次实际改动的文件后**立即 commit**（提交信息 `apply: <change-name>`）；无变动则跳过，SHALL NOT 创建空 commit。该 commit 即为 `/ly:review-code` 的审查对象（见 `ly-propose-flow` 的"审查对象 = 最近一次相关 commit"）。coding subagent 失败区分两阶段：**环境级不可用**（宿主无 subagent 能力、初始 spawn 失败）按 `subagent-agent-config` 的回退口径回退当前会话直接实施，SHALL NOT 视为业务失败；**实施中/验证失败** SHALL 原样呈报失败详情转人工，不自动重试、不切回自实施、不兜底。若 `git commit` 失败，如实报告 Git 返回的原始错误，不重试不兜底。

若实施前工作区已存在该 change 目录之外的未提交改动（如审查修复残留），`/ly:apply` SHALL 先检查 `git status --porcelain`：存在与本次实施无关的预存改动时，`git add` 范围仅限本次实际改动的文件，SHALL NOT 将预存改动一并暂存/提交，并在报告中说明"预存改动未被提交"。

`/ly:archive` 必须（SHALL）调用 `opsx:archive` 并原样转发 `$ARGUMENTS`；归档完成后若 `openspec/` 下存在实际文件变动，SHALL 提交（提交信息形如 `archive: <change-name>`）；无变动或提交本身失败则跳过并如实报告。

`/ly:propose` SHALL NOT 是纯委托——它是本能力集里唯一的编排入口：在调用 `opsx:propose` **之前** SHALL 先执行一次隔离方式询问（三选一：隔离 worktree / 本项目切新分支 / 留在当前分支，见 `worktree-create-before-propose`，仅当不在任何 worktree 内时询问，全局仅一次），再询问一次"本次收尾走全自动还是手动逐步确认"（也仅一次）；委托 `opsx:propose` 完成后 SHALL 先执行方案自审（四项检查 + 逐项结论清单，见 `ly-propose-flow`）与 context.md 产出（见 `review-context-artifact`）再对生成的 artifact `git add` 并**立即 commit**（`propose: <change-name>`），随后按自动/手动两路径分支：全自动路径 SHALL 依次自动调用 `/ly:review-plan <change-name>` → `/ly:apply <change-name>` → `/ly:review-code <change-name>`（任一非清零终止即停，见 `ly-propose-flow`）；手动路径 SHALL 询问一次"要不要跑 review-plan 审查"，选是则调用审查循环，选否则编排结束（方案已 commit）。具体分支细节见 `ly-propose-flow` 能力。

#### Scenario: explore 命令原样转发参数
- **WHEN** 用户运行 `/ly:explore "real-time collaboration"`
- **THEN** 命令以未经改动的参数调用 `opsx:explore` 技能，不附加任何额外步骤

#### Scenario: archive 命令归档后自动提交
- **WHEN** 用户运行 `/ly:archive`，归档移动了 `openspec/changes/<change-name>/` 到 `archive/` 目录
- **THEN** 命令调用 `opsx:archive` 技能完成归档后, 提交 `openspec/` 下的文件移动, 提交信息形如 `archive: <change-name>`

#### Scenario: apply 由当前会话本人实施，完成后立即提交
- **WHEN** 用户运行 `/ly:apply`，coding subagent（非 fork spawn，经 context.md 获取软上下文）读 tasks.md 逐任务实施并验证通过，将改动回传主会话，主会话确认且产生实际文件变动
- **THEN** 主会话 `git add` 本次实际改动的文件后立即 `git commit -m "apply: <change-name>"`，作为 `/ly:review-code` 的审查对象；实施由 coding subagent 执行（见 `ly-propose-flow` 的"apply 实施由 coding subagent 执行"），主会话不自行实施，无 wrapper 调用

#### Scenario: apply 实施前工作区已有与本次无关的预存改动
- **WHEN** 用户在某个 worktree 内运行 `/ly:apply`，实施前该 worktree 已存在未提交的预存改动（如 review 修复残留），coding subagent 实施产生新的实际改动并回传主会话
- **THEN** 主会话 `git add` 仅限本次实际改动的文件，SHALL NOT 将预存改动一并暂存/提交，并说明"预存改动未被提交"

#### Scenario: apply 不在 worktree 内时直接在当前工作区实施
- **WHEN** 用户在主工作区（非 worktree）运行 `/ly:apply`
- **THEN** 命令不询问是否切换 worktree、不调用 `/ly:worktree switch`，直接在当前工作区由 coding subagent 实施 tasks

#### Scenario: apply 无实际文件变动, 跳过提交
- **WHEN** 用户运行 `/ly:apply`，tasks.md 全部任务实施完毕但 `git status --porcelain` 无任何变动
- **THEN** 命令跳过提交, 不创建空 commit

#### Scenario: propose 命令在委托前先问隔离方式再问全自动/手动
- **WHEN** 用户在主工作区运行 `/ly:propose "add dark mode"`（未隔离）
- **THEN** 命令先询问隔离方式三选一；选择"隔离 worktree"则 `git worktree add` 切出并同会话 cd 进 worktree 续跑；选择"本项目切新分支"/"留在当前分支"则按 `worktree-create-before-propose` 处置后，再询问"全自动 or 手动"，随后以原样参数调用 `opsx:propose`；委托完成后先方案自审，再 `git add` 该 change 目录并立即 commit `propose: <change-name>`

#### Scenario: propose 命令全自动路径下的编排
- **WHEN** 用户运行 `/ly:propose`，选择"全自动"，`propose:` commit 完成
- **THEN** 命令自动调用 `/ly:review-plan`（审查对象为 `propose:` commit，按 `ly-review-gates` 的单审查 subagent（非 fork）机制执行，清零时由循环统一提交修复）；清零后自动进入 `/ly:apply`（coding subagent 实施、主会话确认后立即 commit，见 `ly-propose-flow`）→ 自动进入 `/ly:review-code`（审查对象为 `apply:` commit，同样按单审查 subagent（非 fork）机制执行）；任一环节非清零终止则停止流水线并报告；全程无 worktree 询问、无 `/ly:worktree switch` 调用，不自动归档
