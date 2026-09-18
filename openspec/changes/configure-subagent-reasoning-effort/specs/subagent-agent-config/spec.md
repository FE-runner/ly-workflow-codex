## MODIFIED Requirements

### Requirement: codexHost 提供三个可选推理档字段（与模型字段一一对应）

**字段集合变更（自本 change 起）**：本 Requirement 标题中"三个推理档字段"为历史措辞——`reviewReasoningEffortB` 随 `reviewModelB` 一并移除，`[codexHost]` 改为提供两个推理档字段。语义以正文为准。

`~/.codex/lyx/config.toml` 的 `[codexHost]` 节 SHALL 提供 `reviewReasoningEffort`（对应 `reviewModel`）与 `codingReasoningEffort`（对应 `codingModel`）两个可选推理档字段，均非必填。字段值 SHALL 为非空字符串（trim 后使用）；未配置、空白或清洗后为空 SHALL 等价于"未覆盖"，语义 = 不传推理档参数（保持宿主/模型默认档）。取值本身 SHALL NOT 做枚举白名单强校验——合法档位随模型与宿主能力漂移，判定以宿主/上游实际报错为准并如实展示。

推理档 SHALL 仅在对应执行者为 `"subagent"` 时生效；执行者为 `"main"`（含未配置）时该字段被忽略，`lycx doctor` 输出 WARN 提示。

**覆盖/不覆盖语义**：交互 `lycx init` 与 `lycx` 菜单"配置审查模型" SHALL 允许用户显式选择"不覆盖（继承模型/宿主默认）"或"覆盖并指定档位"。选择"不覆盖" SHALL 清除对应字段（等价于未配置，spawn 不传 `reasoning_effort`）；选择"覆盖" SHALL 写入选定档位值。非交互模式（`--skip-prompt`）、`lycx update` 以及用户未触碰推理档选择的编辑路径 SHALL 保留既有两字段原值，SHALL NOT 因重装或编辑而隐式清除。

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
- **THEN** 等价于未覆盖，coding subagent 的 spawn 不传推理档参数，SHALL NOT 传空字符串

#### Scenario: 交互选择不覆盖时清除既有推理档
- **WHEN** 用户已有 `reviewReasoningEffort = "low"`，在交互 `lycx init` 或菜单"配置审查模型"中显式选择"不覆盖（继承模型/宿主默认）"
- **THEN** 写回配置中 `reviewReasoningEffort` 字段被清除，后续 spawn 不传 `reasoning_effort`

#### Scenario: update 重装保留已配置的推理档
- **WHEN** 用户已配置两个推理档字段后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.codex/lyx/config.toml` 仍保留两个推理档字段原值，SHALL NOT 被重置或清除

#### Scenario: menu 单字段编辑不丢推理档
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"编辑 `reviewModel`，但未改变推理档的覆盖选择
- **THEN** 写回后 `reviewReasoningEffort` 原值保留，SHALL NOT 被隐式清除

#### Scenario: 执行者为 main 时推理档被忽略
- **WHEN** 用户配置 `reviewExecutor = "main"` 与 `reviewReasoningEffort = "low"`
- **THEN** 审查由主 agent 直接执行，推理档不生效；`lycx doctor` 对该组合输出 WARN 提示

### Requirement: init 向导按"提供方 → 模型三连"采集三个模型字段

**采集集合变更（自本 change 起）**：本 Requirement 标题中"模型三连/三个模型字段"为历史措辞——向导实际采集**执行者二连 + 模型二连 + 推理档覆盖选择**（`reviewExecutor`、`codingExecutor`、`reviewModel`、`codingModel` 与对应推理档覆盖选择），语义以正文为准。

`lycx init` 向导 SHALL 在交互模式先采集两个执行者字段，再采集两个模型字段。**执行者采集**：逐字段 list 选择，候选 SHALL 为「主 agent 直接执行（默认，值为 `main`）」与「spawn 独立子代理（值为 `subagent`）」；未配置或既有值为空 SHALL 默认选中"主 agent 直接执行"。**模型采集**：仅在对应执行者为 `"subagent"` 时提示采集，候选 SHALL 为「继承当前会话模型（留空）+ 自定义输入 + 既有值（若有）」，SHALL NOT 包含内置/维护清单字面量。执行者为 `"main"` 时不采集对应模型字段，并 SHALL 在摘要中标注"该模型字段不生效"。

**推理档采集**：对应执行者为 `"subagent"` 时，向导 SHALL 在模型采集后为该 subagent 采集推理档覆盖选择。候选 SHALL 为「不覆盖（继承模型/宿主默认）」+ 常见档位建议（`minimal` / `low` / `medium` / `high` / `max`）+「自定义输入…」；既有值非空时 SHALL 作为候选项保留并默认选中，即使该值不在建议清单内。选择「不覆盖」 SHALL 清除对应字段；选择建议档位或自定义输入 SHALL 写入 trim 后的值；自定义输入 trim 后为空 SHALL 等价于「不覆盖」。候选 SHALL NOT 作为枚举白名单强校验，合法档位仍由宿主/上游实际能力判定。

配置摘要 SHALL 展示每个 subagent 的推理档状态：`未覆盖（继承模型/宿主默认）` 或 `已覆盖: <值>`；执行者为 `"main"` 时 SHALL 标注推理档"不生效"（既有值可保留展示），与模型字段摘要口径一致。

交互流程 SHALL 为"语言 → 选定 API 提供方 → Codex 现状检测展示 → 执行者二连 → 模型与推理档采集（按执行者） → 配置摘要"，SHALL NOT 包含"工作流模式"与"选择 Agent"等单选项步骤。现状检测 SHALL 为纯静态读取（`~/.codex/config.toml` 顶层 `model`、`[model_providers.*]` 条目、`~/.codex/models.json` 注册规模），读取失败 SHALL 标注"未检测到"且不阻断。**候选 SHALL NOT 依赖 provider 的 `/models` 拉取结果**。

交互 init、非交互模式（`--skip-prompt`）与 menu 单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有 `codingModel`、`spawnableModels` 与两个推理档字段，SHALL NOT 因重装或编辑而丢弃；已移除的 `reviewModelB` / `reviewReasoningEffortB` SHALL NOT 被写回。**例外**：交互 init 或菜单中显式选择"不覆盖"时 SHALL 清除对应推理档字段。

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
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"编辑 `reviewModel`，而执行者字段与其余字段已有配置
- **THEN** 写回后其余字段原值保留（推理档仅在用户显式选择"不覆盖"时清除），SHALL NOT 被隐式清除

#### Scenario: 交互重装保留既有值作默认并统一写回
- **WHEN** 用户已有执行者、模型与推理档配置后交互运行 `lycx init`（未跳过提示），未改动任一字段直接确认
- **THEN** 采集字段均以既有值写回配置，`spawnableModels` 与两个推理档字段同规则保留，等效于原配置不变

#### Scenario: 交互选择不覆盖清除既有推理档
- **WHEN** 用户已有 `codingReasoningEffort = "max"`，在交互 `lycx init` 的 coding 推理档采集显式选择"不覆盖（继承模型/宿主默认）"
- **THEN** 写回配置中 `codingReasoningEffort` 被清除，后续 coding subagent spawn 不传 `reasoning_effort`

#### Scenario: 覆盖推理档时写入选定档位
- **WHEN** 用户为审查 subagent 选择"覆盖"并选择 `low`（或自定义输入任意档位）
- **THEN** `reviewReasoningEffort` 写入 trim 后的选定值，配置摘要展示该值

#### Scenario: 配置摘要展示推理档状态
- **WHEN** 交互 `lycx init` 完成推理档采集并渲染配置摘要
- **THEN** 摘要分别展示审查与 coding 的推理档状态：未覆盖显示"未覆盖（继承模型/宿主默认）"，覆盖显示"已覆盖: <值>"

#### Scenario: 执行者为 main 时摘要标注推理档不生效
- **WHEN** 用户交互运行 `lycx init`，某执行者选择"主 agent 直接执行"且该侧推理档已有配置值
- **THEN** 摘要保留展示该值但标注"主 agent 执行时不生效"，不因该字段存在而报错

#### Scenario: 自定义输入留空等价不覆盖
- **WHEN** 用户在推理档采集中选择"自定义输入…"并提交空白
- **THEN** 对应推理档字段被清除，等价于选择"不覆盖"

#### Scenario: 既有推理档值保留为候选
- **WHEN** 用户已有 `reviewReasoningEffort = "custom-tier"`（不在建议清单内），交互运行 `lycx init`
- **THEN** 该值作为候选项附加并默认选中，不因不在建议清单内被静默丢弃或替换

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
- **THEN** 展示块附带 `reasoning_effort` 参数坑提示（指明对应推理档字段可由后续采集选择覆盖或保持不覆盖、取值不做枚举强校验、报错如实展示）与"agent 模型需额外配置、附示例验证 prompt"提示，既有检测项照常展示

#### Scenario: 全新安装默认主 agent 执行
- **WHEN** 用户全新运行 `lycx init`，执行者二连均选择"主 agent 直接执行"
- **THEN** 配置写入 `reviewExecutor = "main"` 与 `codingExecutor = "main"`（或等价未配置），摘要标注两个模型字段不生效，不阻断安装

#### Scenario: 选择 subagent 后采集模型
- **WHEN** 用户在执行者二连为审查选择"spawn 独立子代理"
- **THEN** 向导随后采集 `reviewModel` 与 `reviewReasoningEffort` 覆盖选择，模型候选为「继承当前会话模型（留空）+ 自定义输入 + 既有值」，推理档候选为「不覆盖 + 建议档位 + 自定义输入」，不含任何强校验清单

### Requirement: doctor 校验子代理模型配置（提示型）

`lycx doctor` SHALL 提供"Codex 子代理模型配置"检查项，展示两个执行者字段与相关模型 / 推理档字段的当前状态，只做提示不做清单强校验。

**执行者字段**：`reviewExecutor` / `codingExecutor` 留空或 `"main"` = 通过，标注"主 agent 直接执行"；`"subagent"` = 通过，标注"spawn 独立子代理"。取值非法（非 `main` / `subagent` 的非空字符串）SHALL 输出 WARN 提示取值非法并按 `main` 处理。

**模型与推理档字段**：执行者为 `"subagent"` 时，`reviewModel` / `codingModel` 留空 = 通过（继承当前会话模型），非空 = 通过（已配置，提示"agent 模型需额外配置"，能否 spawn 由环境实际能力决定）；对应推理档非空 = 展示"已覆盖: <值>"（仅展示，不做枚举强校验），未配置或空白 = 标注"未覆盖（继承模型/宿主默认）"。执行者为 `"main"` 时，若对应模型或推理档字段非空，SHALL 输出 WARN 提示"主 agent 执行时该字段不生效"，并展示该值。

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
- **THEN** 检查项展示 `reviewReasoningEffort` "已覆盖: low"（仅展示、不判定合法性），`codingReasoningEffort` 标注"未覆盖（继承模型/宿主默认）"，整体判定不因推理档取值变化

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
