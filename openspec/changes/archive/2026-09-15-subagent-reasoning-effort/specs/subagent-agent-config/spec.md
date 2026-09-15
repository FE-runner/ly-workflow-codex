## ADDED Requirements

### Requirement: codexHost 提供三个可选推理档字段（与模型字段一一对应）
`~/.ly/config.toml` 的 `[codexHost]` 节 SHALL 提供 `reviewReasoningEffort`、`reviewReasoningEffortB`、`codingReasoningEffort` 三个可选推理档字段，分别与 `reviewModel`（审查 agent A）、`reviewModelB`（审查 agent B）、`codingModel`（coding subagent）一一对应，均非必填。字段值 SHALL 为非空字符串（trim 后使用）；未配置、空白或清洗后为空 SHALL 等价于"未配置"，语义 = 不传推理档参数（保持宿主/模型默认档）。取值本身 SHALL NOT 做枚举白名单强校验——合法档位随模型与宿主能力漂移，判定以宿主/上游实际报错为准并如实展示。`src/types/index.ts` 的类型定义 SHALL 同步这三个可选字段。交互 init、非交互模式（`--skip-prompt`）、`lycx update` 与菜单单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有三字段原值，SHALL NOT 因重装或编辑而丢弃。

#### Scenario: 三个推理档字段均未配置
- **WHEN** 用户 `[codexHost]` 只配置了三个模型字段，未配置任何推理档字段
- **THEN** 三个 subagent 的 spawn 均不传推理档参数，行为与引入本字段之前一致，流程不受影响

#### Scenario: 为需要显式档位的模型配置推理档
- **WHEN** 用户配置 `reviewModel = "glm-5.3-flash"` 与 `reviewReasoningEffort = "low"`
- **THEN** 审查 agent A 以模型 `glm-5.3-flash` + 推理档 `low` spawn；该值经 trim 后使用，不因不在任何内置/维护清单内被拦阻或警告

#### Scenario: 推理档字段为空白
- **WHEN** 用户配置 `codingReasoningEffort = "   "`（纯空白）
- **THEN** 等价于未配置，coding subagent 的 spawn 不传推理档参数，SHALL NOT 传空字符串

#### Scenario: update 重装保留已配置的推理档
- **WHEN** 用户已配置三个推理档字段后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.ly/config.toml` 仍保留三个推理档字段原值，SHALL NOT 被重置

#### Scenario: menu 单字段编辑不丢推理档
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"仅编辑 `reviewModel`，而三个推理档字段已有配置
- **THEN** 写回后三个推理档字段原值保留，SHALL NOT 被清除

## MODIFIED Requirements

### Requirement: 模型经"模板指示 + 宿主能力"落实，subagent 不可用时回退
模型指定 SHALL 以模板内明确的模型指示落实（模板写明各 subagent 的模型取哪个配置字段、未配置用当前会话模型），由运行环境的宿主 spawn 能力执行；模板 SHALL NOT 依赖任何 shell 层模型参数。**未配置（留空）**时 SHALL 回退为继承当前会话模型，SHALL NOT 阻断安装或审查流程。**agent 模型需额外配置**：配置的模型能否 spawn 由运行环境实际能力决定，SHALL NOT 依赖任何硬编码清单或 `/models` 结果预判；运行期判定以宿主 spawn 报错为准。spawn 失败报错原文含 `Unknown model` / `Available models: ...` 时 SHALL 如实展示，提示"该模型当前不支持 spawn，请改用报错中 Available models 列表内的模型"。运行环境无 subagent 能力或初始 spawn 失败 SHALL 按回退口径回退当前会话直接执行并如实报告"已回退，原因：subagent 不可用"，该回退 SHALL NOT 视为流程失败。模板运行时读取 `~/.ly/config.toml` 失败（缺文件/解析错误）SHALL 视为"配置状态未知"：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。

**推理档经同一条通道落实**：模板 SHALL 读取与各 subagent 模型字段一一对应的推理档字段（`reviewReasoningEffort`/`reviewReasoningEffortB`/`codingReasoningEffort`），该字段非空时 SHALL 把其值作为宿主 spawn 的推理档参数（`reasoning_effort`）随模型一并传入；未配置或空白时 SHALL NOT 传该参数（保持宿主/模型默认档）。模板 SHALL NOT 内置任何"模型名 → 推理档"的硬编码映射，也 SHALL NOT 依赖任何 shell 层参数。推理档取值本身 SHALL NOT 做枚举强校验；该参数被宿主/上游拒绝时 SHALL 如实展示报错原文，并按本 Requirement 既有的 spawn 失败口径处理，SHALL NOT 归入"配置无效"分支。

#### Scenario: 宿主无 subagent 能力
- **WHEN** 当前 codex 环境不提供 subagent spawn 能力，用户运行 `@lyx-review-plan`
- **THEN** 提示"当前环境无 subagent 能力，已回退为当前会话直接审查"，审查流程以当前会话继续执行

#### Scenario: 配置了任意模型（含清单外或自定义输入）
- **WHEN** 用户 `[codexHost] reviewModel = "glm-5.3-flash"`（不在任何内置/维护清单内，或经向导自定义输入写入）
- **THEN** 作为审查 agent A 的模型指定 spawn，是否可用由宿主实际报错判定，SHALL NOT 因不在清单而被预判"配置无效"

#### Scenario: 初始 spawn 失败（模型不受支持或被拒）
- **WHEN** 模型配置合法但宿主初始 spawn 失败（如报错原文含 `Unknown model ... Available models: ...`）
- **THEN** 如实展示报错原文并提示改用报错中 Available models 列表内模型或当前会话模型；按回退口径回退为当前会话直接执行并如实报告"已回退，原因：subagent 不可用"，不作为流程失败

#### Scenario: 模板运行时无法读取配置
- **WHEN** 审查/实施子代理 spawn 前读取 `~/.ly/config.toml` 失败（缺文件或解析错误）
- **THEN** 明确提示"无法读取配置，请运行 `lycx doctor` 检查"，按"配置状态未知"处理，SHALL NOT 按"未配置"静默继承回退

#### Scenario: 配置了推理档时随 spawn 传入
- **WHEN** 用户 `[codexHost]` 同时配置 `reviewModel = "glm-5.3-flash"` 与 `reviewReasoningEffort = "low"`，用户运行 `@lyx-review-plan`
- **THEN** 审查 agent A 的 spawn 指示读取该字段并把 `reasoning_effort: "low"` 随模型一并传入，SHALL NOT 因模板未写死该模型而忽略该字段

#### Scenario: 未配置推理档时不传该参数
- **WHEN** 用户未配置 `reviewReasoningEffort`，用户运行 `@lyx-review-plan`
- **THEN** 审查 agent A 的 spawn 不传推理档参数，由宿主/模型使用默认档，SHALL NOT 传空值或占位值

#### Scenario: 推理档被宿主或上游拒绝
- **WHEN** 配置的推理档取值不被宿主或上游接受（如报错原文含不受支持的档位说明）
- **THEN** 如实展示报错原文并报告该 agent 失败原因，按既有 spawn 失败口径处理（单一 agent 失败且另一 agent 结论完整时以完整一方继续并如实报告降级），SHALL NOT 把该字段预判为"配置无效"或在未实测前拦截

### Requirement: init 向导按"提供方 → 模型三连"采集三个模型字段
`lycx init` 向导 SHALL 在交互模式采集 `codexHost` 的三个模型字段：`reviewModel`（审查 agent A）、`reviewModelB`（审查 agent B）、`codingModel`（coding 实施）。交互流程 SHALL 为"语言 → 选定 API 提供方 → **Codex 现状检测展示** → 模型三连 → 配置摘要"，SHALL NOT 包含"工作流模式"与"选择 Agent"等单选项步骤。**现状检测 SHALL 为纯静态读取**：展示 `~/.codex/config.toml` 顶层 `model`（主会话模型，即"默认继承"的实际值）、`[model_providers.*]` 条目、`~/.codex/models.json` 注册集合规模；读取失败或缺文件时 SHALL 如实标注"未检测到"，SHALL NOT 阻断流程。现状检测展示块 SHALL 附带 `reasoning_effort` 参数坑提示（如部分第三方模型默认推理档不被上游接受、需在该模型对应的推理档字段显式填 `low`；提示 SHALL 指明该通道为 `[codexHost]` 的推理档字段、**本向导 SHALL NOT 交互采集推理档**、维护方式与 `spawnableModels` 一致 = 手改 `~/.ly/config.toml`）与"agent 模型需额外配置、附示例验证 prompt"提示。**模型三连候选 SHALL = 默认继承当前会话模型（留空） + 自定义输入 + 既有值（若有）**，逐字段 list 选择；候选 SHALL NOT 包含任何内置/维护清单字面量，SHALL NOT 以选定 provider 的 `/models` 拉取结果为候选。**自由输入入口 SHALL 保留**：候选末项"自定义输入模型…"，选择后输入任意模型名（不做清单限制），经 trim 后作为该字段配置值，空白视为取消。每个字段默认值语义：既有值非空 → 候选附加该项并默认该项，SHALL NOT 静默丢弃或替换；无既有值或空白 → 默认"留空"。交互 init、非交互模式（`--skip-prompt`）与 menu 单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有 `reviewModelB`/`codingModel`、`spawnableModels` 与三个推理档字段（`reviewReasoningEffort`/`reviewReasoningEffortB`/`codingReasoningEffort`），SHALL NOT 因重装或编辑而丢弃。menu 的审查模型编辑 SHALL 使用同一候选语义。

#### Scenario: 全新安装，三字段均选择"不设置"
- **WHEN** 用户全新运行 `lycx init`，模型三连均选择"不设置（默认继承当前会话模型，留空）"
- **THEN** 配置摘要明确标注三字段"未配置（回退当前会话模型）"，审查/实施流程回退当前会话模型，不阻断安装

#### Scenario: 自定义输入配置模型（含清单外模型名）
- **WHEN** 用户在模型三连选择"自定义输入"，输入 `glm-5.3-flash`（不在任何内置/维护清单内）
- **THEN** 该值经 trim 写回对应字段，不因不在清单而被拦阻或警告；可用性由环境在实际 spawn 时判定

#### Scenario: update 重装保留已配置的 B/coding 字段
- **WHEN** 用户已配置 `reviewModelB`/`codingModel` 后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.ly/config.toml` 仍保留 `reviewModelB`/`codingModel` 原值，`spawnableModels` 与三个推理档字段同规则保留，SHALL NOT 被重置

#### Scenario: menu 单字段编辑不丢其余字段
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"仅编辑 `reviewModel`，而 `reviewModelB`/`codingModel`/`spawnableModels`/三个推理档字段已有配置
- **THEN** 写回后其余字段原值保留，SHALL NOT 被清除

#### Scenario: 交互重装保留既有值作默认并统一写回
- **WHEN** 用户已有三字段配置后交互运行 `lycx init`（未跳过提示），未改动任一字段直接确认
- **THEN** 三个字段均以既有值写回配置，`spawnableModels` 与三个推理档字段同规则保留，等效于原配置不变

#### Scenario: 候选不依赖 /models 拉取，自由输入入口保留
- **WHEN** 模型三连候选机制不依赖选定 provider 的 `GET {base_url}/models` 拉取（/models 结果不作为候选/校验来源）
- **THEN** 候选 = "留空（默认继承） + 自定义输入 + 既有值（若有，默认）"，任意环境（含 /models 不可达）下模型三连均可正常选择，不阻断安装

#### Scenario: Codex 现状检测展示主模型
- **WHEN** `~/.codex/config.toml` 顶层配置 `model = "DeepSeek-V4-Flash-0731"`，用户运行 `lycx init` 进入模型三连前
- **THEN** 现状检测展示主会话模型 `DeepSeek-V4-Flash-0731` 与 provider 信息，"默认继承"选项标注该实际值；该展示仅作背景参考，不进入模型三连候选

#### Scenario: 非交互重装不触发现状检测与候选选择
- **WHEN** 用户运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 不展示现状检测、不进行候选选择，配置三字段、`spawnableModels` 与三个推理档字段原值保留写回，等效于原配置不变

#### Scenario: 现状检测附推理参数坑提示
- **WHEN** init 现状检测展示块渲染（交互模式模型三连前）
- **THEN** 展示块附带 `reasoning_effort` 参数坑提示（指明对应推理档字段为维护入口、向导不交互采集该参数、手改 `~/.ly/config.toml`）与"agent 模型需额外配置、附示例验证 prompt"提示，既有检测项照常展示

### Requirement: doctor 校验子代理模型配置（提示型）
`lycx doctor` SHALL 提供"Codex 子代理模型配置"检查项：读取 `codexHost.reviewModel`/`reviewModelB`/`codingModel`，只做提示不做清单强校验——留空 = 通过（回退当前会话模型）；非空 = 通过（已配置，提示"agent 模型需额外配置"：能否 spawn 由环境实际能力决定）。该检查项 SHALL 同时读取并展示 `codexHost.reviewReasoningEffort`/`reviewReasoningEffortB`/`codingReasoningEffort`：非空 = 展示该推理档值（仅展示，不做枚举强校验）；未配置或空白 = 标注未配置（等价不传该参数）。检测结果 SHALL 展示当前主会话模型（可检测时，作为留空字段继承的实际值）并附示例 prompt 引导用户实测验证某模型是否可 spawn（如对话中让 Codex 用该模型 spawn 一个子代理执行简单任务回复 ok，报错原文含 `Unknown model ... Available models: ...` 即不支持）。`spawnableModels` 字段显式存在但格式非法/清洗后为空时 SHALL 输出 WARN 提示该形态（区别于未配置，仅提示），模型字段判定不受影响。

#### Scenario: 三个模型字段均留空
- **WHEN** 用户未配置任何子代理模型字段，运行 `lycx doctor`
- **THEN** 该项判定通过，标注三个字段均"未配置（回退当前会话模型）"，展示主会话模型实际值并附验证示例 prompt

#### Scenario: 配置了任意模型（含清单外）
- **WHEN** 用户配置 `reviewModel = "deepseek-v4-flash"`（不在任何内置/维护清单），运行 `lycx doctor`
- **THEN** 该项判定通过（已配置，标注 agent 模型需额外配置），不报 FAIL、不输出清单

#### Scenario: spawnableModels 格式非法
- **WHEN** 用户 `spawnableModels` 字段格式非法或清洗后为空，运行 `lycx doctor`
- **THEN** 检查项输出 WARN 提示该形态（仅提示），三个模型字段判定仍通过

#### Scenario: 展示已配置的推理档
- **WHEN** 用户配置 `reviewReasoningEffort = "low"`、未配置 `codingReasoningEffort`，运行 `lycx doctor`
- **THEN** 检查项展示 `reviewReasoningEffort` 当前值（仅展示、不判定合法性），`codingReasoningEffort` 标注"未配置（不传推理档参数）"，整体判定不因推理档取值变化
