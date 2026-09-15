## MODIFIED Requirements

### Requirement: 代码审查读取 git diff 并分级输出发现

`/ly:review-code` 必须（SHALL）以目标 change 的最近一期 `apply:` commit 作为审查基线（编排方 `@lyx-apply` 在实施完成后立即提交，提交信息为 `apply: <change-name>`）：先按目标 change 优先级解析 change（显式参数 → `openspec/changes/` 下唯一未归档 change → 询问用户），再用 `git log --grep="^apply: <change-name>"` 取 HEAD 侧最近一期匹配 commit；该 commit 存在时，审查范围 = 该 `apply:` commit 的差异（`git show <commit>`）+ 当前 `git diff HEAD` + `git status --porcelain` 过滤出的未跟踪路径清单，工作区/暂存区干净时仍按该 commit 审查，SHALL NOT 报"无变更可审查"。该 commit 不存在时，检查最近一期 `propose: <change-name>` commit（`git log --grep="^propose: <change-name>" -1`）：存在则审查范围 = 该 `propose:` commit 差异 + 当前 `git diff HEAD` + 未跟踪路径清单，工作区/暂存区干净时仍按该 commit 审查。两者都不存在时退化为"有未提交变更"组合：`git diff HEAD`（覆盖已暂存+未暂存）+ `??` 未跟踪路径清单；仓库零 commit（`git rev-parse HEAD` 失败）则使用三条固定命令组合表达审查范围：`git diff --cached` + `git diff` + `git status --porcelain` 过滤 `??` 得到的未跟踪路径清单，不得尝试执行 `git diff HEAD`、`git diff HEAD~1` 或 `git show HEAD`。仅在既无 `apply:`/`propose:` commit、工作区又无任何未提交变更时，命令才报告"无变更可审查"并直接结束。

无论采用上述哪种基线，命令必须（SHALL）额外用 `git status --porcelain` 抓取 `??` 开头的未跟踪文件路径，确保新建但未 `git add` 的文件不被漏审。审查执行方式由"审查关卡以双审查 subagent 执行"定义：两个并行审查 subagent fork 当前会话上下文，模型按 `codexHost.reviewModel`/`reviewModelB` 配置、未配置或空白时继承当前会话模型，对应推理档 `reviewReasoningEffort`/`reviewReasoningEffortB` 非空时随 spawn 传入；命令 SHALL NOT 使用 `codex exec`、`-m`、`session_id` 或 `resume`。首轮确定的审查范围必须（SHALL）被记录并供首轮 TASK 使用：只传基线引用说明（如"审查 `git show <commit>` 的差异"或三条零 commit 命令组合说明）和未跟踪文件路径清单，不把完整 diff 文本拼进 TASK；判定审查范围本身（选哪条分支、取哪个 commit）由当前会话完成，不下放给审查 subagent。第 2 轮起按"审查-修复循环与终止条件（review-code / review-plan 共用）"的增量语义继续，沿用同一批审查 subagent 会话，不重新 spawn。

命令必须（SHALL）将发现严格分为 Critical、Warning、Info 三个严重度层级。若存在 Critical，命令必须（SHALL）进入审查-修复循环。

#### Scenario: 存在 apply commit 且工作区干净, 仍按该 commit 审查
- **WHEN** 目标 change 存在最近一期 `apply:` commit, 当前工作区与暂存区都干净, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = 该 `apply:` commit 的差异, 命令按该差异审查并输出分级结果, SHALL NOT 报"无变更可审查"

#### Scenario: 无 apply commit 时退化为 propose commit
- **WHEN** 目标 change 尚无 `apply:` commit, 但存在最近一期 `propose:` commit, 当前工作区干净, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = 该 `propose:` commit 的差异, 命令按该差异审查并输出分级结果, SHALL NOT 回退到任意更早历史 commit

#### Scenario: 存在未提交变更且无 Critical
- **WHEN** 目标 change 无相关 `apply:`/`propose:` commit, 当前工作区存在未提交变更, 审查 subagent 审查后未发现任何 Critical
- **THEN** 审查范围 = `git diff HEAD` + 未跟踪文件路径清单, 发现按 Critical/Warning/Info 分级输出, 命令直接结束, 不进入修复循环

#### Scenario: 工作区干净但有历史提交, 报告无变更
- **WHEN** 目标 change 既无 `apply:` commit 也无 `propose:` commit, 仓库有 HEAD 且当前工作区与暂存区都干净, 用户运行 `/ly:review-code`
- **THEN** 命令报告"无变更可审查"并直接结束, SHALL NOT 审查 `git diff HEAD~1` 或 `git show HEAD`

#### Scenario: 已跟踪的修改与新建的未跟踪文件同时存在
- **WHEN** 目标 change 无相关 commit, 工作区既有已跟踪文件的修改, 也有新建的未跟踪文件, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = `git diff HEAD` + 未跟踪文件路径清单; TASK 只包含基线引用说明和未跟踪路径, 审查 subagent 自行读取实际内容, 未跟踪文件不被静默遗漏

#### Scenario: 仓库尚无任何 commit
- **WHEN** 目标 change 无相关 commit, 且 `git rev-parse HEAD` 失败, 用户运行 `/ly:review-code`
- **THEN** 审查范围用 `git diff --cached` + `git diff` + 未跟踪路径清单三条固定命令表达, 不因缺失 HEAD 报错; TASK 只传命令组合说明, 不由当前会话把内容整段贴入

#### Scenario: 仓库只有一个 commit 且工作区干净
- **WHEN** 目标 change 无相关 `apply:`/`propose:` commit, 仓库只有一个不匹配该 change 的历史 commit 且工作区干净, 用户运行 `/ly:review-code`
- **THEN** 命令报告"无变更可审查"并直接结束, SHALL NOT 审查该单个 commit 的完整内容

#### Scenario: 无发现
- **WHEN** 审查 subagent 没有返回任何问题
- **THEN** 命令明确说明未发现问题, 而不是保持沉默

#### Scenario: 首轮 TASK 不预先拼贴完整 diff 文本
- **WHEN** 首轮按某 `apply:` commit 确定审查范围, 且该 commit 差异有数百行
- **THEN** 传给审查 subagent 的 TASK 只包含基线引用说明及未跟踪路径清单, 不包含当前会话预读拼接的完整 diff; 审查 subagent 自行执行对应命令获取实际内容

#### Scenario: 审查模型未配置时回退当前会话模型
- **WHEN** 用户未配置 `codexHost.reviewModel` 或 `reviewModelB`（或配置为空白）, 然后运行 `/ly:review-code`
- **THEN** 对应审查 agent 的模型回退继承当前会话模型; spawn SHALL NOT 携带 shell 层 `-m` 参数

#### Scenario: 推理档未配置时不传; 非空时随对应模型传入
- **WHEN** 用户运行 `/ly:review-code`, `reviewReasoningEffort` 为空白而 `reviewReasoningEffortB = "low"`
- **THEN** 审查 agent A 不传推理档参数, 审查 agent B 以 `reviewReasoningEffortB` 的 trim 后原值随 `reviewModelB` 传入 `reasoning_effort`, SHALL NOT 使用任何模型名到档位的硬编码映射

#### Scenario: 第 2 轮以 resume 模式续聊同一会话
- **WHEN** `/ly:review-code` 首轮存在未清零 Critical, 循环进入第 2 轮
- **THEN** 第 2 轮继续使用同一批审查 subagent（利用 fork 会话的轮间记忆）, TASK 只包含上一轮全部 Critical 逐字原文与路径清单; 该续聊由"沿用同一批 subagent 会话"实现, SHALL NOT 构造 shell 层 `codex exec resume <session_id>`，也不重新拼贴完整基线 diff

### Requirement: 方案审查分级输出发现

`/ly:review-plan` 必须（SHALL）读取目标 change 的 `proposal.md`/`design.md`/`tasks.md`（存在的部分即可, 缺失容错跳过）以及该 change 目录下 `specs/**/*.md` 的全部 delta spec 文件（若存在；不存在则容错跳过, 不报错）的路径, 由两位并行审查 subagent fork 当前会话上下文执行审查, 并将发现分为 Critical、Warning、Info 三个严重度层级。审查执行方式由"审查关卡以双审查 subagent 执行"定义：模型按 `codexHost.reviewModel`（agent A）/ `reviewModelB`（agent B）配置、未配置或空白时继承当前会话模型, 对应推理档 `reviewReasoningEffort`/`reviewReasoningEffortB` 非空时随 spawn 传入；命令 SHALL NOT 使用 `codex exec`、`-m`、`session_id` 或 `resume`。两个审查 subagent 的任务 SHALL 先指示读取 ROLE_FILE `~/.ly/prompts/codex/plan-reviewer.md`（角色词内容不重写）, 再给出路径清单。**首轮**只传该 change 目录路径和 `proposal.md`/`design.md`/`tasks.md`/全部 delta spec 文件路径清单, 不预先读取并拼贴文件全文；若某份 delta spec 显式引用了基线 spec 中未被本次修改的既有 Requirement, 命令必须（SHALL）额外把对应基线 spec 路径纳入清单, 并在 TASK 中说明该路径仅作审查上下文、不属于修复对象。审查必须（SHALL）聚焦方案文档本身的逻辑缺陷：遗漏边界、范围不清晰、`proposal.md`/`design.md`/`tasks.md`/对应 spec 互相矛盾或脱节、风险点交代不清、spec 的 Requirement/Scenario 未覆盖 proposal 的 What Changes。SHALL NOT 将"代码库尚未实现某方案条目"或"`tasks.md` 中某任务未勾选"作为 Critical 依据。若存在 Critical, 命令必须（SHALL）进入审查-修复循环。

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
- **THEN** 传给审查 subagent 的 TASK 只包含这些文件的相对路径清单和 change 目录路径, 不包含当前会话预读拼接的完整内容; 审查 subagent 自行读取这些路径的当前内容

#### Scenario: 审查模型未配置时回退当前会话模型（review-plan）
- **WHEN** 用户未配置 `codexHost.reviewModel` 或 `reviewModelB`（或配置为空白）, 运行 `/ly:review-plan`
- **THEN** 对应审查 agent 的模型回退继承当前会话模型; spawn SHALL NOT 携带 shell 层 `-m` 参数

#### Scenario: 审查模型配置了推理档时随对应 spawn 传入
- **WHEN** 用户配置 `reviewModelB = "glm-5.3-flash"` 与 `reviewReasoningEffortB = "low"`, 运行 `/ly:review-plan`
- **THEN** 审查 agent B 的 spawn 读取 `reviewReasoningEffortB` 并把 `reasoning_effort: "low"` 随 `reviewModelB` 一并传入; 空白档位不传参, SHALL NOT 使用模型名到档位的硬编码映射

### Requirement: 审查调用失败视为独立终止条件

`/ly:review-code` 与 `/ly:review-plan` 必须（SHALL）区分两阶段审查调用失败：**运行期失败**（spawn 后超时、返回内容格式不符、审查 agent 未返回有效结论、双审查任一 agent 调用失败且无法按回退口径继续、回退不可行或回退后仍失败）视为独立终止条件, 如实报告原因并停止循环, 不得把失败等同于"本轮无 Critical"或视为清零通过；**环境级不可用**（宿主无 subagent 能力、初始 spawn 不可用）按 `subagent-agent-config` 的回退口径处理——回退当前会话直接执行审查, 并如实报告"已回退, 原因：subagent 不可用", SHALL NOT 视为流程失败中断整体编排。当失败可归因于单一 agent 且另一 agent 结论完整时, SHALL 以完整一方结论继续审查并如实报告降级（含失败 agent 与原因）, SHALL NOT 归入"分歧未决"（环境级失败非意见分歧）；是否补跑或重试由主会话决定。配置读取失败（缺文件或解析错误）SHALL 视为"配置状态未知", 明确提示"无法读取配置, 请运行 `lycx doctor` 检查", SHALL NOT 按"未配置"静默继承回退。

#### Scenario: 审查调用超时
- **WHEN** 审查 subagent 调用超过预设时限未返回有效结论
- **THEN** 命令按独立终止条件处理, 如实报告超时事实与已取得的部分结论（如有）, 不进入下一轮

#### Scenario: 返回内容格式不符
- **WHEN** 审查 subagent 返回内容不符合约定输出结构, 无法解析出 Critical/Warning/Info
- **THEN** 命令按独立终止条件处理, 报告原始返回内容与解析失败原因, 不猜测改写后继续

#### Scenario: 双审查 agent 均调用失败
- **WHEN** 两个审查 subagent 均无法产出结论（spawn 失败或超时）
- **THEN** 按独立终止条件结束审查, 如实报告"审查调用失败"及原因, 不进入下一轮

#### Scenario: 环境级 subagent 不可用, 回退当前会话直接审查
- **WHEN** 当前 codex 环境无 subagent 能力或在初始 spawn 即不可用, 用户运行 `/ly:review-plan` 或 `/ly:review-code`
- **THEN** 命令回退为当前会话直接执行审查并如实报告"已回退, 原因：subagent 不可用", SHALL NOT 视为流程失败中断整体编排

#### Scenario: 单一 agent 失败且另一 agent 结论完整
- **WHEN** 双审查中一个审查 agent 调用失败, 另一个 agent 返回完整结论
- **THEN** 命令以完整一方结论继续审查并如实报告降级（含失败 agent 与原因）, 不归入"分歧未决"; 是否补跑或重试由主会话决定

#### Scenario: 模板运行前读取配置失败
- **WHEN** 审查 subagent spawn 前读取 `~/.ly/config.toml` 失败（缺文件或解析错误）
- **THEN** 命令明确提示"无法读取配置, 请运行 `lycx doctor` 检查", 按"配置状态未知"处理, SHALL NOT 按"未配置"静默继承回退

### Requirement: 审查关卡以双审查 subagent 执行

review-plan 与 review-code 两个审查关卡 SHALL 各 spawn 2 个审查 subagent 执行：两个 agent SHALL 并行且各自独立审查（互不见对方结论），随后交换结论并达成共识；每个审查 subagent SHALL fork 当前会话上下文, 并在任务中点名审查范围（review-plan 为"只审 change 产物：proposal/design/specs/tasks", review-code 为"只审最近一次相关 commit 对应 diff（`apply:` commit，未有 `apply:` 时退化为 `propose:` commit）及未跟踪清单"），SHALL NOT 超出点名范围作业。审查任务 SHALL 继续引用各自 ROLE_FILE（`~/.ly/prompts/codex/plan-reviewer.md` / `reviewer.md`），角色词内容不重写。

模型与推理档 SHALL 经"模板指示 + 宿主 spawn 能力"落实：审查 agent A 用 `codexHost.reviewModel` + 非空 `reviewReasoningEffort`，审查 agent B 用 `codexHost.reviewModelB` + 非空 `reviewReasoningEffortB`；模型未配置或空白时继承当前会话模型，推理档 trim 后为空时不传 `reasoning_effort`。SHALL NOT 依赖任何 shell 层模型或推理档参数，SHALL NOT 内置"模型名 → 推理档"的硬编码映射。审查 subagent 具备自主执行 shell 命令与读取文件的能力；TASK SHALL 只传基线引用或路径清单，SHALL NOT 由当前会话预先读取并拼贴审查内容全文。

**共识归并**：两 agent 结论合并去重后作为本轮审查结论；部分重叠或冲突的条目 SHALL 一并列出交主会话判定，SHALL NOT 静默丢弃任一 agent 的独立发现。

**分歧时序**：双 agent 首次分歧且主会话不能确认 → 判定 Critical 进入修复循环；下一轮复审双 agent 仍分歧且主会话仍不能确认 → 触发"分歧未决"终止条件。

#### Scenario: 双审查 agent 均通过
- **WHEN** 两个审查 subagent 独立审查后达成一致，均未提出 Critical
- **THEN** 结论直接回主会话（pass / 问题清单），进入下一环节

#### Scenario: 双审查 agent 意见分歧
- **WHEN** 审查 agent A 提出 Critical 而审查 agent B 未提出，或两者结论冲突
- **THEN** 主会话拍板，且 SHALL 显式提示用户"这是审查分歧"；主会话能确认 → 按确认结论处理；不能确认 → 判定 Critical（red）进入修复循环

#### Scenario: 双审查 agent 按配置模型和推理档 spawn
- **WHEN** 用户配置 `reviewModel = "A"`, `reviewModelB = "B"`, `reviewReasoningEffort = "low"`, 运行一个审查关卡
- **THEN** 审查 agent A 以模型 A 和推理档 `low` spawn, 审查 agent B 以模型 B 且不传推理档 spawn; 两者并行独立审查并 fork 当前会话上下文
