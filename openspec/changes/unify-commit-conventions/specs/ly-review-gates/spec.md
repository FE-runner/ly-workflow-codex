## MODIFIED Requirements

### Requirement: 代码审查读取 git diff 并分级输出发现
`/ly:review-code` 必须（SHALL）以目标 change 的最近一期 apply 阶段 commit 作为审查基线（编排方 `@lyx-apply` 在实施完成后立即提交，commit message 带 `Change-Stage: apply` trailer）：先按目标 change 优先级解析 change（显式参数 → `openspec/changes/` 下唯一未归档 change → 询问用户），再按 `commit-conventions` 的"审查对象定位 = trailer 优先 + 旧前缀兼容通道"取 HEAD 侧最近一期匹配 commit；该 commit 存在时，审查范围 = 该 apply 阶段 commit 的差异（`git show <commit>`）+ 当前 `git diff HEAD` + `git status --porcelain` 过滤出的未跟踪路径清单，工作区/暂存区干净时仍按该 commit 审查，SHALL NOT 报"无变更可审查"。**首轮确定该 commit 后 SHALL 固定该 SHA 作为基线锚点**：后续轮次的工作区/暂存区差异一律以 `git diff <固定SHA>` 计算，SHALL NOT 在循环期间重新执行 trailer/旧前缀定位或重算 HEAD 作基线。该 commit 不存在时，检查最近一期 propose 阶段 commit：存在则审查范围 = 该 propose 阶段 commit 差异 + 当前 `git diff HEAD` + 未跟踪路径清单，工作区/暂存区干净时仍按该 commit 审查；首轮确定后同样固定该 SHA 为基线锚点，后续轮次以 `git diff <固定SHA>` 计算。两者都不存在时退化为"有未提交变更"组合：`git diff HEAD`（覆盖已暂存+未暂存）+ `??` 未跟踪路径清单；仓库零 commit（`git rev-parse HEAD` 失败）则使用三条固定命令组合表达审查范围：`git diff --cached` + `git diff` + `git status --porcelain` 过滤 `??` 得到的未跟踪路径清单，不得尝试执行 `git diff HEAD`、`git diff HEAD~1` 或 `git show HEAD`。仅在既无 apply/propose 阶段 commit、工作区又无任何未提交变更时，命令才报告"无变更可审查"并直接结束。旧前缀通道命中时 SHALL 按 `commit-conventions` 要求打印 DEPRECATED 兼容通道提示。

无论采用上述哪种基线，命令必须（SHALL）额外用 `git status --porcelain` 抓取 `??` 开头的未跟踪文件路径，确保新建但未 `git add` 的文件不被漏审。审查执行方式由「审查关卡以单审查 subagent（非 fork）执行」定义：单审查 subagent 非 fork spawn（只携带 TASK，不携带父线程对话历史），模型按 `codexHost.reviewModel` 配置、未配置或空白时继承当前会话模型，推理档 `reviewReasoningEffort` 非空时随 spawn 传入；`reviewModelB`/`reviewReasoningEffortB` 不再被本命令读取使用；命令 SHALL NOT 使用 `codex exec`、`-m`、`session_id` 或 `resume`。首轮确定的审查范围必须（SHALL）被记录并供首轮 TASK 使用：只传基线引用说明（如"审查 `git show <commit>` 的差异"或三条零 commit 命令组合说明）、未跟踪文件路径清单和该 change 目录下 `context.md` 的路径引用，不把完整 diff 文本拼进 TASK；判定审查范围本身（选哪条分支、取哪个 commit）由当前会话完成，不下放给审查 subagent。第 2 轮起按「审查-修复循环与终止条件（review-code / review-plan 共用）」的增量语义继续，重新 spawn 一个全新审查 subagent（非 fork，TASK 仍按增量语义携带上一轮全部 Critical 逐字原文、路径清单与该 change 目录下 `context.md` 的路径引用）；主会话 SHALL NOT 依赖跨轮续聊（回合结束即失去 subagent 访问）。

命令必须（SHALL）将发现严格分为 Critical、Warning、Info 三个严重度层级。若存在 Critical，命令必须（SHALL）进入审查-修复循环。

#### Scenario: 存在 apply commit 且工作区干净, 仍按该 commit 审查
- **WHEN** 目标 change 存在最近一期 apply 阶段 commit, 当前工作区与暂存区都干净, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = 该 apply 阶段 commit 的差异, 命令按该差异审查并输出分级结果, SHALL NOT 报"无变更可审查"

#### Scenario: 无 apply commit 时退化为 propose commit
- **WHEN** 目标 change 尚无 apply 阶段 commit, 但存在最近一期 propose 阶段 commit, 当前工作区干净, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = 该 propose 阶段 commit 的差异, 命令按该差异审查并输出分级结果, SHALL NOT 回退到任意更早历史 commit

#### Scenario: 仅旧格式 apply commit 时回退并提示
- **WHEN** 目标 change 只有旧格式 `apply: <change-name>` commit, 没有带 `Change-Stage: apply` trailer 的 commit, 用户运行 `/ly:review-code`
- **THEN** 定位方回退旧前缀通道命中该 commit, 并在报告中打印"本次基线来自旧格式 commit，兼容通道已 DEPRECATED"的显式提示, 审查继续执行

#### Scenario: 存在未提交变更且无 Critical
- **WHEN** 目标 change 无相关 apply/propose 阶段 commit, 当前工作区存在未提交变更, 审查 subagent 审查后未发现任何 Critical
- **THEN** 审查范围 = `git diff HEAD` + 未跟踪文件路径清单, 发现按 Critical/Warning/Info 分级输出, 命令直接结束, 不进入修复循环

#### Scenario: 工作区干净但有历史提交, 报告无变更
- **WHEN** 目标 change 既无 apply 阶段 commit 也无 propose 阶段 commit, 仓库有 HEAD 且当前工作区与暂存区都干净, 用户运行 `/ly:review-code`
- **THEN** 命令报告"无变更可审查"并直接结束, SHALL NOT 审查 `git diff HEAD~1` 或 `git show HEAD`

#### Scenario: 已跟踪的修改与新建的未跟踪文件同时存在
- **WHEN** 目标 change 无相关 commit, 工作区既有已跟踪文件的修改, 也有新建的未跟踪文件, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = `git diff HEAD` + 未跟踪文件路径清单; TASK 只包含基线引用说明、未跟踪路径与 context.md 路径引用, 审查 subagent 自行读取实际内容, 未跟踪文件不被静默遗漏

#### Scenario: 仓库尚无任何 commit
- **WHEN** 目标 change 无相关 commit, 且 `git rev-parse HEAD` 失败, 用户运行 `/ly:review-code`
- **THEN** 审查范围用 `git diff --cached` + `git diff` + 未跟踪路径清单三条固定命令表达, 不因缺失 HEAD 报错; TASK 只传命令组合说明, 不由当前会话把内容整段贴入

#### Scenario: 仓库只有一个 commit 且工作区干净
- **WHEN** 目标 change 无相关 apply/propose 阶段 commit, 仓库只有一个不匹配该 change 的历史 commit 且工作区干净, 用户运行 `/ly:review-code`
- **THEN** 命令报告"无变更可审查"并直接结束, SHALL NOT 审查该单个 commit 的完整内容

#### Scenario: 无发现
- **WHEN** 审查 subagent 没有返回任何问题
- **THEN** 命令明确说明未发现问题, 而不是保持沉默

#### Scenario: 首轮 TASK 不预先拼贴完整 diff 文本
- **WHEN** 首轮按某 apply 阶段 commit 确定审查范围, 且该 commit 差异有数百行
- **THEN** 传给审查 subagent 的 TASK 只包含基线引用说明、未跟踪路径清单与 context.md 路径引用, 不包含当前会话预读拼接的完整 diff; 审查 subagent 自行执行对应命令获取实际内容

#### Scenario: 审查模型未配置时回退当前会话模型
- **WHEN** 用户未配置 `codexHost.reviewModel`（或配置为空白）, 然后运行 `/ly:review-code`
- **THEN** 审查 subagent 的模型回退继承当前会话模型; spawn SHALL NOT 携带 shell 层 `-m` 参数

#### Scenario: 推理档未配置时不传; 非空时随对应模型传入
- **WHEN** 用户运行 `/ly:review-code`, `reviewReasoningEffort` 为空白
- **THEN** 审查 subagent 不传推理档参数; `reviewReasoningEffort` 配置为非空（如 `low`）时以其 trim 后原值随 `reviewModel` 传入 `reasoning_effort`, SHALL NOT 使用任何模型名到档位的硬编码映射

#### Scenario: 第 2 轮以 resume 模式续聊同一会话
- **WHEN** `/ly:review-code` 首轮存在未清零 Critical, 循环进入第 2 轮
- **THEN** 第 2 轮重新 spawn 一个全新审查 subagent（非 fork, 只携带 TASK）, TASK 包含上一轮全部 Critical 逐字原文、路径清单与 `context.md` 路径引用; SHALL NOT 构造 shell 层 `codex exec resume <session_id>` 续聊任何旧会话，也不重新拼贴完整基线 diff, 不依赖上一轮 subagent 会话存活

### Requirement: 循环结束后统一提交, `--no-commit` 关闭最终提交
`/ly:review-code` 与 `/ly:review-plan` 默认（不传任何标志）在循环执行期间 SHALL NOT 提交——每一轮修复完成后只运行验证（`/ly:review-code` 为测试/类型检查/构建；`/ly:review-plan` 为 `openspec validate`），不执行 git commit，改动保持在工作区（修复改动一律留在工作区未暂存状态；审查目标本身的原始改动可能已由编排方 `/ly:propose`、`/ly:apply` 暂存，命令 SHALL NOT 主动改变文件的 staged 状态）。仅当循环以"正常清零"结束（某一轮 Critical 数为 0）时，命令必须（SHALL）在输出报告之前对**审查目标全部文件**执行一次统一提交：先 `git add` 审查目标范围内的全部文件（`/ly:review-code` 为审查范围圈定的全部代码文件——原始改动 + 循环期间修复的改动全部暂存；`/ly:review-plan` 为目标 change 目录下的 `proposal.md`/`design.md`/`tasks.md` 及全部 delta spec 文件——含编排方早已暂存的产物与循环期间修复的文件，一并暂存），再执行一次 commit（仅暂存并提交这些文件，不做范围外的 `git add`）。

统一提交的 commit message SHALL 采用 `commit-conventions` 定义的结构：CC 前缀为 `fix(<scope>): <subject>`，subject 含目标标识与总轮次说明（例如"review-plan 反馈修复（2 轮）"），末尾带 trailer——`/ly:review-plan` 用 `Change-Stage: review-plan-fix`，`/ly:review-code` 用 `Change-Stage: review-code-fix`，两者均带 `Change-Name: <change-name>`。

**审查目标原始改动的提交归属**：`/ly:review-code` 的审查目标本身就是"当前工作区尚未提交的变更"（`git diff HEAD` 圈定的范围），这些文件在循环开始前处于未提交状态是设计上的正常输入；同样地，`/ly:review-plan` 的审查目标（该 change 的 artifact 与 delta spec 文件）现在也允许在循环开始前处于未暂存或已暂存状态（`/ly:propose` 编排下产物已暂存、独立运行时可能未暂存）。循环产生的修复是在这份原始改动之上的修正，清零后的统一提交本来就应同时包含"原始改动"与"审查修正"，二者是同一个待提交单元，不需要也不应该被拆开。**因此 `review-plan` 场景下不再存在任何"循环开始前已脏的文件被跳过提交"的隔离逻辑**——propose 产物是合法审查对象不是无关脏文件，用户手工编辑的 artifact 同样属于审查目标内容，一并提交；删除对"循环开始前未提交状态文件"的 `git status --porcelain` 预检查和隔离跳过行为。

若循环全程没有任何 Critical 被认可修复（从未发生实际文件改动），SHALL NOT 创建空 commit。若循环以其余任一终止条件结束（熔断、无法安全修复、验证失败、驳回硬线、审查对象类型持续系统性误判）或达到全局轮数上限，命令 SHALL NOT 提交，已产生的改动保持在工作区未提交状态，交由人工核实后自行决定是否提交——这些场景本身已经需要人工介入，不适合先自动提交半成品。当编排方（`/ly:propose` 或 `/ly:apply`）按自身规则决定对这类非清零终止的改动是否提交（见 `ly-propose-flow`、`ly-lifecycle-commands` 能力中的手动模式询问规则）时，是编排方层面在循环结束后对暂存区做提交决策，SHALL NOT 被理解为 review 循环自身的行为；循环自身的约束始终是"非清零 SHALL NOT 提交"。若"正常清零"后的这次统一提交本身执行失败（Git hook 拒绝、身份未配置、锁文件冲突等），必须（SHALL）在报告中如实说明该失败，视为"循环已清零, 但统一提交失败"的独立结果——循环本身不重新进入下一轮（因为已经清零, 没有下一轮的意义），但报告必须明确指出还需要人工手动完成这次提交。传入可选标志 `--no-commit` 时，命令 SHALL NOT 执行这次最终统一提交（不管循环以何种方式结束），修复结果始终留给调用方或用户自行处理。

#### Scenario: review-plan 场景下, 编排方暂存的产物与循环修复一并统一提交
- **WHEN** `/ly/propose` 将 `openspec/changes/<change-name>/` 下的产物 `git add` 暂存后调用 `/ly:review-plan <change-name>`; 循环期间因某条 Critical 修复了 `design.md` 与一份 delta spec, 最终清零
- **THEN** 清零后的统一提交先 `git add` 该 change 目录下的全部 artifact 与 delta spec 文件（含编排方已暂存的产物与循环的修复改动）, 再执行一次 commit——产物与修复作为同一待提交单元一并提交, 不存在"循环开始前已脏被跳过"的隔离, commit message 带 `Change-Stage: review-plan-fix` trailer

#### Scenario: review-code 场景下, 被审查的原始改动与修复一并提交
- **WHEN** 用户在触发 `/ly:review-code` 前已有未提交的代码改动（这正是本次的审查对象), 循环期间修复了其中一个 Critical 后清零
- **THEN** 统一提交时先把审查范围内全部文件 `git add`（用户原始改动 + 循环期间修复一并暂存）, 再执行 commit——二者作为同一份改动一起提交, 不做隔离——这是 `/ly:review-code` 的正常预期行为, commit message 带 `Change-Stage: review-code-fix` trailer

#### Scenario: 正常清零后统一提交一次
- **WHEN** 用户（或编排该命令的上层流程）执行 `/ly:review-plan <change-name>`（不带任何标志）, 第一轮发现 1 个 Critical 并修复、`openspec validate` 通过, 第二轮 Critical 数为 0
- **THEN** 循环期间（第一轮修复后）不执行任何 commit; 第二轮清零后, 命令 `git add` 该 change 目录全部 artifact 与 delta spec 文件, 在输出报告之前统一提交, 提交信息形如 `fix(openspec): review-plan 反馈修复（1 轮）` 并带 `Change-Stage: review-plan-fix` / `Change-Name: <change-name>` trailer

#### Scenario: 带 --no-commit 时不做最终提交
- **WHEN** 用户执行 `/ly:review-code --no-commit`, 循环修复了若干 Critical 后清零结束
- **THEN** 命令不执行任何 commit（循环期间和清零后都不提交）, 修改的文件保持在工作区未提交状态

#### Scenario: 循环以非清零终止条件结束, 循环自身不提交已产生的改动
- **WHEN** `/ly:review-code` 第一轮修复 1 个 Critical 后, 第二轮审查判定该问题仍存在（触发熔断）
- **THEN** 循环自身不提交第一轮的改动, 已修改的文件保持在工作区未提交状态, 报告中说明需要人工核实是否保留这次修复; 是否提交改由编排方（`/ly:propose`/`/ly:apply` 手动模式）按自身规则询问用户后决定

#### Scenario: 本轮无实际改动, 不创建空 commit
- **WHEN** 循环从未有任何 Critical 被 当前会话 判定为认可（因而从未发生实际文件改动), 最终以某种方式清零或终止
- **THEN** 命令不执行 commit, 不产生空提交

#### Scenario: 清零后的统一提交本身失败
- **WHEN** 循环第二轮清零, 命令尝试执行统一提交, 但因 pre-commit hook 拒绝或 Git 身份未配置导致 commit 失败
- **THEN** 命令不重新进入循环（因为已经清零), 在报告中如实说明这次统一提交失败的原始错误信息, 并指出需要人工手动完成提交
