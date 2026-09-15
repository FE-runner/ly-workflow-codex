# subagent-agent-config Specification

## Purpose
定义 codex 单宿主（subagent 多 Agent 模式）下子代理模型指定契约：三个模型字段（reviewModel / reviewModelB / codingModel）经"模板指示 + 宿主能力"落实——模型指定 = 对应配置字段，未配置或空白回退当前会话模型。CLI 向导模型三连只保留「留空（继承当前会话模型）+ 自定义输入 + 既有值」候选，不做清单强校验；agent 模型能否 spawn 由环境实际能力决定（运行期以宿主 spawn 报错为准），spawnableModels 仅作为提示参考字段，lycx doctor 输出提示并附示例 prompt 引导用户实测验证。

## Requirements

### Requirement: codexHost 提供 codingModel 与 reviewModelB 可选模型字段
`~/.ly/config.toml` 的 `[codexHost]` 节 SHALL 提供 `codingModel` 与 `reviewModelB` 两个可选字段（与既有 `reviewModel` 并列，均非必填）。`codingModel` SHALL 作为 coding subagent 的模型指定，`reviewModelB` SHALL 作为双审查中审查 agent B 的模型指定；任一字段未配置或配置为空白时 SHALL 回退当前会话模型（subagent 继承发起会话模型），SHALL NOT 阻断安装或审查流程。`src/types/index.ts` 的类型定义 SHALL 同步这两个可选字段。

#### Scenario: 仅配置 reviewModel，未配置新字段
- **WHEN** 用户 `~/.ly/config.toml` 仅配置 `codexHost.reviewModel`，未配置 `codingModel` 与 `reviewModelB`
- **THEN** coding subagent 与审查 agent B 均回退使用当前会话模型，审查 agent A 使用 reviewModel，流程不受影响

#### Scenario: 三个字段全部配置
- **WHEN** 用户配置 `reviewModel = A`、`reviewModelB = B`、`codingModel = C`
- **THEN** 审查 agent A 用 A、审查 agent B 用 B、coding subagent 用 C，三者可完全不同模型

### Requirement: codexHost.spawnableModels 声明宿主可 spawn 模型清单（提示参考，不作校验来源）
`~/.ly/config.toml` 的 `[codexHost]` 节 SHALL 提供可选 `spawnableModels` 字符串数组字段：提示参考用，声明当前宿主显式 spawn 子代理可用的模型清单（用户可按实测维护）。该字段未配置、空白或清洗后为空时，提示口径回退使用内置默认常量 `SPAWNABLE_MODELS_DEFAULT`（`gpt-6-astra`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、`gpt-5.5`）。清洗规则 SHALL 为：仅保留非空字符串、逐项 trim、去重；清洗后空数组等价未配置。字段显式存在但整体格式非法（如非数组字面量）时，`lycx doctor` 对该形态输出 WARN 提示（区别于完全未配置的静默通过）。**spawnableModels SHALL NOT 作为模型字段候选或校验来源**——模型三连候选与 doctor 判定均不依赖该清单；SHALL NOT 以 provider `/models` 拉取结果或 `~/.codex/models.json` 注册集合作为候选/校验来源（实测二者均不等于 spawn 可用列表）。agent 模型能否 spawn 由环境实际能力决定，运行期以宿主 spawn 报错为准。

#### Scenario: 未配置 spawnableModels
- **WHEN** 用户 `~/.ly/config.toml` 的 `[codexHost]` 未配置 `spawnableModels`
- **THEN** 不影响模型三连候选与 doctor 判定；提示口径回退内置默认五模型，流程不受影响

#### Scenario: 用户按实测维护 spawnableModels
- **WHEN** 用户实测本机 spawn 可用列表与内置默认不同（如仅 glm-5.3-flash 可用），将 `spawnableModels = ["glm-5.3-flash"]` 写入配置
- **THEN** 该字段仅作提示参考留存，不改变模型三连候选与 doctor 判定；字段形态合法时不产生 WARN

#### Scenario: spawnableModels 字段格式非法时提示
- **WHEN** 用户 `spawnableModels = "glm-5.3-flash"`（字符串而非数组）等格式非法写法
- **THEN** `lycx doctor` 输出 WARN 提示该字段形态异常（仅提示），模型三连候选与模型字段判定不受影响

### Requirement: 模型经"模板指示 + 宿主能力"落实，subagent 不可用时回退
模型指定 SHALL 以模板内明确的模型指示落实（模板写明各 subagent 的模型取哪个配置字段、未配置用当前会话模型），由运行环境的宿主 spawn 能力执行；模板 SHALL NOT 依赖任何 shell 层模型参数。**未配置（留空）**时 SHALL 回退为继承当前会话模型，SHALL NOT 阻断安装或审查流程。**agent 模型需额外配置**：配置的模型能否 spawn 由运行环境实际能力决定，SHALL NOT 依赖任何硬编码清单或 `/models` 结果预判；运行期判定以宿主 spawn 报错为准。spawn 失败报错原文含 `Unknown model` / `Available models: ...` 时 SHALL 如实展示，提示"该模型当前不支持 spawn，请改用报错中 Available models 列表内的模型"。运行环境无 subagent 能力或初始 spawn 失败 SHALL 按回退口径回退当前会话直接执行并如实报告"已回退，原因：subagent 不可用"，该回退 SHALL NOT 视为流程失败。模板运行时读取 `~/.ly/config.toml` 失败（缺文件/解析错误）SHALL 视为"配置状态未知"：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。

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

### Requirement: init 向导按"提供方 → 模型三连"采集三个模型字段
`lycx init` 向导 SHALL 在交互模式采集 `codexHost` 的三个模型字段：`reviewModel`（审查 agent A）、`reviewModelB`（审查 agent B）、`codingModel`（coding 实施）。交互流程 SHALL 为"语言 → 选定 API 提供方 → **Codex 现状检测展示** → 模型三连 → 配置摘要"，SHALL NOT 包含"工作流模式"与"选择 Agent"等单选项步骤。**现状检测 SHALL 为纯静态读取**：展示 `~/.codex/config.toml` 顶层 `model`（主会话模型，即"默认继承"的实际值）、`[model_providers.*]` 条目、`~/.codex/models.json` 注册集合规模；读取失败或缺文件时 SHALL 如实标注"未检测到"，SHALL NOT 阻断流程。现状检测展示块 SHALL 附带 `reasoning_effort` 参数坑背景提示（如部分第三方模型默认推理参数不可用、需显式 `low`；该提示为背景说明，SHALL NOT 新增模板参数通道）与"agent 模型需额外配置、附示例验证 prompt"提示。**模型三连候选 SHALL = 默认继承当前会话模型（留空） + 自定义输入 + 既有值（若有）**，逐字段 list 选择；候选 SHALL NOT 包含任何内置/维护清单字面量，SHALL NOT 以选定 provider 的 `/models` 拉取结果为候选。**自由输入入口 SHALL 保留**：候选末项"自定义输入模型…"，选择后输入任意模型名（不做清单限制），经 trim 后作为该字段配置值，空白视为取消。每个字段默认值语义：既有值非空 → 候选附加该项并默认该项，SHALL NOT 静默丢弃或替换；无既有值或空白 → 默认"留空"。交互 init、非交互模式（`--skip-prompt`）与 menu 单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有 `reviewModelB`/`codingModel` 与 `spawnableModels`，SHALL NOT 因重装或编辑而丢弃。menu 的审查模型编辑 SHALL 使用同一候选语义。

#### Scenario: 全新安装，三字段均选择"不设置"
- **WHEN** 用户全新运行 `lycx init`，模型三连均选择"不设置（默认继承当前会话模型，留空）"
- **THEN** 配置摘要明确标注三字段"未配置（回退当前会话模型）"，审查/实施流程回退当前会话模型，不阻断安装

#### Scenario: 自定义输入配置模型（含清单外模型名）
- **WHEN** 用户在模型三连选择"自定义输入"，输入 `glm-5.3-flash`（不在任何内置/维护清单内）
- **THEN** 该值经 trim 写回对应字段，不因不在清单而被拦阻或警告；可用性由环境在实际 spawn 时判定

#### Scenario: update 重装保留已配置的 B/coding 字段
- **WHEN** 用户已配置 `reviewModelB`/`codingModel` 后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.ly/config.toml` 仍保留 `reviewModelB`/`codingModel` 原值，`spawnableModels` 同规则保留，SHALL NOT 被重置

#### Scenario: menu 单字段编辑不丢其余字段
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"仅编辑 `reviewModel`，而 `reviewModelB`/`codingModel`/`spawnableModels` 已有配置
- **THEN** 写回后其余字段原值保留，SHALL NOT 被清除

#### Scenario: 交互重装保留既有值作默认并统一写回
- **WHEN** 用户已有三字段配置后交互运行 `lycx init`（未跳过提示），未改动任一字段直接确认
- **THEN** 三个字段均以既有值写回配置，`spawnableModels` 同规则保留，等效于原配置不变

#### Scenario: 候选不依赖 /models 拉取，自由输入入口保留
- **WHEN** 模型三连候选机制不依赖选定 provider 的 `GET {base_url}/models` 拉取（/models 结果不作为候选/校验来源）
- **THEN** 候选 = "留空（默认继承） + 自定义输入 + 既有值（若有，默认）"，任意环境（含 /models 不可达）下模型三连均可正常选择，不阻断安装

#### Scenario: Codex 现状检测展示主模型
- **WHEN** `~/.codex/config.toml` 顶层配置 `model = "DeepSeek-V4-Flash-0731"`，用户运行 `lycx init` 进入模型三连前
- **THEN** 现状检测展示主会话模型 `DeepSeek-V4-Flash-0731` 与 provider 信息，"默认继承"选项标注该实际值；该展示仅作背景参考，不进入模型三连候选

#### Scenario: 非交互重装不触发现状检测与候选选择
- **WHEN** 用户运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 不展示现状检测、不进行候选选择，配置三字段与 `spawnableModels` 原值保留写回，等效于原配置不变

#### Scenario: 现状检测附推理参数坑提示
- **WHEN** init 现状检测展示块渲染（交互模式模型三连前）
- **THEN** 展示块附带 `reasoning_effort` 参数坑背景提示与"agent 模型需额外配置、附示例验证 prompt"提示（背景说明、不新增模板参数通道），既有检测项照常展示

### Requirement: doctor 校验子代理模型配置（提示型）
`lycx doctor` SHALL 提供"Codex 子代理模型配置"检查项：读取 `codexHost.reviewModel`/`reviewModelB`/`codingModel`，只做提示不做清单强校验——留空 = 通过（回退当前会话模型）；非空 = 通过（已配置，提示"agent 模型需额外配置"：能否 spawn 由环境实际能力决定）。检测结果 SHALL 展示当前主会话模型（可检测时，作为留空字段继承的实际值）并附示例 prompt 引导用户实测验证某模型是否可 spawn（如对话中让 Codex 用该模型 spawn 一个子代理执行简单任务回复 ok，报错原文含 `Unknown model ... Available models: ...` 即不支持）。`spawnableModels` 字段显式存在但格式非法/清洗后为空时 SHALL 输出 WARN 提示该形态（区别于未配置，仅提示），模型字段判定不受影响。

#### Scenario: 三个模型字段均留空
- **WHEN** 用户未配置任何子代理模型字段，运行 `lycx doctor`
- **THEN** 该项判定通过，标注三个字段均"未配置（回退当前会话模型）"，展示主会话模型实际值并附验证示例 prompt

#### Scenario: 配置了任意模型（含清单外）
- **WHEN** 用户配置 `reviewModel = "deepseek-v4-flash"`（不在任何内置/维护清单），运行 `lycx doctor`
- **THEN** 该项判定通过（已配置，标注 agent 模型需额外配置），不报 FAIL、不输出清单

#### Scenario: spawnableModels 格式非法
- **WHEN** 用户 `spawnableModels` 字段格式非法或清洗后为空，运行 `lycx doctor`
- **THEN** 检查项输出 WARN 提示该形态（仅提示），三个模型字段判定仍通过
