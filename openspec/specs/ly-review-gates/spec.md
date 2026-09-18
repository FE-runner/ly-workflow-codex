## Purpose

提供两个审查关卡：一个用于在实施前审查 OpenSpec change 的方案，一个用于在实施后审查代码变更。审查主体由 `[codexHost]` 的 `reviewExecutor` 决定——未配置、空白或非法取值等价 `main`（主 agent 直接审查，无逐条裁决与驳回硬线，自审循环最多 2 轮）；`subagent` 时 spawn 1 个审查 subagent（非 fork），模型经 `reviewModel` 与对应推理档字段 `reviewReasoningEffort` 落实。两个命令都支持审查-修复循环，直到 Critical 清零或触发终止条件。

## Requirements

### Requirement: 方案审查解析目标 change 且排除已归档项
`/ly:review-plan` 必须（SHALL）按以下优先级解析目标 change：（1）通过 `$ARGUMENTS` 传入的显式 change 名称；（2）若未指定, 且 `openspec/changes/` 下恰好只有一个 change 目录时, 使用该目录；（3）若存在多个 change 目录且未指定, 询问用户要审查哪一个。枚举候选目录时必须（SHALL）排除 `openspec/changes/archive/` 目录及其内容——已归档的 change 不是可选目标。解析完成后, 必须（SHALL）读取该 change 的 `proposal.md`、`design.md`、`tasks.md`（存在的部分）作为审查对象。审查的调用构造（角色提示词、后端选择、TASK 内容构造方式）统一由「方案审查分级输出发现」一条定义, 本条 SHALL NOT 重复定义另一套调用构造（基线中"以 `reviewer.md` 角色提示词合并内容调用"的描述与本能力内「方案审查分级输出发现」的 `plan-reviewer.md` + 路径清单构造互斥, 以后者为准, 前者随本条修改一并废止）。审查必须聚焦方案的合理性——遗漏的边界情况、范围不清晰、风险点——而非逐行代码风格。

#### Scenario: change 有 proposal 和 tasks 但没有 design
- **WHEN** 用户对一个有 `proposal.md` 和 `tasks.md` 但没有 `design.md` 的 change 运行 `/ly:review-plan`
- **THEN** 命令审查现有的工件, 不因缺失 `design.md` 而报错

#### Scenario: 不存在活跃 change
- **WHEN** 用户运行 `/ly:review-plan` 且无法解析出任何 change 目录
- **THEN** 命令询问用户要审查哪个 change, 而不是凭空猜测

#### Scenario: 存在多个 change 且未显式指定
- **WHEN** 用户不带参数运行 `/ly:review-plan`, 且 `openspec/changes/` 下存在多个非归档的 change 目录
- **THEN** 命令询问用户要审查哪一个, 而不是任意挑一个

#### Scenario: 显式指定了 change 名称
- **WHEN** 用户运行 `/ly:review-plan <change-name>`
- **THEN** 命令直接审查该指定 change 目录, 不再询问用户消歧

#### Scenario: 只剩已归档的 change
- **WHEN** 用户不带参数运行 `/ly:review-plan`, `openspec/changes/` 下有一个活跃 change 和一个存放历史归档 change 的 `archive/` 目录
- **THEN** `archive/` 目录及其内容被排除在候选解析之外, 因此那个唯一的活跃 change 被直接选中, 不触发消歧询问

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

### Requirement: 方案审查分级输出发现

`/ly:review-plan` 必须（SHALL）读取目标 change 的 `proposal.md`/`design.md`/`tasks.md`（存在的部分即可, 缺失容错跳过）以及该 change 目录下 `specs/**/*.md` 的全部 delta spec 文件（若存在；不存在则容错跳过, 不报错）的路径, spawn 一个非 fork 审查 subagent 执行审查, 并将发现分为 Critical、Warning、Info 三个严重度层级。审查执行方式由「审查关卡以单审查 subagent（非 fork）执行」定义：模型按 `codexHost.reviewModel` 配置、未配置或空白时继承当前会话模型, 推理档 `reviewReasoningEffort` 非空时随 spawn 传入；`reviewModelB`/`reviewReasoningEffortB` 不再被本命令读取使用；命令 SHALL NOT 使用 `codex exec`、`-m`、`session_id` 或 `resume`。审查 subagent 的任务 SHALL 先指示读取 ROLE_FILE `~/.codex/lyx/prompts/codex/plan-reviewer.md`（角色词内容不重写）, 再给出路径清单与该 change 目录下 `context.md` 的路径引用。**首轮**只传该 change 目录路径和 `proposal.md`/`design.md`/`tasks.md`/全部 delta spec 文件路径清单, 不预先读取并拼贴文件全文；若某份 delta spec 显式引用了基线 spec 中未被本次修改的既有 Requirement, 命令必须（SHALL）额外把对应基线 spec 路径纳入清单, 并在 TASK 中说明该路径仅作审查上下文、不属于修复对象。审查必须（SHALL）聚焦方案文档本身的逻辑缺陷：遗漏边界、范围不清晰、`proposal.md`/`design.md`/`tasks.md`/对应 spec 互相矛盾或脱节、风险点交代不清、spec 的 Requirement/Scenario 未覆盖 proposal 的 What Changes。SHALL NOT 将"代码库尚未实现某方案条目"或"`tasks.md` 中某任务未勾选"作为 Critical 依据。若存在 Critical, 命令必须（SHALL）进入审查-修复循环。

"spec 未覆盖 What Changes"检查必须（SHALL）区分两种"该 change 没有 delta spec 文件"的情形：（a）`proposal.md` 的 Capabilities 段落未声明任何 New/Modified Capability（纯重构/工具/文档类变更, 通常配合 `skip_specs: true`）——此时没有 delta spec 属正常, SHALL NOT 报 Critical；（b）`proposal.md` 声明了至少一个 New/Modified Capability, 但该 change 目录下完全没有任何 delta spec 文件——此时命令必须（SHALL）报告 Critical, 指出"proposal 声明了 capability 变更但没有任何 delta spec 覆盖"；若 `skip_specs: true` 同时存在, 额外指出这是 `skip_specs` 使用不当。

#### Scenario: 无 Critical
- **WHEN** 用户运行 `/ly:review-plan`, 审查 subagent 未发现任何 Critical（可能有 Warning/Info）
- **THEN** 发现按 Critical/Warning/Info 分级输出, 命令直接结束, 不进入修复循环

#### Scenario: 无任何发现
- **WHEN** 审查 subagent 对 proposal/design/tasks/specs 没有返回任何问题
- **THEN** 命令明确说明"方案审查未发现问题", 而不是保持沉默

#### Scenario: 多个候选 change 且未指定
- **WHEN** 用户运行 `/ly:review-plan` 且未指定 change 名, `openspec/changes/` 下（排除 `archive/`）存在多个候选
- **THEN** 命令询问用户选择哪个 change, 不猜测

#### Scenario: 方案条目未实现不构成 Critical
- **WHEN** 某 change 的 `tasks.md` 里存在多个未勾选任务（对应代码库尚未实现该功能）, 审查 subagent 依据 `plan-reviewer.md` 审查该 change
- **THEN** 未勾选任务、代码库尚未实现的方案条目均不作为 Critical; 审查只针对方案文档本身的逻辑缺陷

#### Scenario: spec 未覆盖 proposal 的 What Changes, 审查子会话自行读取 delta spec 内容后判定
- **WHEN** 某 change 的 `proposal.md` 的 What Changes 提到某项新行为, 该 capability 有对应 delta spec, 但其中对应 Requirement 未提及该行为
- **THEN** 命令已把该 change 下全部 `specs/**/*.md` 路径列入 TASK, 审查 subagent 自行读取这些文件后判定"spec 未覆盖 What Changes"

#### Scenario: proposal 未声明任何 capability, 无 delta spec 属于正常情况
- **WHEN** 某 change 的 `proposal.md` 未声明任何 New/Modified Capability, 且该 change 目录下没有 delta spec 文件
- **THEN** 命令不报告 Critical, 视为正常情况

#### Scenario: proposal 声明了 capability 变更但完全没有 delta spec, 报告 Critical
- **WHEN** 某 change 的 `proposal.md` 声明了至少一个 New/Modified Capability, 但该 change 目录下 `specs/**/*.md` 一个文件都不存在
- **THEN** 命令报告 Critical; 若 `.openspec.yaml` 同时设置 `skip_specs: true`, 额外说明该 `skip_specs` 使用不当

#### Scenario: 首轮 TASK 只传路径清单, 不拼贴全文
- **WHEN** 某 change 的 `proposal.md`、`design.md`、`tasks.md` 及全部 delta spec 文件总长度超过千行
- **THEN** 传给审查 subagent 的 TASK 只包含这些文件的相对路径清单、change 目录路径与 context.md 路径引用, 不包含当前会话预读拼接的完整内容; 审查 subagent 自行读取这些路径的当前内容

#### Scenario: 审查模型未配置时回退当前会话模型（review-plan）
- **WHEN** 用户未配置 `codexHost.reviewModel`（或配置为空白）, 运行 `/ly:review-plan`
- **THEN** 审查 subagent 的模型回退继承当前会话模型; spawn SHALL NOT 携带 shell 层 `-m` 参数

#### Scenario: 审查模型配置了推理档时随对应 spawn 传入
- **WHEN** 用户配置 `reviewModel = "glm-5.3-flash"` 与 `reviewReasoningEffort = "low"`, 运行 `/ly:review-plan`
- **THEN** 审查 subagent 的 spawn 读取 `reviewReasoningEffort` 并把 `reasoning_effort: "low"` 随 `reviewModel` 一并传入; 空白档位不传参, SHALL NOT 使用模型名到档位的硬编码映射

### Requirement: 审查 subagent 轮内纪律（同轮 wait、禁止口头分发、消费完即关闭）
review-plan 与 review-code 的主会话 spawn 审查 subagent 后 SHALL 遵守轮内纪律：

1. **同轮等待结果**：spawn 之后 SHALL 在本轮内等待子 agent 返回（wait），收到结果先逐字转达给用户/报告再判定；SHALL NOT 在 spawn 后结束本轮回合（子 agent 返回的结果必须由本轮主会话消费，不允许"结果回来了但无人消费"的断链状态）。
2. **禁止口头分发代替工具调用**：主会话 SHALL NOT 仅以自然语言描述"已分发/将分发审查任务给 subagent"代替实际 spawn 调用；每一步 spawn/wait 都 SHALL 落到宿主工具调用，不产出口头占位。
3. **消费完即关闭**：子 agent 结果消费完毕（逐条裁决完成，不再需要该 agent）SHALL 关闭它，SHALL NOT 假设 subagent 跨用户回合存活。

#### Scenario: spawn 后同轮等待结果
- **WHEN** 主会话 spawn 一个审查 subagent 并等待其返回
- **THEN** 主会话在本轮内完成 wait 并消费结果，不结束回合留下"子 agent 已返回但主会话已退出"的状态

#### Scenario: 口头描述分发不视为执行
- **WHEN** 主会话输出"我将 spawn 审查 subagent"但未实际调用 spawn 工具
- **THEN** 该输出不视为分发动作，SHALL NOT 据此结束本轮或进入下一阶段；主会话必须实际完成 spawn + wait 才推进

### Requirement: 审查返回有效性判定
主会话判断一轮审查返回结果是否有效：审查 subagent 返回 SHALL 包含可识别的分级结论（Critical/Warning/Info 计数与条目）或明确的"无发现"声明。空响应、内容疑似截断（token 截断、输出被中断）、或仅有过程描述而无结论的返回，SHALL 视为无效返回，按「审查调用失败分类处理」的运行期失败处理，如实报告原始返回内容与判定理由，SHALL NOT 被误判为"本轮无 Critical"或视为清零通过。

#### Scenario: 返回仅为过程描述
- **WHEN** 审查 subagent 返回"已审完 proposal 与 design，未发现异常"但没有任何分级条目、也无明确的"无发现"声明格式
- **THEN** 视为无效返回，按运行期失败终止并报告，不按清零处理

#### Scenario: 返回内容疑似截断
- **WHEN** 审查 subagent 返回的分级条目在末尾明显中断（无收尾、无总计数）
- **THEN** 按无效返回处理，如实报告"疑似截断，视为无效"，进入终止条件，不猜测补全

### Requirement: 审查关卡以单审查 subagent（非 fork）执行

review-plan 与 review-code 两个审查关卡 SHALL 各 spawn **1 个**审查 subagent 执行本轮审查；SHALL NOT spawn 第二个审查 agent，SHALL NOT 实现或保留"并行双审、交换结论、共识归并"环节——单 agent 的分级结论即本轮唯一审查发现来源，逐条 Critical 由主会话裁决（见「Critical 裁决：认可即修复、不认可必须附可核验依据」），SHALL NOT 因"只有一个 agent"而跳过裁决或把结论当作自动生效。

**非 fork spawn**：审查 subagent SHALL 以非 fork 方式 spawn——子代理只携带 spawn 消息（TASK），SHALL NOT 携带父线程对话历史（宿主 V1 语义为 `fork_context: false` 默认值；V2 语义为 `fork_turns: none`）。仅当宿主不支持完全非 fork 而仅支持"最近 N 轮"fork 模式时，SHALL 取最小 N（或 0）近似非 fork 并在报告中如实说明；SHALL NOT 使用全量 fork（`fork_turns: all`）。

**软上下文载体**：非 fork 意味着主会话讨论中的软上下文（关键决策、取舍、已知边界）不再随 fork 自动到达审查 agent；TASK SHALL 指示审查 subagent 读取该 change 目录下的 `context.md`（见 `review-context-artifact` 能力）获取软上下文，SHALL NOT 在 TASK 中整段复制其内容。

**范围点名与角色词**：审查任务 SHALL 点名审查范围（review-plan 为"只审 change 产物：proposal/design/specs/tasks"——该点名范围本身是显式枚举的文件集合，不包含 `context.md`；review-code 为"只审最近一次相关 commit 对应 diff（apply 阶段 commit，未有 apply 阶段 commit 时退化为 propose 阶段 commit；两者定位见 `commit-conventions`）及未跟踪清单"——`context.md` 可能因 apply 阶段回写而实际出现在该 diff 范围内，此时 SHALL NOT 因其出现在 diff 中而将其当作可挑错的审查对象或修复对象）。两个命令共同遵守：`context.md` 始终只是背景引用来源（见「软上下文载体」），SHALL NOT 被当作可挑错的审查对象或修复对象；SHALL NOT 超出点名范围作业；SHALL 继续引用对应 ROLE_FILE（`~/.codex/lyx/prompts/codex/plan-reviewer.md` / `reviewer.md`），角色词内容不重写。

**模型与推理档**：SHALL 经"模板指示 + 宿主 spawn 能力"落实——审查 subagent 用 `codexHost.reviewModel` + 非空 `reviewReasoningEffort`；模型未配置或空白时继承当前会话模型，推理档 trim 后为空时不传 `reasoning_effort`。`reviewModelB`/`reviewReasoningEffortB` SHALL NOT 被审查流程读取使用（字段降级为弃用，见 `subagent-agent-config`）。SHALL NOT 依赖任何 shell 层模型或推理档参数，SHALL NOT 内置"模型名 → 推理档"的硬编码映射。审查 subagent 具备自主执行 shell 命令与读取文件的能力；TASK SHALL 只传基线引用或路径清单，SHALL NOT 由当前会话预先读取并拼贴审查内容全文。

#### Scenario: 审查 subagent 以非 fork 方式 spawn
- **WHEN** 审查关卡（review-plan 或 review-code）spawn 审查 subagent
- **THEN** 子代理只收到 TASK（范围点名、路径/基线清单、context.md 引用、模型指示），不携带主会话对话历史；SHALL NOT 使用全量 fork

#### Scenario: 按配置模型与推理档 spawn
- **WHEN** 用户配置 `reviewModel = "A"`、`reviewReasoningEffort = "low"`，运行一个审查关卡
- **THEN** 审查 subagent 以模型 A 和推理档 `low` 非 fork spawn；若 `reviewModelB` 也已配置，该值被忽略且不影响 spawn

#### Scenario: 不得恢复双审查
- **WHEN** 主会话在某一轮审查前考虑"再 spawn 一个复核 agent 更保险"
- **THEN** SHALL NOT spawn 第二个审查 agent；额外把关由主会话逐条裁决与"驳回硬线"终止条件承担

#### Scenario: 软上下文经 context.md 到达
- **WHEN** 审查 subagent 判断某条发现需要"为什么这样设计"的背景
- **THEN** 它从 change 目录下的 `context.md` 读取背景（TASK 已含路径引用），SHALL NOT 依赖任何 fork 历史或上一轮 subagent 会话记忆

### Requirement: Critical 裁决：认可即修复、不认可必须附可核验依据

`/ly:review-code` 与 `/ly:review-plan` 的审查-修复循环里, 审查 subagent 报告的每一条 Critical SHALL NOT 被当作自动生效的裁决直接执行修复。当前会话 SHALL 逐条判断是否认可：认可则按「审查-修复循环与终止条件」的规则修复。

**不认可必须附可核验依据**：不认可（判断为误报、对上下文理解有误、或建议本身存在问题）时 SHALL NOT 修复, 且本轮报告必须给出**可核验依据**——指明具体文件路径/行号、命令输出、既有机制所在位置等可被第三方独立核验的证据, SHALL NOT 仅以"误报""不影响功能"之类泛泛措辞打发。报告 SHALL 逐条并排展示审查 subagent 原文与主会话裁决理由。缺乏可核验依据的不认可 SHALL 视为未完成裁决：主会话 SHALL 补足依据后重新裁决, 不能补足的按认可处理并修复。SHALL NOT 沉默跳过或悄悄忽略任何一条 Critical。

**驳回硬线的逐条口径**：若同一条 Critical（按判同键判定）在下一轮审查中仍被提出, 且当前会话依然不认可, 命令 SHALL 触发"驳回硬线"终止条件（见「审查-修复循环与终止条件」终止条件 5）, 立即停止循环转人工, 不得继续自动修复或自动放弃该问题。

#### Scenario: 不认可附可核验依据
- **WHEN** 某一轮审查报告"switch 前置校验缺少非法字符处理", 当前会话核对后判断该校验已存在
- **THEN** 本轮报告写明"不认可：该校验已在 `<文件>` 第 N 行存在（可核验证据）", 不修改该处, 逐条并排展示原文与裁决理由

#### Scenario: 缺乏可核验依据的不认可须补足或改判
- **WHEN** 主会话对某条 Critical 的不认可理由仅为"这是误报", 未给出任何可核验证据
- **THEN** 该不认可视为未完成裁决, 主会话补足依据后重新裁决；不能补足的按认可处理并修复, SHALL NOT 以空泛理由维持不认可

#### Scenario: 同一条 Critical 两轮驳回复现, 触发驳回硬线
- **WHEN** 当前会话对某条 Critical 不认可（附可核验依据）, 下一轮审查该 Critical 仍被提出且仍不认可
- **THEN** 触发"驳回硬线"终止条件, 立即停止循环, 报告并列展示两轮原文与两轮可核验依据, 说明需要人工裁决

### Requirement: 审查调用失败分类处理
`/ly:review-code` 与 `/ly:review-plan` 必须（SHALL）区分三类审查调用失败：**运行期失败**（spawn 后等待超时/卡死、返回内容格式不符或不含有效结论（含空响应与疑似截断，见「审查返回有效性判定」）、审查 subagent 调用失败且无法按回退口径继续、回退不可行或回退后仍失败）视为独立终止条件, 如实报告原因并停止循环, 不得把失败等同于"本轮无 Critical"或视为清零通过；**环境级不可用**（宿主无 subagent 能力、初始 spawn 不可用）按 `subagent-agent-config` 的回退口径处理——回退当前会话直接执行审查, 并如实报告带显式状态标记的回退（`[回退] subagent 不可用: <原始报错>`）, SHALL NOT 视为流程失败中断整体编排；**配置读取失败**（缺文件或解析错误）SHALL 视为"配置状态未知", 明确提示"无法读取配置, 请运行 `lycx doctor` 检查", SHALL NOT 按"未配置"静默继承回退。单审执行模型下不存在"另一 agent 结论完整"的降级路径——审查 agent 调用失败即本轮失败, 按上述口径处理, SHALL NOT 把失败归入"驳回硬线"（调用失败非裁决分歧）。

#### Scenario: 审查调用超时
- **WHEN** 审查 subagent 调用超过预设时限未返回有效结论
- **THEN** 命令按独立终止条件处理, 如实报告超时事实与已取得的部分结论（如有）, 不进入下一轮

#### Scenario: 返回内容格式不符
- **WHEN** 审查 subagent 返回内容不符合约定输出结构, 无法解析出 Critical/Warning/Info
- **THEN** 命令按独立终止条件处理, 报告原始返回内容与解析失败原因, 不猜测改写后继续

#### Scenario: 审查 subagent 调用失败
- **WHEN** 审查 subagent 无法产出结论（spawn 后失败或超时）
- **THEN** 按独立终止条件结束审查, 如实报告"审查调用失败"及原因, 不进入下一轮, SHALL NOT 归入"驳回硬线"

#### Scenario: 环境级 subagent 不可用, 回退当前会话直接审查
- **WHEN** 当前 codex 环境无 subagent 能力或在初始 spawn 即不可用, 用户运行 `/ly:review-plan` 或 `/ly:review-code`
- **THEN** 命令回退为当前会话直接执行审查并如实报告"已回退, 原因：subagent 不可用", SHALL NOT 视为流程失败中断整体编排

#### Scenario: 模板运行前读取配置失败
- **WHEN** 审查 subagent spawn 前读取 `~/.codex/lyx/config.toml` 失败（缺文件或解析错误）
- **THEN** 命令明确提示"无法读取配置, 请运行 `lycx doctor` 检查", 按"配置状态未知"处理, SHALL NOT 按"未配置"静默继承回退

### Requirement: 审查-修复循环与终止条件（review-code / review-plan 共用）
当某一轮审查发现至少一个 Critical 时, `/ly:review-code` 与 `/ly:review-plan` 都必须（SHALL）由当前会话针对该轮全部 Critical 逐条裁决（见「Critical 裁决：认可即修复、不认可必须附可核验依据」）并执行认可部分的修复, 修复完成后必须（SHALL）自动进入下一轮审查——**第 2 轮起重新 spawn 一个全新审查 subagent（非 fork，只携带 TASK；TASK 仍按增量语义携带上一轮全部 Critical 逐字原文 + 路径清单 + 该 change 目录下 `context.md` 的路径引用）**。主会话 SHALL 不依赖"跨轮续聊"假设：子 agent 会话随主会话回合结构而存在，回合结束即失去访问能力，因此每轮都以独立 spawn + 同轮 wait 执行，SHALL NOT 假定上一轮 spawn 的 subagent 仍可被调用。不要求用户手动触发。`/ly:review-code` 的修复对象是审查范围指向的应用代码文件（含为验证修复而必须新增/调整的测试文件）；`/ly:review-plan` 的修复对象是该 change 自己的 `proposal.md`/`design.md`/`tasks.md`以及该 change 目录下的 delta spec 文件（`specs/**/*.md`）——例如"spec 未覆盖 proposal 的 What Changes"这类 Critical, 修复方式就是编辑对应的 delta spec 文件, 不属于修复对象之外的私改。两个命令的每轮修复允许改动"当前轮 Critical 报告直接指向的条目"以及"修复该 Critical 所必需的直接依赖条目"（例如一个跨 artifact/跨文件的一致性问题, 需要同步改动多处才能真正修好）, 但不得借机重构、格式化或改动与该 Critical 无关的内容；命中"必需依赖"用时, 本轮报告必须（SHALL）逐项说明每处改动与该 Critical 的关联性。每轮修复完成后必须（SHALL）记录本轮实际改动的文件清单（含修改的 delta spec 文件, 如适用）。`/ly:review-code` 每轮修复后, 若项目存在对应的验证命令（测试/类型检查/构建）, 必须（SHALL）运行与该轮改动范围相称的验证, 验证失败必须作为停止条件处理；`/ly:review-plan` 每轮修复后必须（SHALL）运行 `openspec validate --changes <change-name>` 作为验证步骤, 验证失败同样作为停止条件。循环必须（SHALL）持续到满足以下任一终止条件, 并受一个全局轮数上限的兜底约束（见「全局轮数上限作为最后兜底」）：

1. 某一轮审查 Critical 数为 0（正常清零）
2. 熔断：同一个 Critical（以"文件路径 + 问题类型 + 定位锚点（`/ly:review-code` 为函数名/路由/调用点；`/ly:review-plan` 为 artifact 内的具体条目/章节）"三者共同判定为同一问题, 不要求问题描述文字完全一致）在相邻两轮审查中都判定仍存在——即上一轮判定为 Critical 并已尝试修复的问题, 在紧接的下一轮复审中仍被判定未解决。若 当前会话 在上一轮对它的判断是"不认可"（未修复）, 相邻两轮再次出现 SHALL NOT 走熔断而走"驳回硬线"（见条件 5）
3. 无法安全自动修复：某个 Critical 的修复需要产品/业务决策、依赖当前会话不具备的外部凭据、会改变已发布的公开 API 或接口契约, 或 当前会话 判断当前上下文不足以给出确认性修复——命中时不做猜测性修改
4. 修复后验证失败：`/ly:review-code` 该轮修复后运行的测试/类型检查/构建未通过, 或 `/ly:review-plan` 该轮修复后 `openspec validate` 未通过
5. **驳回硬线**（二选一命中即触发）：（a）逐条口径——当前会话 对某个 Critical 判断为不认可（附可核验依据）, 该 Critical 在下一轮审查中仍被提出, 且 当前会话 依然不认可；（b）整轮口径——连续 2 轮审查中, 当前会话 对当轮**全部** Critical 均不认可（零认可、零修复, 即使各轮 Critical 的判同键互不相同）——整轮口径防的是"主会话系统性驳回一切发现"的裁决失效, 命中任一口径立即停止循环, 报告并列展示审查 subagent 各轮原始发现与 当前会话 各轮可核验依据, 判定需要人工介入, 不得继续自动修复或自动放弃
6. 审查对象类型持续系统性误判:连续 3 轮（含本轮）审查中每一轮的全部 Critical 都被 当前会话 判定为同一大类系统性误判——即审查 agent 反复以"该轮 Critical 所依据的类型不属于当前命令的审查范畴"为由被 当前会话 判定不认可（例如 `/ly:review-plan` 连续 3 轮的 Critical 均以"代码库尚未实现该方案条目"为理由），不要求这 3 轮之间 Critical 的文件/类别/锚点互相一致, 只要求"判定为不认可的原因类型"在这 3 轮中一致

出现终止条件 2-6 中任一条时, 命令必须（SHALL）立即停止循环, 在报告中明确指出触发的具体条件、涉及的问题（文件、类别、锚点、判断依据）, 并说明需要人工介入, 不得继续自动修复；这些条件时命令 SHALL NOT 提交任何改动（见下方）——已产生的改动留在工作区交由人工处理。**终止报告的末尾 SHALL 附"下一步可用命令指引"**（如：可用 `@lyx-review-plan <change-name>` 重跑审查；`@lyx-apply` 暂不实施——按当前终止原因；改动保留在工作区，可先 `git diff` 查看），供用户在"断在明确节点、人工自行触发下一步"口径下续接。循环期间的 Warning 与 Info 发现不参与循环终止判定, 只在循环结束后的最终报告列出最后一轮的结果, 不跨轮次合并。

**下一轮 TASK 保持增量传递语义**：每一轮修复后, 下一轮任务必须（SHALL）包含上一轮全部 Critical 的逐字原文, 以及"本轮改动文件 + 上一轮全部 Critical 指向的文件"的路径清单（`/ly:review-plan` 场景下含 delta spec 文件）——即使某条未修改, 其指向的文件路径也要纳入, 否则审查 agent 无法读取当前内容判断问题是否仍存在。**每一轮 TASK（含第 2 轮起）必须（SHALL）同时保持该 change 目录下 `context.md` 的路径引用**——非 fork spawn 每轮都是全新子代理、无任何历史记忆，缺少该引用即彻底失去软上下文通道（见 `review-context-artifact` 能力「审查与实施 subagent 经 context.md 获取软上下文」）；`context.md` 仍只作背景引用，不计入"路径清单"所指的修复对象范围。若某条上一轮 Critical 位置字段缺失可解析路径, 命令必须保守处理（一般是将该轮已知的兜底路径集合纳入清单, 不得静默丢弃）。若上一轮某条 Critical 指向的文件被删除或重命名, 路径清单改用新路径并说明状态变化。命令必须（SHALL）指示审查 agent 自行读取路径当前内容, 判断:（a）上轮各 Critical 是否已解决；（b）本轮改动是否引入新问题。未被"本轮改动"和"上一轮任一 Critical 指向"覆盖的文件 SHALL NOT 重新整段传入。**非 fork spawn 不携带任何会话历史**——上一轮 Critical 的逐字原文与路径清单是审查 agent 判断"问题是否已解决"的唯一依据, 必须显式传, 避免审查 agent 依据模糊记忆断言。

**报告逐轮展示审查 agent 原始发现**：`/ly:review-code`/`/ly:review-plan` 的每一轮审查调用（包括首轮 Critical 为 0 不进入循环的情况）都必须在报告中包含独立区块, 逐字展示该轮审查 subagent 返回的原始 Critical/Warning/Info 内容（不经概括、改写或合并）, 并与 当前会话 对该轮每条 Critical 的裁决（认可/不认可及可核验依据）并排列出（若该轮无 Critical, 只展示原文）。该区块必须在该轮审查调用返回后于本轮报告呈现。

**报告格式**: 循环终止原因、总轮数、已修复的 Critical 摘要（含每轮改动文件清单）、最后一轮 Warning/Info。仅当全程无任何 Critical/Warning/Info 时才可以使用"未发现问题"表述；只要发现并修复过 Critical, 报告必须明确"本次已自动修复 N 个 Critical"。每条 Critical 摘要用相关人员易懂的语言概括问题与已做改动, 逐字原文区块作为补充材料并存。

**循环期间不提交, 仅在正常清零后统一提交一次**：每一轮修复完成、验证通过后, SHALL NOT 立即执行 git commit——改动保持在当前状态, 直到循环正常清零后由主会话统一提交一次（见「循环结束后统一提交, `--no-commit` 关闭最终提交」）；`--no-commit` 传入时连清零后的统一提交也不执行。循环期间发生任何中途提交（无论主会话手滑或外部因素）SHALL 如实报告，并仍以固定基线重新计算 `git diff <固定SHA>` 说明该中途 commit 是否落在审查范围内（核对 ≠ 替换基线），但不以此自动进入终止条件。

#### Scenario: 第二轮重新 spawn 审查 subagent
- **WHEN** `/ly:review-plan` 第一轮发现 Critical 并修复，进入第二轮
- **THEN** 主会话重新 spawn 一个全新审查 subagent（非 fork, 只携带 TASK），TASK 增量携带第一轮全部 Critical 逐字原文、原路径清单与该 change 目录下 `context.md` 的路径引用，不假定第一轮 subagent 仍存活

#### Scenario: 终止报告附下一步指引
- **WHEN** `/ly:review-plan` 因熔断终止
- **THEN** 终止报告在终止详情后列出下一步可用命令（如 `@lyx-review-plan <change-name>` 重跑），并说明改动保留在工作区、可先 `git diff` 查看

#### Scenario: 循环期间发生意外提交
- **WHEN** 审查-修复循环期间工作区出现一次非本循环统一提交的中途 commit
- **THEN** 命令如实报告该提交及其影响（仍以固定基线重新计算 `git diff <固定SHA>`，核对该中途 commit 是否落在审查范围内，核对不等于替换基线），不静默忽略，也不仅因此自动终止

#### Scenario: 一轮修复后 Critical 清零（review-code）
- **WHEN** `/ly:review-code` 第一轮审查发现 2 个 Critical, 当前会话 修复后自动触发第二轮审查, 第二轮 Critical 数为 0, 且两轮修复后的验证均通过
- **THEN** 循环在第二轮结束, 命令报告"本次已自动修复 2 个 Critical", 列出第二轮的 Warning/Info, 不再触发第三轮

#### Scenario: 一轮修复后 Critical 清零（review-plan）
- **WHEN** `/ly:review-plan` 第一轮审查在 `design.md` 发现 1 个 Critical（如"未注明范围"）, 当前会话 修改 `design.md` 后自动触发第二轮, `openspec validate` 通过, 第二轮 Critical 数为 0
- **THEN** 循环在第二轮结束, 命令报告"本次已自动修复 1 个 Critical", 列出最后一轮 Warning/Info

#### Scenario: 修复对象包含 delta spec 文件
- **WHEN** `/ly:review-plan` 某一轮审查发现的 Critical 是"spec 的 Requirement 未覆盖 proposal 的 What Changes"（锚定在 `specs/<capability>/spec.md`）, 当前会话 判断认可
- **THEN** 修复该 Critical 的方式是编辑该 delta spec 文件补对 Requirement/Scenario, 这被记录在改动文件清单中, 不视为走出修复对象范围

#### Scenario: 修复后问题转移到不同文件或不同类别, 循环继续
- **WHEN** 第一轮审查在 `a.ts` 发现一个"空指针"类 Critical, 当前会话 修复后, 第二轮审查在 `a.ts` 发现一个不同的“未处理异常”类 Critical（问题类型不同）
- **THEN** 命令视为新问题, 不判定熔断, 继续处理新 Critical 并触发下一轮

#### Scenario: 同一文件内两个独立的同类问题不被误判为熔断
- **WHEN** 第一轮审查在 `c.ts` 的 `handleLogin` 发现“SQL 注入”类 Critical, 当前会话 修复后第二轮在同一 `c.ts` 但 `handleSearch`（不同锚点）又发现一条“SQL 注入”类 Critical
- **THEN** 命令视为新问题（锚点不同）, 不判定熔断, 继续处理

#### Scenario: 同一问题连续两轮未解决, 触发熔断
- **WHEN** 第一轮审查在 `b.ts` 的 `parseInput` 判定“SQL 注入”类 Critical, 当前会话 认可并尝试修复, 第二轮在同一 `b.ts` 同一 `parseInput` 仍判同一条“SQL 注入”未解决
- **THEN** 命令立即停止循环, 报告标注该问题文件/类别/锚点及两轮判定, 需要人工介入

#### Scenario: 熔断场景同样适用于 review-plan
- **WHEN** review-plan 第一轮审查判定 `proposal.md` 的“Purposes”章节与 tasks.md 不一致类 Critical, 当前会话 认可并修改后, 第二轮在同一章节与类别仍然判定存在
- **THEN** 命令立即停止循环, 报告该问题所在 artifact/章节/类别及两轮判定, 转人工

#### Scenario: Critical 需要业务决策, 判定为无法安全自动修复
- **WHEN** 某一轮 Critical 是"该接口未做权限校验", 但修复方式依赖产品未明确的权限模型
- **THEN** 命令不做猜测性修改, 立即停止循环, 报告 Critical 原因及“无法安全修复”的理由, 以及建议的人工方向

#### Scenario: 修复后验证失败, 触发停止
- **WHEN** review-code 某一轮修复后运行测试失败；或 review-plan 该轮修复后 `openspec validate` 报错
- **THEN** 命令停止循环, 不再继续下一轮, 报告本轮改动文件, 及验证失败的具体错误, 需要人工介入

#### Scenario: 循环中途 Warning/Info 变化不影响终止判定
- **WHEN** 某一轮 Critical 清零但 Warning 数量较上一轮增加
- **THEN** 循环仍按正常清零在该轮结束（终止只看 Critical）, 最终报告只列出最后一轮的 Warning, 不合并此前轮

#### Scenario: 修复范围扩展到必需的依赖条目, 并说明关联性
- **WHEN** review-plan 的一个 Critical “proposal.md 的 Impact 章节与 tasks.md 任务不一致”, 该 Critical 锚定 proposal.md, 但真正修复需同时改 `tasks.md`
- **THEN** 当前会话 同时改 proposal.md 和 tasks.md, 本轮报告逐项说明改动与 Critical 的关联, 不视为违反修复范围

#### Scenario: 连续 3 轮同类系统性误判, 触发新终止条件
- **WHEN** review-plan 连续 3 轮的 Critical 都以“代码库尚未实现该方案条目”为理由（各轮具体任务不同）, 当前会话 每轮不认可并说明“方案阶段正常状态”
- **THEN** 命令在第 3 轮后停止, 报告"审查对象类型持续系统性误判", 列出 3 轮原文与判定理由, 转人工（如检查角色提示词是否需要调整）

#### Scenario: 系统性误判类别不连续, 不触发新终止条件
- **WHEN** 第一、三轮 Critical 均以“代码库尚未实现”而被判不认可, 但第二轮是一条被认可并修复的真实文档缺陷
- **THEN** 不触发“持续系统性误判”（未连续 3 轮), 循环按原有终止条件继续判定

#### Scenario: 连续 2 轮全部驳回, 触发驳回硬线（整轮口径）
- **WHEN** review-code 连续 2 轮审查中, 当前会话 对当轮全部 Critical 均不认可（第 1 轮 2 条、第 2 轮 1 条, 判同键互不相同, 每条均附可核验依据）
- **THEN** 触发"驳回硬线"终止条件（整轮口径）, 立即停止循环, 报告并列展示 2 轮原文与 2 轮可核验依据, 说明需要人工裁决, SHALL NOT 进入第 3 轮

#### Scenario: 部分认可部分驳回时不触发整轮口径
- **WHEN** 连续 2 轮审查中, 每轮当前会话都认可并修复了至少 1 条 Critical（其余不认可）
- **THEN** "驳回硬线"整轮口径不触发（未出现"全部驳回"轮）；被驳回条目若复现且再被驳回, 由逐条口径判定

#### Scenario: 第二轮 TASK 路径清单覆盖改动文件与全部上一轮 Critical 指向的文件
- **WHEN** review-code 第一轮 3 个 Critical, 当前会话 认可并修复 2 个（涉及 a.ts/b.ts）, 不认可第 3 个（指向 c.ts 未改动）
- **THEN** 第二轮 TASK 包含: 该 3 条 Critical 逐字原文及路径清单 a.ts、b.ts、c.ts；其它未被本轮改动和未由任何上一轮 Critical 指向的文件不整体传入, 审查 agent 自行读取这 3 个文件判断前 2 条是否已解决、第 3 条是否存在

#### Scenario: 跨文件/范围性 Critical 的路径列出全部相关文件
- **WHEN** review-plan 第一轮“proposal.md Impact 与 tasks.md 范围不一致”（不存在单个目标文件）
- **THEN** 该 Critical 的位置字段列出 proposal.md 与 tasks.md 两个路径；第二轮路径清单必须同时包含两个, 不取其一

#### Scenario: Critical 位置字段缺失可解析路径, 保守纳入全部 artifact
- **WHEN** 某轮一条 Critical 缺失可解析路径（角色提示词未被遵守）
- **THEN** 命令不得静默丢弃, 必须将该 change 目录全部 artifact/delta spec 路径统一纳入下一轮路径清单, 并在报告中说明“该条 Critical 缺少路径, 已扩大范围”

#### Scenario: 每轮报告展示 Codex 原始发现与 当前会话 判定的并排对照
- **WHEN** 某轮返回 2 个 Critical: 当前会话 认可第 1 个并修改 `design.md`, 不认可第 2 个（附可核验依据）
- **THEN** 本轮报告“逐字原文”区块展示 2 条原文, 并排展示 当前会话 对每条裁决及依据, 用户直接对照

#### Scenario: 第 2 轮重新 spawn 全新审查 subagent
- **WHEN** `/ly:review-plan` 第 2 轮重新 spawn 一个全新审查 subagent（非 fork, 无会话历史）
- **THEN** TASK 仍包含上一轮全部 Critical 逐字原文 + 路径清单 + `context.md` 路径引用（增量），不整段重新传入基线 artifact 全文；上一轮原文是审查 agent 判断"问题是否已解决"的唯一依据, SHALL NOT 因 TASK 精简而省略

### Requirement: 全局轮数上限作为最后兜底
`/ly:review-code` 与 `/ly:review-plan` 的审查-修复循环必须（SHALL）设置一个全局轮数上限（默认 5 轮）。达到该上限时, 无论熔断/驳回硬线/审查对象类型持续系统性误判等信号是否已触发, 命令必须（SHALL）立即停止循环, 报告"已达到全局轮数上限, 停止自动化, 转人工介入", 并附完整轮次轨迹（每轮 Critical 摘要）。该上限 SHALL NOT 作为正常场景下的主要终止信号, 仅用于兜底防止其余终止条件因某种原因未生效而导致的真正无限循环。**清零优先于轮数上限**：轮数上限的判定必须（SHALL）发生在"本轮审查结果确认为非清零"之后——若第 N 轮（包括恰好第 5 轮）审查结果本身是 Critical 清零, 命令必须（SHALL）按正常清零处理并输出清零报告, SHALL NOT 因为该轮恰好命中轮数上限而报告为"达到全局轮数上限"。

#### Scenario: 正常场景不触及轮数上限
- **WHEN** 循环在第 3 轮就因 Critical 清零结束
- **THEN** 全局轮数上限完全不影响本次执行, 报告中不需要提及该上限

#### Scenario: 达到全局轮数上限
- **WHEN** 循环连续 5 轮都发现新的、判同键各不相同的 Critical（因而既未清零、也未熔断、也未命中驳回硬线、也未命中审查对象类型持续系统性误判）
- **THEN** 命令在第 5 轮结束后停止循环, 报告"已达到全局轮数上限（5 轮）, 停止自动化", 附上完整的 5 轮 Critical 摘要轨迹, 说明需要人工介入

#### Scenario: 第 5 轮恰好清零, 按清零处理不报达到上限
- **WHEN** 循环第 1-4 轮各自发现新的 Critical 并修复, 第 5 轮审查 Critical 数为 0
- **THEN** 命令报告本次已自动修复的 Critical 数量, 按正常清零结束, SHALL NOT 报告"已达到全局轮数上限"

### Requirement: 循环结束后统一提交, `--no-commit` 关闭最终提交
`/ly:review-code` 与 `/ly:review-plan` 默认（不传任何标志）在循环执行期间 SHALL NOT 提交——每一轮修复完成后只运行验证（`/ly:review-code` 为测试/类型检查/构建；`/ly:review-plan` 为 `openspec validate`），不执行 git commit，改动保持在工作区（修复改动一律留在工作区未暂存状态；审查目标本身的原始改动可能已由编排方 `/ly:propose`、`/ly:apply` 暂存，命令 SHALL NOT 主动改变文件的 staged 状态）。仅当循环以"正常清零"结束（某一轮 Critical 数为 0）时，命令必须（SHALL）在输出报告之前对**审查目标全部文件**执行一次统一提交：先 `git add` 审查目标范围内的全部文件（`/ly:review-code` 为审查范围圈定的全部代码文件——原始改动 + 循环期间修复的改动全部暂存；`/ly:review-plan` 为目标 change 目录下的 `proposal.md`/`design.md`/`tasks.md` 及全部 delta spec 文件——含编排方早已暂存的产物与循环期间修复的文件，一并暂存），再执行一次 commit（仅暂存并提交这些文件，不做范围外的 `git add`）。

统一提交的 commit message SHALL 采用 `commit-conventions` 定义的结构：CC 前缀为 `fix(<scope>): <subject>`，subject 含目标标识与总轮次说明（例如"review-plan 反馈修复（2 轮）"），末尾带 trailer——`/ly:review-plan` 用 `Change-Stage: review-plan-fix`，`/ly:review-code` 用 `Change-Stage: review-code-fix`，两者均带 `Change-Name: <change-name>`。

**审查目标原始改动的提交归属**：`/ly:review-code` 的审查目标是**审查范围圈定的全部文件**——有 apply 阶段 commit 时为该 commit 的差异（`git show <commit>`）叠加循环期间未提交的修复；仅在无 apply 阶段 commit 的退化场景下才是"当前工作区尚未提交的变更"（`git diff HEAD` 圈定的范围）。两种场景下，循环产生的修复都是在原始内容之上的修正，清零后的统一提交本来就应同时包含"原始内容"与"审查修正"，二者是同一个待提交单元，不需要也不应该被拆开。同样地，`/ly:review-plan` 的审查目标（该 change 的 artifact 与 delta spec 文件）允许在循环开始前处于未暂存或已暂存状态（`/ly:propose` 编排下产物已暂存、独立运行时可能未暂存）。**因此 `review-plan` 场景下不再存在任何"循环开始前已脏的文件被跳过提交"的隔离逻辑**——propose 产物是合法审查对象不是无关脏文件，用户手工编辑的 artifact 同样属于审查目标内容，一并提交；删除对"循环开始前未提交状态文件"的 `git status --porcelain` 预检查和隔离跳过行为。

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

### Requirement: 审查执行者可切换（main / subagent）

**适用范围覆盖（自本 change 起）**：本能力中凡以"spawn 审查 subagent"为前提的 Requirement（含「审查 subagent 轮内纪律」「审查返回有效性判定」「审查关卡以单审查 subagent（非 fork）执行」「Critical 裁决：认可即修复、不认可必须附可核验依据」「审查调用失败分类处理」「审查-修复循环与终止条件」「全局轮数上限作为最后兜底」「循环结束后统一提交」），其适用范围 SHALL 限定为 `reviewExecutor = "subagent"` 时；`reviewExecutor = "main"`（默认，含未配置）时 SHALL 以本 Requirement 为准。两条路径的分歧点以本 Requirement 为权威。

**执行者解析**：`@lyx-review-plan` / `@lyx-review-code` SHALL 读取 `~/.codex/lyx/config.toml` 的 `[codexHost] reviewExecutor`（未配置、空白或非法取值等价 `"main"`）决定本轮审查的执行者。审查范围判定、基线锚定、未跟踪清单采集、Critical / Warning / Info 分级输出、`openspec validate` 这些与执行者无关的规则 SHALL 在两条路径下保持一致。

**main 路径（默认）**：

- 主 agent SHALL 在当前会话直接执行审查，SHALL NOT spawn 子代理、SHALL NOT 读取 `reviewModel` / `reviewReasoningEffort`、SHALL NOT 产生 `[回退]` 标记。
- 主 agent SHALL 直接读取审查对象（review-plan 为 change 产物与全部 delta spec；review-code 为审查范围对应的 git diff 与未跟踪清单），产出 Critical / Warning / Info 分级发现。
- SHALL NOT 存在"审查发现 vs 主会话裁决"两个主体：主 agent 的发现即最终裁决，SHALL NOT 适用逐条裁决、驳回硬线、熔断、审查对象类型持续系统性误判这些为双主体仲裁设计的条件。
- 发现 Critical 时主 agent SHALL 直接修复，修复后 SHALL 再自查一轮确认清零；自审循环 SHALL 最多 2 轮，达到上限仍非清零时 SHALL 停止并转人工。
- review-plan 场景每轮修复后 SHALL 运行 `openspec validate --changes <change-name>`；SHALL NOT 运行测试 / 类型检查 / 构建——慢验证统一由 `archive-verification-gate` 在归档前执行一次。
- 清零后 SHALL 按既有「循环结束后统一提交」规则提交一次；`--no-commit` 时跳过。

**subagent 路径**：

- 主会话 SHALL spawn 1 个审查 subagent（非 fork，只携带 TASK），模型按 `reviewModel`、非空推理档按 `reviewReasoningEffort` 传入；TASK SHALL 指示读取该 change 目录下 `context.md`。
- 首轮之后 SHALL 优先以 `send_input` 复用同一子代理；复用失败（会话丢失、`send_input` 或 `resume_agent` 报错）SHALL 回退为重新 spawn 全新子代理，并按增量语义携带上一轮全部 Critical 逐字原文与路径清单。
- 逐条裁决、驳回硬线、熔断、审查对象类型持续系统性误判、全局轮数上限（5 轮）等既有规则 SHALL 保持适用。
- review-plan 场景每轮修复后 SHALL 运行 `openspec validate`；SHALL NOT 运行测试 / 类型检查 / 构建——慢验证统一由 `archive-verification-gate` 在归档前执行一次。

**回退**：`reviewExecutor = "subagent"` 但宿主不支持 spawn 或首次 spawn 失败时，SHALL 按 `subagent-agent-config` 的回退口径回退 main 路径并输出 `[回退] subagent 不可用: <原始报错>`，SHALL NOT 视为流程失败。

**废止被实测推翻的假设**：本能力原有 Requirement 中"子 agent 会话随主会话回合结构而存在，回合结束即失去访问能力"SHALL 废止——宿主支持子代理首次任务完成后再唤醒并保留其会话上下文，因此"每轮必须重新 spawn"不再是约束。

#### Scenario: 默认由主 agent 直接审查
- **WHEN** 用户未配置 `reviewExecutor`（等价 `main`），运行 `@lyx-review-plan`
- **THEN** 主 agent 直接读取 change 产物产出分级发现，不 spawn 子代理、不产生回退标记；发现 Critical 时直接修复并最多自查 2 轮

#### Scenario: 主 agent 路径不适用裁决与驳回硬线
- **WHEN** 主 agent 执行审查并发现 Critical
- **THEN** 主 agent 直接修复，不进入"逐条裁决 / 不认可须附可核验依据 / 驳回硬线 / 熔断"流程

#### Scenario: 主 agent 路径不做慢验证
- **WHEN** 主 agent 在 review-code 场景修复了 Critical
- **THEN** 命令 SHALL NOT 运行测试 / 类型检查 / 构建，仅在报告中说明慢验证已由归档前关卡负责

#### Scenario: subagent 路径复用同一子代理
- **WHEN** 配置 `reviewExecutor = "subagent"`，首轮审查报告 Critical，主会话修复后进入第 2 轮
- **THEN** 主会话以 `send_input` 复用首轮子代理，携带修复说明与上轮 Critical 原文；复用失败才回退重新 spawn

#### Scenario: spawn 不可用时回退 main 路径
- **WHEN** 配置 `reviewExecutor = "subagent"` 但宿主不支持 spawn 或首次 spawn 失败
- **THEN** 命令回退主 agent 直接审查并输出 `[回退] subagent 不可用: <原始报错>`，流程不中断
