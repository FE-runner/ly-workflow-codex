## MODIFIED Requirements

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

### Requirement: 审查关卡以单审查 subagent（非 fork）执行

review-plan 与 review-code 两个审查关卡 SHALL 各 spawn **1 个**审查 subagent 执行本轮审查；SHALL NOT spawn 第二个审查 agent，SHALL NOT 实现或保留"并行双审、交换结论、共识归并"环节——单 agent 的分级结论即本轮唯一审查发现来源，逐条 Critical 由主会话裁决（见「Critical 裁决：认可即修复、不认可必须附可核验依据」），SHALL NOT 因"只有一个 agent"而跳过裁决或把结论当作自动生效。

**非 fork spawn**：审查 subagent SHALL 以非 fork 方式 spawn——子代理只携带 spawn 消息（TASK），SHALL NOT 携带父线程对话历史（宿主 V1 语义为 `fork_context: false` 默认值；V2 语义为 `fork_turns: none`）。仅当宿主不支持完全非 fork 而仅支持"最近 N 轮"fork 模式时，SHALL 取最小 N（或 0）近似非 fork 并在报告中如实说明；SHALL NOT 使用全量 fork（`fork_turns: all`）。

**软上下文载体**：非 fork 意味着主会话讨论中的软上下文（关键决策、取舍、已知边界）不再随 fork 自动到达审查 agent；TASK SHALL 指示审查 subagent 读取该 change 目录下的 `context.md`（见 `review-context-artifact` 能力）获取软上下文，SHALL NOT 在 TASK 中整段复制其内容。

**范围点名与角色词**：审查任务 SHALL 点名审查范围（review-plan 为"只审 change 产物：proposal/design/specs/tasks"——该点名范围本身是显式枚举的文件集合，不包含 `context.md`；review-code 为"只审最近一次相关 commit 对应 diff（`apply:` commit，未有 `apply:` 时退化为 `propose:` commit）及未跟踪清单"——`context.md` 可能因 apply 阶段回写而实际出现在该 diff 范围内，此时 SHALL NOT 因其出现在 diff 中而将其当作可挑错的审查对象或修复对象）。两个命令共同遵守：`context.md` 始终只是背景引用来源（见「软上下文载体」），SHALL NOT 被当作可挑错的审查对象或修复对象；SHALL NOT 超出点名范围作业；SHALL 继续引用对应 ROLE_FILE（`~/.codex/lyx/prompts/codex/plan-reviewer.md` / `reviewer.md`），角色词内容不重写。

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
