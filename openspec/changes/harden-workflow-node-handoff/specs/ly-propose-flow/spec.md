## MODIFIED Requirements

### Requirement: 全自动路径 = 自动流水线直到审完代码

当且仅当用户在开始时选择"全自动"，`/ly:propose` SHALL 在 `propose:` commit 完成后自动按序执行：

1. 自动调用 `/ly:review-plan <change-name>`（审查对象为 `propose:` commit；按 `ly-review-gates` 的双审查 subagent 机制执行）。以 Critical 清零结束时自动进入下一步；以其余任一种终止（熔断、分歧未决、无法安全修复、验证失败、审查调用失败、提交失败、达到全局轮数上限）时，SHALL 停止流水线，复用该循环已产出的终止报告（SHALL NOT 重新生成或重复一份）报告终止原因，SHALL NOT 继续执行 apply。
2. **节点前置校验（进入 apply 前）**：进入 apply 之前 SHALL 校验 review-plan 是否以"正常清零结束"收尾——清零报告（含"总轮次"与"提交"条目）已产出且无未决人工介入项。校验通过才自动进入 `/ly:apply <change-name>`；校验不过（无清零报告、或终止报告仍在、或存在未决项）SHALL 停在该节点，复用 review-plan 已产出的报告说明阻断原因，SHALL NOT 硬闯 apply。
3. **节点前置校验（进入 review-code 前）**：apply 实施完成并提交后，进入 `/ly:review-code <change-name>` 之前 SHALL 校验 `apply: <change-name>` commit 已存在（`git log --grep="^apply: <change-name>"` HEAD 侧最近一期匹配非空）。校验不过（commit 缺失或实施阶段未正常收尾）SHALL 停在该节点如实报告，SHALL NOT 硬闯 review-code。
4. 自动进入 `/ly:review-code <change-name>`（审查对象为 `apply:` commit；同样按双审查 subagent 机制执行）。以 Critical 清零结束；以其余任一种终止时，SHALL 停止流水线，报告终止原因。

流水线执行过程中 SHALL NOT 出现任何 worktree 询问或 `/ly:worktree switch` 调用；`/ly:archive` SHALL 仍由用户手动触发，propose 不自动归档。

#### Change: 在第 2 项与第 3 项补充"进入下一阶段前的节点前置校验"，校验不过停在该节点报告，不硬闯。

#### Scenario: 全自动流水线走到审完代码
- **WHEN** 用户执行 `/ly:propose` 选择"全自动"，`propose:` 提交完成，review-plan 首轮清零（清零报告存在），apply 实施完成并 commit（`apply:` commit 存在），review-code 清零
- **THEN** 命令连续自动执行 review-plan → apply → review-code，中途无 worktree 询问、无 switch 调用、无"要不要继续"询问；审完代码后结束，未自动执行 archive

#### Scenario: 全自动路径下 review-plan 非清零终止即停
- **WHEN** 全自动路径下 `/ly:review-plan` 的审查-修复循环因熔断或分歧未决等任一原因停止
- **THEN** 命令停止流水线，复用该循环已产出的终止报告报告原因，SHALL NOT 自动进入 apply；apply 的前置校验亦因清零报告缺失而阻断

#### Scenario: apply commit 缺失时停在节点
- **WHEN** apply 实施阶段未正常收尾（coding subagent 报告失败，主会话未提交 `apply:` commit），流水线尝试进入 review-code
- **THEN** 前置校验发现 `apply:` commit 不存在，命令停在该节点如实报告实施失败详情，SHALL NOT 进入 review-code


#### Scenario: 手动路径下选跑审查且清零后不再问 worktree
- **WHEN** 手动路径下用户对"是否跑 review-plan"选"是"，`/ly:review-plan` 清零（统一提交修复），随后 apply/review-code 也清零
- **THEN** 全程只在创建方案前问过 worktree，审查清零后不再出现任何 worktree 询问、不自动 archive


#### Scenario: 全自动路径下 review-code 非清零终止即停
- **WHEN** 全自动路径下实施完成后 `/ly:review-code` 的审查-修复循环非清零终止
- **THEN** 命令停止，报告终止原因，不再继续；未自动归档

### Requirement: 手动路径下询问是否要跑 review-plan，且全程不再问 worktree

`/ly:propose` 在"手动"路径下，`propose:` commit 完成后，SHALL 询问用户是否要现在跑一次 `/ly:review-plan <change-name>` 审查循环。询问时 SHALL 附带当前状态摘要：当前阶段（`propose: <change-name>` commit 已完成）与下一步（将调用 `@lyx-review-plan <change-name>`，审查对象为该 commit），保证用户选"是"后的续接无歧义。用户选"否"则编排到此结束（方案已 commit，apply/review-code 由用户日后另行 `/ly:apply`/`/ly:review-code` 触发）。用户选"是"则 SHALL 调用 `/ly:review-plan <change-name>`（审查对象为 `propose:` commit，清零时由循环统一提交修复，规则与全自动路径一致），循环清零或非清零终止后编排结束，SHALL NOT 自动衔接 apply（apply/review-code 由用户另行触发），全程 SHALL NOT 出现 worktree 询问或 `/ly:worktree switch` 调用。

#### Change: 询问时补充"当前阶段 + 下一步"状态摘要，作为断链后人工续接的最小落点。

#### Scenario: 手动路径下选择跑审查
- **WHEN** 手动路径下用户对"是否要跑 review-plan 审查"选择"是"
- **THEN** 命令调用 `/ly:review-plan <change-name>`，审查对象是 `propose:` commit；清零时循环统一提交修复，不出现在循环外的提交/worktree 询问；询问时已展示当前阶段与下一步摘要


#### Scenario: 手动路径下选择不跑审查
- **WHEN** 手动路径下用户对"是否要跑 review-plan 审查"选择"否"
- **THEN** 命令结束编排，方案已由 `propose:` commit 落库，不再询问提交或 worktree

### Requirement: 审查对象 = 最近一次相关 commit（review-plan / review-code 一致处理）

`/ly:review-plan` SHALL 以目标 change 对应的最近一期 `propose:` commit 作为审查基线；`/ly:review-code` SHALL 以最近一期 `apply:` commit 作为审查基线。**首轮确定基线后 SHALL 固定该 commit SHA，作为本轮命令执行的审查基线锚点**：后续轮次的工作区/暂存区差异一律以该固定基线为参照计算，SHALL NOT 在循环期间重新执行 `git log --grep` 或重算 HEAD 作为基线（除非基线 commit 因异常被回滚/丢失，此时才重新定位并如实报告）。两者一致处理：审查范围 = 该相关 commit 的改动（`git show <commit>` 获取其差异），加上当前工作区/暂存区中尚未提交的修复改动（`git diff <固定基线>` + 未跟踪文件清单）——修复在审查-修复循环内保持"结束时统一提交"（见 `ly-review-gates`），因此审查期间新修复未提交时不丢失它们。若该相关 commit 不存在（如零 commit 仓库、审查时尚未产生 apply commit），SHALL 退化为现状 `git diff HEAD` + 未跟踪清单组合。

"最近一期相关 commit"的定位规约：优先按 commit message 前缀定位——`review-plan` 用 `git log --grep="^propose: <change-name>"`、`review-code` 用 `git log --grep="^apply: <change-name>"`，各自取 HEAD 侧最近一期匹配 commit；二者并列采用，针对 review-code 场景（apply 改动集中在 `templates/`/`src/` 等源码目录而非 change 目录），SHALL NOT 以"在 change 目录内枚举 commit"作为 review-code 的定位手段。多个 change 并存、中间穿插其他 commit（如其他 change 产物或修复）时，`git show <commit>` 展示该 commit 自身差异、`git diff <固定基线>` 覆盖工作区/暂存区的最新状态，不要求基线等于 HEAD。审查期间新产生的未提交修复（修复循环内）始终计入审查范围，不在中途产生新 commit（见 `ly-review-gates` 的"结束时统一提交"）。

#### Change: 基线锚定——首轮确定 commit 后固定为审查基线锚点，后续轮次以固定基线 + 工作区现状计算范围，不每轮重算。

#### Scenario: 循环第二轮不重算基线
- **WHEN** `/ly:review-plan` 首轮确定 `propose:` commit 为基线，第一轮修复未提交，第二轮审查启动
- **THEN** 第二轮审查范围仍以首轮固定的基线 commit 差异 + `git diff <固定基线>` + 未跟踪清单计算，不重新执行 `git log --grep` 定位


#### Scenario: review-plan 审查 propose commit
- **WHEN** `/ly:propose` 已 commit `propose: <change>` 后调用 `/ly:review-plan <change>`
- **THEN** 审查范围取该 `propose:` commit 的差异并把未提交修复计入，修复循环结束统一提交


#### Scenario: review-code 审查 apply commit
- **WHEN** `/ly:apply` 已 commit `apply: <change>` 后调用 `/ly:review-code <change>`
- **THEN** 审查范围取该 `apply:` commit 的差异并把未提交修复计入，修复循环结束统一提交


#### Scenario: 该相关 commit 不存在时退化为未提交 diff
- **WHEN** 仓库零 commit，或审查时目标 change 最近一期相关 commit（`propose:`/`apply:`）尚不存在
- **THEN** 审查范围退化为 `git diff HEAD` + 未跟踪文件清单的现状组合


#### Scenario: 提交的相关 commit 存在但工作区干净，仍按相关 commit 审查
- **WHEN** `apply:`/`propose:` commit 已存在、当前工作区/暂存区完全干净（无未提交改动）
- **THEN** 审查对象仍是该相关 commit 的差异（`git show <commit>`），SHALL NOT 报"无变更可审查"

### Requirement: apply 实施由 coding subagent 执行

`@lyx-apply` 的实施环节 SHALL 由 coding subagent 执行：主会话 spawn 一个 coding subagent，fork 当前会话上下文，并在任务中点名"只实施 change 范围"（读取 `openspec/changes/<change-name>/tasks.md` 逐任务实施 + 验证 + 勾选，SHALL NOT 改动范围外文件）。模型 SHALL 按 `codexHost.codingModel` 指定，未配置回退当前会话模型。spawn 后主会话 SHALL 在本轮内等待 coding subagent 返回结果（wait），收到结果先逐字转达再确认，SHALL NOT 以自然语言描述"已分发/将分发"代替实际 spawn 与等待。coding subagent SHALL NOT 自行 commit：实施完成后将改动与结果回传主会话。主会话确认阶段 SHALL 用 `git status --porcelain` 抓取实际改动清单，与 coding subagent 回传的改动文件清单比对：不一致（回传清单外存在改动、或回传文件实际未变动）SHALL 停止并报告差异，不照单全收；一致才统一 `git commit -m "apply: <change-name>"`。失败区分两阶段：**环境级不可用**（宿主无 subagent 能力、初始 spawn 失败）按 `subagent-agent-config` 的回退口径回退当前会话直接实施（输出显式状态标记 `[回退] subagent 不可用: <原始报错>`），SHALL NOT 视为业务失败；**实施中/验证失败**（coding subagent 报告任务未完成或验证失败）SHALL 原样呈报转人工，不自动重试、不切回自实施、不自动兜底。

#### Change: 补充轮内 wait、回传文件清单与 `git status --porcelain` 比对、回退显式状态标记。

#### Scenario: coding subagent 完成实施
- **WHEN** coding subagent 读 tasks.md 完成全部任务并验证通过
- **THEN** 改动回传主会话；主会话核对 `git status --porcelain` 与回传清单一致后提交 `apply: <change-name>`，作为 `@lyx-review-code` 的审查对象

#### Scenario: 回传清单与工作区实际改动不一致
- **WHEN** coding subagent 回传的改动文件清单遗漏了实际改动文件（如漏列 `templates/skills-codex/review-plan.md`）
- **THEN** 主会话比对发现差异，停止该节点，逐项列出差异文件并报告，不执行 commit，转人工确认


#### Scenario: coding subagent 实施失败
- **WHEN** coding subagent 报告任务未完成或验证失败
- **THEN** 主会话原样呈报失败详情转人工，不自动重试、不切回自实施、不 commit
