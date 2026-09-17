# subagent-agent-config Specification

## Purpose
定义 codex 单宿主下审查 / 实施的执行者与子代理模型指定契约：`reviewExecutor` / `codingExecutor` 决定主体（未配置、空白或非法取值等价 `main` = 主 agent 直接执行；`subagent` = spawn 独立子代理）；`reviewModel` / `codingModel` 与对应推理档仅在执行者为 `subagent` 时生效，未配置或空白回退当前会话模型，由"模板指示 + 宿主能力"落实。CLI 向导采集执行者二连 + 模型二连，不做清单强校验；agent 模型能否 spawn 由环境实际能力决定（运行期以宿主 spawn 报错为准），spawnableModels 仅作为提示参考字段，lycx doctor 输出提示并附示例 prompt 引导用户实测验证。

## Requirements

### Requirement: codexHost 提供 codingModel 与 reviewModelB 可选模型字段

**字段集合变更（自本 change 起）**：本 Requirement 标题中的 `reviewModelB` 为历史措辞——自 `switchable-executor-flow` 起 `reviewModelB` 字段被移除，`[codexHost]` 改为提供执行者字段 `reviewExecutor` / `codingExecutor`。语义以正文为准。

`~/.codex/lyx/config.toml` 的 `[codexHost]` 节 SHALL 提供 `reviewModel`、`codingModel`、`reviewExecutor`、`codingExecutor` 四个可选字段，均非必填。

**执行者字段语义**：`reviewExecutor` SHALL 决定审查关卡（`@lyx-review-plan` / `@lyx-review-code`）的执行者，`codingExecutor` SHALL 决定实施环节（`@lyx-apply`）的执行者；取值 SHALL 为 `"main"` 或 `"subagent"`，未配置、空白或非法取值 SHALL 等价于 `"main"`（主 agent 直接执行）。该默认值 SHALL 视为破坏性变更：升级用户即使不改配置，行为也会从"spawn 子代理"变为"主 agent 直接执行"。

**模型字段语义**：`reviewModel` / `codingModel` SHALL 仅在对应执行者为 `"subagent"` 时生效，未配置或空白时回退当前会话模型。执行者为 `"main"` 时，模型字段与对应推理档字段 SHALL 被忽略，`lycx doctor` 对该组合输出 WARN 提示（见「doctor 校验子代理模型配置」）。

`src/types/index.ts` SHALL 同步移除 `reviewModelB` 类型定义，新增 `reviewExecutor` / `codingExecutor` 字段。

#### Scenario: 仅配置 reviewModel，未配置新字段
- **WHEN** 用户只配置 `codexHost.reviewModel`，未配置 `codingModel` / `reviewExecutor` / `codingExecutor`
- **THEN** 两个执行者均视为未配置（等价 `main`），审查与实施由主 agent 直接执行；`reviewModel` 因执行者为 `main` 不生效，`lycx doctor` 输出 WARN

#### Scenario: 存量 reviewModelB 保留但不生效
- **WHEN** 用户存量配置包含 `reviewModelB = "B"`，运行审查关卡
- **THEN** 自本 change 起该字段被移除：不再被读取、不再保留写回，`lycx doctor` 提示该字段已移除；用户如需独立审查应配置 `reviewExecutor = "subagent"`（本 scenario 标题为历史标签，语义以正文为准）

#### Scenario: 三个字段全部配置
- **WHEN** 用户配置 `reviewExecutor = "subagent"`、`reviewModel = "A"`、`codingExecutor = "subagent"`、`codingModel = "C"`
- **THEN** 审查 subagent 用 A、coding subagent 用 C（本 scenario 标题中"三个字段"为历史措辞）

#### Scenario: 未配置执行者字段时默认主 agent 执行
- **WHEN** 用户 `~/.codex/lyx/config.toml` 的 `[codexHost]` 未配置 `reviewExecutor` / `codingExecutor`
- **THEN** 审查与实施均由主 agent 直接执行，不 spawn 子代理

#### Scenario: 执行者为 main 时模型字段被忽略
- **WHEN** 用户配置 `reviewExecutor = "main"` 与 `reviewModel = "gpt-5.6-terra"`
- **THEN** 审查由主 agent 直接执行，`reviewModel` 不生效；`lycx doctor` 对该组合输出 WARN 提示
### Requirement: codexHost 提供三个可选推理档字段（与模型字段一一对应）

**字段集合变更（自本 change 起）**：本 Requirement 标题中"三个推理档字段"为历史措辞——`reviewReasoningEffortB` 随 `reviewModelB` 一并移除，`[codexHost]` 改为提供两个推理档字段。语义以正文为准。

`~/.codex/lyx/config.toml` 的 `[codexHost]` 节 SHALL 提供 `reviewReasoningEffort`（对应 `reviewModel`）与 `codingReasoningEffort`（对应 `codingModel`）两个可选推理档字段，均非必填。字段值 SHALL 为非空字符串（trim 后使用）；未配置、空白或清洗后为空 SHALL 等价于"未配置"，语义 = 不传推理档参数（保持宿主/模型默认档）。取值本身 SHALL NOT 做枚举白名单强校验——合法档位随模型与宿主能力漂移，判定以宿主/上游实际报错为准并如实展示。

推理档 SHALL 仅在对应执行者为 `"subagent"` 时生效；执行者为 `"main"`（含未配置）时该字段被忽略，`lycx doctor` 输出 WARN 提示。

交互 init、非交互模式（`--skip-prompt`）、`lycx update` 与菜单单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有两字段原值，SHALL NOT 因重装或编辑而丢弃。

`src/types/index.ts` SHALL 同步移除 `reviewReasoningEffortB` 类型定义。

#### Scenario: 三个推理档字段均未配置
- **WHEN** 用户 `[codexHost]` 只配置了模型字段，未配置任何推理档字段
- **THEN** 对应 subagent 的 spawn 不传推理档参数，行为与未引入推理档字段之前一致（标题"三个"为历史措辞，实际两字段）

#### Scenario: 为需要显式档位的模型配置推理档
- **WHEN** 用户配置 `reviewExecutor = "subagent"`、`reviewModel = "glm-5.3-flash"` 与 `reviewReasoningEffort = "low"`
- **THEN** 审查 subagent 以模型 `glm-5.3-flash` + 推理档 `low` spawn；该值经 trim 后使用，不因不在任何内置/维护清单内被拦阻或警告

#### Scenario: reviewReasoningEffortB 已配置但不生效
- **WHEN** 用户存量配置 `reviewReasoningEffortB = "low"`，运行审查关卡
- **THEN** 自本 change 起该字段被移除：不被读取、不被保留写回，`lycx doctor` 提示已移除（标题为历史标签，语义以正文为准）

#### Scenario: 推理档字段为空白
- **WHEN** 用户配置 `codingReasoningEffort = "   "`（纯空白）
- **THEN** 等价于未配置，coding subagent 的 spawn 不传推理档参数，SHALL NOT 传空字符串

#### Scenario: update 重装保留已配置的推理档
- **WHEN** 用户已配置两个推理档字段后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.codex/lyx/config.toml` 仍保留两个推理档字段原值，SHALL NOT 被重置

#### Scenario: menu 单字段编辑不丢推理档
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"仅编辑 `reviewModel`，而两个推理档字段已有配置
- **THEN** 写回后两个推理档字段原值保留，SHALL NOT 被清除

#### Scenario: 执行者为 main 时推理档被忽略
- **WHEN** 用户配置 `reviewExecutor = "main"` 与 `reviewReasoningEffort = "low"`
- **THEN** 审查由主 agent 直接执行，推理档不生效；`lycx doctor` 对该组合输出 WARN 提示
### Requirement: codexHost.spawnableModels 声明宿主可 spawn 模型清单（提示参考，不作校验来源）
`~/.codex/lyx/config.toml` 的 `[codexHost]` 节 SHALL 提供可选 `spawnableModels` 字符串数组字段：提示参考用，声明当前宿主显式 spawn 子代理可用的模型清单（用户可按实测维护）。该字段未配置、空白或清洗后为空时，提示口径回退使用内置默认常量 `SPAWNABLE_MODELS_DEFAULT`（`gpt-6-astra`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、`gpt-5.5`）。清洗规则 SHALL 为：仅保留非空字符串、逐项 trim、去重；清洗后空数组等价未配置。字段显式存在但整体格式非法（如非数组字面量）时，`lycx doctor` 对该形态输出 WARN 提示（区别于完全未配置的静默通过）。**spawnableModels SHALL NOT 作为模型字段候选或校验来源**——模型二连候选与 doctor 判定均不依赖该清单；SHALL NOT 以 provider `/models` 拉取结果或 `~/.codex/models.json` 注册集合作为候选/校验来源（实测二者均不等于 spawn 可用列表）。agent 模型能否 spawn 由环境实际能力决定，运行期以宿主 spawn 报错为准。

#### Scenario: 未配置 spawnableModels
- **WHEN** 用户 `~/.codex/lyx/config.toml` 的 `[codexHost]` 未配置 `spawnableModels`
- **THEN** 不影响模型二连候选与 doctor 判定；提示口径回退内置默认五模型，流程不受影响

#### Scenario: 用户按实测维护 spawnableModels
- **WHEN** 用户实测本机 spawn 可用列表与内置默认不同（如仅 glm-5.3-flash 可用），将 `spawnableModels = ["glm-5.3-flash"]` 写入配置
- **THEN** 该字段仅作提示参考留存，不改变模型二连候选与 doctor 判定；字段形态合法时不产生 WARN

#### Scenario: spawnableModels 字段格式非法时提示
- **WHEN** 用户 `spawnableModels = "glm-5.3-flash"`（字符串而非数组）等格式非法写法
- **THEN** `lycx doctor` 输出 WARN 提示该字段形态异常（仅提示），模型二连候选与模型字段判定不受影响


### Requirement: 模型经"模板指示 + 宿主能力"落实，subagent 不可用时回退

**执行者门控（自本 change 起）**：本 Requirement 描述的 spawn 行为 SHALL 仅在对应执行者为 `"subagent"` 时适用。执行者为 `"main"`（含未配置）时主 agent 直接执行，SHALL NOT spawn 子代理、SHALL NOT 读取对应模型与推理档字段——该路径不涉及"subagent 不可用回退"。

模型指定 SHALL 以模板内明确的模型指示落实（模板写明各 subagent 的模型取哪个配置字段、未配置用当前会话模型），由运行环境的宿主 spawn 能力执行；模板 SHALL NOT 依赖任何 shell 层模型参数。**未配置（留空）**时 SHALL 回退为继承当前会话模型，SHALL NOT 阻断安装或审查流程。**agent 模型需额外配置**：配置的模型能否 spawn 由运行环境实际能力决定，SHALL NOT 依赖任何硬编码清单或 `/models` 结果预判；运行期判定以宿主 spawn 报错为准。spawn 失败报错原文含 `Unknown model` / `Available models: ...` 时 SHALL 如实展示，提示"该模型当前不支持 spawn，请改用报错中 Available models 列表内的模型"。运行环境无 subagent 能力或初始 spawn 失败 SHALL 按回退口径回退当前会话直接执行，并输出**显式状态标记** `[回退] subagent 不可用: <原始报错>` 作为回退事实的唯一宣告——回退 SHALL NOT 以其他自然语言描述代替，SHALL NOT 在回退后以"审查/实施已完成"之类结论冒充真实执行；该回退 SHALL NOT 视为流程失败。模板运行时读取 `~/.codex/lyx/config.toml` 失败（缺文件/解析错误）SHALL 视为"配置状态未知"：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。

**spawn 方式 SHALL 为非 fork**：审查 subagent 与 coding subagent 均以非 fork 方式 spawn——子代理只携带 spawn 消息（TASK），SHALL NOT 携带父线程对话历史（宿主 V1 语义为 `fork_context: false` 默认值；V2 语义为 `fork_turns: none`）。仅当宿主不支持完全非 fork 而仅支持"最近 N 轮"fork 模式时，SHALL 取最小 N（或 0）近似非 fork 并如实报告；SHALL NOT 使用全量 fork（`fork_turns: all`）。软上下文经 change 目录下 `context.md` 到达子代理（见 `review-context-artifact`），SHALL NOT 以恢复 fork 作为替代。

**子代理跨轮复用**：首轮 spawn 的子代理完成本轮任务后 SHALL 保留，后续轮次 SHALL 优先以 `send_input` 复用同一子代理——宿主 SHALL 支持在子代理首次任务完成后再次唤醒它且其保留自身会话上下文；复用失败（子代理会话丢失、`send_input` 报错、`resume_agent` 不可用）SHALL 回退为重新 spawn 一个全新子代理，并按增量语义携带上一轮全部 Critical 逐字原文与路径清单。SHALL NOT 把"回合结束即失去子代理访问能力"作为必须重新 spawn 的理由。

**推理档经同一条通道落实**：模板 SHALL 读取与各 subagent 模型字段一一对应的推理档字段（审查 subagent 用 `reviewReasoningEffort`，coding subagent 用 `codingReasoningEffort`），该字段非空时 SHALL 把其值作为宿主 spawn 的推理档参数（`reasoning_effort`）随模型一并传入；未配置或空白时 SHALL NOT 传该参数（保持宿主/模型默认档）。模板 SHALL NOT 内置任何"模型名 → 推理档"的硬编码映射，也 SHALL NOT 依赖任何 shell 层参数。推理档取值本身 SHALL NOT 做枚举强校验；该参数被宿主/上游拒绝时 SHALL 如实展示报错原文，并按本 Requirement 既有的 spawn 失败口径处理。

#### Scenario: 宿主无 subagent 能力
- **WHEN** 配置为 `subagent` 但当前 codex 环境不提供 subagent spawn 能力，用户运行 `@lyx-review-plan`
- **THEN** 提示"当前环境无 subagent 能力，已回退为当前会话直接审查"，回退事实以 `[回退] subagent 不可用: <原始报错>` 标记呈现，审查流程以当前会话继续执行

#### Scenario: 初始 spawn 失败（模型不受支持或被拒）
- **WHEN** 模型配置合法但宿主初始 spawn 失败（如报错原文含 `Unknown model ... Available models: ...`）
- **THEN** 如实展示报错原文并提示改用报错中 Available models 列表内模型或当前会话模型；按回退口径回退为当前会话直接执行，输出 `[回退] subagent 不可用: <原始报错>` 标记，不作为流程失败

#### Scenario: 配置了任意模型（含清单外或自定义输入）
- **WHEN** 用户配置 `reviewExecutor = "subagent"` 与 `reviewModel = "glm-5.3-flash"`（不在任何内置/维护清单内，或经向导自定义输入写入）
- **THEN** 作为审查 subagent 的模型指定 spawn，是否可用由宿主实际报错判定，SHALL NOT 因不在清单而被预判"配置无效"

#### Scenario: 模板运行时无法读取配置
- **WHEN** 审查/实施子代理 spawn 前读取 `~/.codex/lyx/config.toml` 失败（缺文件或解析错误）
- **THEN** 明确提示"无法读取配置，请运行 `lycx doctor` 检查"，按"配置状态未知"处理，SHALL NOT 按"未配置"静默继承回退

#### Scenario: 配置了推理档时随 spawn 传入
- **WHEN** 用户配置 `reviewExecutor = "subagent"`、`reviewModel = "glm-5.3-flash"` 与 `reviewReasoningEffort = "low"`，用户运行 `@lyx-review-plan`
- **THEN** 审查 subagent 的 spawn 指示读取该字段并把 `reasoning_effort: "low"` 随模型一并传入，SHALL NOT 因模板未写死该模型而忽略该字段

#### Scenario: 未配置推理档时不传该参数
- **WHEN** 用户未配置 `reviewReasoningEffort`，用户运行 `@lyx-review-plan`
- **THEN** 审查 subagent 的 spawn 不传推理档参数，由宿主/模型使用默认档，SHALL NOT 传空值或占位值

#### Scenario: 推理档被宿主或上游拒绝
- **WHEN** 配置的推理档取值不被宿主或上游接受（如报错原文含不受支持的档位说明）
- **THEN** 如实展示报错原文并报告该 subagent 失败原因，按既有 spawn 失败口径处理，SHALL NOT 把该字段预判为"配置无效"或在未实测前拦截

#### Scenario: subagent 均以非 fork 方式 spawn
- **WHEN** 审查关卡或 apply 编排 spawn 审查/coding subagent
- **THEN** 子代理只携带 spawn 消息（TASK，含 context.md 路径引用），不携带主会话对话历史；SHALL NOT 使用全量 fork

#### Scenario: 执行者为 main 时不 spawn 且不读取模型字段
- **WHEN** 用户未配置 `reviewExecutor`（等价 `main`），运行 `@lyx-review-plan`
- **THEN** 主 agent 直接执行审查，不 spawn 子代理、不读取 `reviewModel` / `reviewReasoningEffort`，不产生回退标记

#### Scenario: 第 2 轮复用同一子代理
- **WHEN** 首轮审查 subagent 报告了 Critical，主会话修复后进入第 2 轮
- **THEN** 主会话以 `send_input` 复用首轮那个子代理（携带修复说明与上轮 Critical 原文），SHALL NOT 默认重新 spawn 全新子代理

#### Scenario: 复用失败时回退重新 spawn
- **WHEN** 第 2 轮尝试 `send_input` 复用首轮子代理失败（会话丢失或 `resume_agent` 报错）
- **THEN** 主会话回退为重新 spawn 一个全新子代理，TASK 按增量语义携带上一轮全部 Critical 逐字原文与路径清单，并在报告中说明复用失败
### Requirement: init 向导按"提供方 → 模型三连"采集三个模型字段

**采集集合变更（自本 change 起）**：本 Requirement 标题中"模型三连/三个模型字段"为历史措辞——向导实际采集**执行者二连 + 模型二连**（`reviewExecutor`、`codingExecutor`、`reviewModel`、`codingModel`），语义以正文为准。

`lycx init` 向导 SHALL 在交互模式先采集两个执行者字段，再采集两个模型字段。**执行者采集**：逐字段 list 选择，候选 SHALL 为「主 agent 直接执行（默认，值为 `main`）」与「spawn 独立子代理（值为 `subagent`）」；未配置或既有值为空 SHALL 默认选中"主 agent 直接执行"。**模型采集**：仅在对应执行者为 `"subagent"` 时提示采集，候选 SHALL 为「继承当前会话模型（留空）+ 自定义输入 + 既有值（若有）」，SHALL NOT 包含内置/维护清单字面量。执行者为 `"main"` 时不采集对应模型字段，并 SHALL 在摘要中标注"该模型字段不生效"。

交互流程 SHALL 为"语言 → 选定 API 提供方 → Codex 现状检测展示 → 执行者二连 → 模型采集（按执行者） → 配置摘要"，SHALL NOT 包含"工作流模式"与"选择 Agent"等单选项步骤。现状检测 SHALL 为纯静态读取（`~/.codex/config.toml` 顶层 `model`、`[model_providers.*]` 条目、`~/.codex/models.json` 注册规模），读取失败 SHALL 标注"未检测到"且不阻断。**候选 SHALL NOT 依赖 provider 的 `/models` 拉取结果**。

交互 init、非交互模式（`--skip-prompt`）与 menu 单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有 `codingModel`、`spawnableModels` 与两个推理档字段，SHALL NOT 因重装或编辑而丢弃；已移除的 `reviewModelB` / `reviewReasoningEffortB` SHALL NOT 被写回。

#### Scenario: 全新安装，三字段均选择"不设置"
- **WHEN** 用户全新运行 `lycx init`，执行者与模型字段均选择默认（主 agent 直接执行、模型留空）
- **THEN** 配置摘要明确标注"主 agent 直接执行"与模型字段不生效，不阻断安装（标题"三字段"为历史措辞）

#### Scenario: update 重装保留已配置的 B/coding 字段
- **WHEN** 用户已配置 `codingModel` 后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.codex/lyx/config.toml` 仍保留 `codingModel` 原值，`spawnableModels` 与两个推理档字段同规则保留，SHALL NOT 被重置；已移除的 `reviewModelB` 不再写回

#### Scenario: 自定义输入配置模型（含清单外模型名）
- **WHEN** 用户在执行者为 `subagent` 后的模型采集选择"自定义输入"，输入 `glm-5.3-flash`（不在任何内置/维护清单内）
- **THEN** 该值经 trim 写回对应字段，不因不在清单而被拦阻或警告；可用性由环境在实际 spawn 时判定

#### Scenario: update 重装保留已配置的模型字段
- **WHEN** 用户已配置 `reviewModel` / `codingModel` 后运行 `lycx update`
- **THEN** 重装后 `~/.codex/lyx/config.toml` 仍保留两字段原值，`spawnableModels` 与两个推理档字段同规则保留，SHALL NOT 被重置

#### Scenario: menu 单字段编辑不丢其余字段
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"仅编辑 `reviewModel`，而执行者字段与其余字段已有配置
- **THEN** 写回后其余字段原值保留，SHALL NOT 被清除

#### Scenario: 交互重装保留既有值作默认并统一写回
- **WHEN** 用户已有执行者与模型配置后交互运行 `lycx init`（未跳过提示），未改动任一字段直接确认
- **THEN** 采集字段均以既有值写回配置，`spawnableModels` 与两个推理档字段同规则保留，等效于原配置不变

#### Scenario: 候选不依赖 /models 拉取，自由输入入口保留
- **WHEN** 模型采集候选机制不依赖选定 provider 的 `GET {base_url}/models` 拉取（/models 结果不作为候选/校验来源）
- **THEN** 候选 = "留空（默认继承） + 自定义输入 + 既有值（若有，默认）"，任意环境（含 /models 不可达）下均可正常选择，不阻断安装

#### Scenario: Codex 现状检测展示主模型
- **WHEN** `~/.codex/config.toml` 顶层配置 `model = "DeepSeek-V4.1-Flash"`，用户运行 `lycx init` 进入模型采集前
- **THEN** 现状检测展示主会话模型 `DeepSeek-V4.1-Flash` 与 provider 信息，"留空（继承）"选项标注该实际值；该展示仅作背景参考，不进入候选

#### Scenario: 非交互重装不触发现状检测与候选选择
- **WHEN** 用户运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 不展示现状检测、不进行候选选择，配置字段与 `spawnableModels`、两个推理档字段原值保留写回，等效于原配置不变

#### Scenario: 现状检测附推理参数坑提示
- **WHEN** init 现状检测展示块渲染（交互模式模型采集前）
- **THEN** 展示块附带 `reasoning_effort` 参数坑提示（指明对应推理档字段为维护入口、向导不交互采集该参数、手改 `~/.codex/lyx/config.toml`）与"agent 模型需额外配置、附示例验证 prompt"提示，既有检测项照常展示

#### Scenario: 全新安装默认主 agent 执行
- **WHEN** 用户全新运行 `lycx init`，执行者二连均选择"主 agent 直接执行"
- **THEN** 配置写入 `reviewExecutor = "main"` 与 `codingExecutor = "main"`（或等价未配置），摘要标注两个模型字段不生效，不阻断安装

#### Scenario: 选择 subagent 后采集模型
- **WHEN** 用户在执行者二连为审查选择"spawn 独立子代理"
- **THEN** 向导随后采集 `reviewModel`，候选为「继承当前会话模型（留空）+ 自定义输入 + 既有值」，不含任何内置清单
### Requirement: doctor 校验子代理模型配置（提示型）

`lycx doctor` SHALL 提供"Codex 子代理模型配置"检查项，展示两个执行者字段与相关模型 / 推理档字段的当前状态，只做提示不做清单强校验。

**执行者字段**：`reviewExecutor` / `codingExecutor` 留空或 `"main"` = 通过，标注"主 agent 直接执行"；`"subagent"` = 通过，标注"spawn 独立子代理"。取值非法（非 `main` / `subagent` 的非空字符串）SHALL 输出 WARN 提示取值非法并按 `main` 处理。

**模型与推理档字段**：执行者为 `"subagent"` 时，`reviewModel` / `codingModel` 留空 = 通过（继承当前会话模型），非空 = 通过（已配置，提示"agent 模型需额外配置"，能否 spawn 由环境实际能力决定）；对应推理档非空 = 展示该值（仅展示，不做枚举强校验），未配置或空白 = 标注未配置（等价不传该参数）。执行者为 `"main"` 时，若对应模型或推理档字段非空，SHALL 输出 WARN 提示"主 agent 执行时该字段不生效"，并展示该值。

检查项 SHALL 展示当前主会话模型（可检测时）并附示例 prompt 引导用户实测验证某模型是否可 spawn（报错原文含 `Unknown model ... Available models: ...` 即不支持）。`spawnableModels` 字段显式存在但格式非法 / 清洗后为空时 SHALL 输出 WARN 提示该形态（仅提示），模型字段判定不受影响。`reviewModelB` / `reviewReasoningEffortB` 已移除，存量配置 SHALL 被提示"该字段已移除"。

#### Scenario: 三个模型字段均留空
- **WHEN** 用户未配置任何子代理模型字段，运行 `lycx doctor`
- **THEN** 该项判定通过，标注执行者均"主 agent 直接执行"、模型字段未生效，展示主会话模型实际值并附验证示例 prompt（标题"三个"为历史措辞）

#### Scenario: 配置了任意模型（含清单外）
- **WHEN** 用户配置 `reviewExecutor = "subagent"` 与 `reviewModel = "deepseek-v4-flash"`（不在任何内置/维护清单），运行 `lycx doctor`
- **THEN** 该项判定通过（已配置，标注 agent 模型需额外配置），不报 FAIL、不输出清单

#### Scenario: 存量 reviewModelB 触发弃用提示
- **WHEN** 用户存量配置 `reviewModelB = "old-model"`、`reviewReasoningEffortB = "low"`，运行 `lycx doctor`
- **THEN** 检查项提示这两个字段已移除、不再被读取，整体判定不因此变化（不报 FAIL）

#### Scenario: spawnableModels 格式非法
- **WHEN** 用户 `spawnableModels` 字段格式非法或清洗后为空，运行 `lycx doctor`
- **THEN** 检查项输出 WARN 提示该形态（仅提示），模型字段判定仍通过

#### Scenario: 展示已配置的推理档
- **WHEN** 用户配置 `reviewExecutor = "subagent"`、`reviewReasoningEffort = "low"`，未配置 `codingReasoningEffort`，运行 `lycx doctor`
- **THEN** 检查项展示 `reviewReasoningEffort` 当前值（仅展示、不判定合法性），`codingReasoningEffort` 标注"未配置（不传推理档参数）"，整体判定不因推理档取值变化

#### Scenario: 默认主 agent 执行
- **WHEN** 用户未配置执行者字段，运行 `lycx doctor`
- **THEN** 检查项标注两个执行者均为"主 agent 直接执行"，模型与推理档字段因不生效而只作展示，不报 FAIL

#### Scenario: 执行者为 subagent 且模型已配置
- **WHEN** 用户配置 `reviewExecutor = "subagent"` 与 `reviewModel = "deepseek-v4-flash"`，运行 `lycx doctor`
- **THEN** 该项判定通过（已配置，标注 agent 模型需额外配置），不报 FAIL

#### Scenario: 执行者为 main 但模型字段非空
- **WHEN** 用户配置 `reviewExecutor = "main"` 与 `reviewModel = "gpt-5.6-terra"`，运行 `lycx doctor`
- **THEN** 检查项输出 WARN 提示该模型字段在主 agent 执行时不生效，并展示该值

#### Scenario: 执行者取值非法
- **WHEN** 用户配置 `reviewExecutor = "auto"`（非法取值），运行 `lycx doctor`
- **THEN** 检查项输出 WARN 提示取值非法，并按 `main` 处理
