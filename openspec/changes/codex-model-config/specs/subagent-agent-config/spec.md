## ADDED Requirements

### Requirement: codexHost.spawnableModels 声明宿主可 spawn 模型清单
`~/.ly/config.toml` 的 `[codexHost]` 节 SHALL 提供可选的 `spawnableModels` 字符串数组字段：声明当前宿主显式 spawn 子代理可用的模型清单。该字段未配置、空白或清洗后为空数组时，SHALL 回退使用内置默认常量 `SPAWNABLE_MODELS_DEFAULT`（=`gpt-6-astra`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、`gpt-5.5`）。清洗规则 SHALL 为：仅保留非空字符串、逐项 trim、去重；清洗后空数组等价未配置。字段显式存在但整体格式非法（如非数组字面量、无法解析为字符串数组的形态）时，SHALL 按未配置回退内置默认，并在 `lycx doctor` 检查项中对该形态输出 WARN 提示（区别于完全未配置的静默通过）。`spawnableModels` SHALL 作为模型字段候选与校验的唯一清单来源（既有 `reviewModel`/`reviewModelB`/`codingModel` 的非空取值 SHALL 落在此清单内才视为合法）；SHALL NOT 以 provider `/models` 拉取结果或 `~/.codex/models.json` 注册集合作为候选/校验来源（实测二者均不等于 spawn 可用列表）。

#### Scenario: 未配置 spawnableModels 时使用内置默认
- **WHEN** 用户 `~/.ly/config.toml` 的 `[codexHost]` 未配置 `spawnableModels`
- **THEN** 模型三连候选与 doctor 校验均使用内置默认五模型（gpt-6-astra / gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna / gpt-5.5），流程不受影响

#### Scenario: 用户按实测维护 spawnableModels
- **WHEN** 用户实测本机 spawn 可用列表与内置默认不同（如仅 glm-5.3-flash 可用），将 `spawnableModels = ["glm-5.3-flash"]` 写入配置
- **THEN** `lycx init`/菜单候选与 doctor 校验均以该用户清单为准，模型三连可从该清单选择

#### Scenario: spawnableModels 字段格式非法时回退默认并提示
- **WHEN** 用户 `spawnableModels = "glm-5.3-flash"`（字符串而非数组）等格式非法写法
- **THEN** 按未配置回退内置默认，`lycx doctor` 输出 WARN 提示该字段形态异常，模型三连候选仍可用默认清单

### Requirement: doctor 校验子代理模型配置
`lycx doctor` SHALL 提供"Codex 子代理模型配置"检查项：读取 `codexHost.reviewModel`/`reviewModelB`/`codingModel` 与 `spawnableModels`（未配置回退内置默认），对三个模型字段逐一判定——留空 = 通过（回退当前会话模型继承，实测可用）；非空且属于 `spawnableModels` = 通过；非空且不属于 `spawnableModels` = FAIL，提示"子代理模型配置无效（<model> 不在可用列表），请配置 `[codexHost] spawnableModels` 或改用列表内模型"。检测结果 SHALL 展示所用清单（内置默认或用户配置）。留空 = 通过的前提 SHALL 在判定文案中注明（以主会话模型本身可 spawn 为前提）；`spawnableModels` 字段显式存在但格式非法/清洗后为空时 SHALL 输出 WARN 提示该形态（区别于未配置），模型字段本身仍按生效清单判定。

#### Scenario: 三个模型字段均留空
- **WHEN** 用户未配置任何子代理模型字段，运行 `lycx doctor`
- **THEN** 该项判定通过，标注三个字段均"未配置（回退当前会话模型）"

#### Scenario: 配置了列表外模型
- **WHEN** 用户配置 `reviewModel = "deepseek-v4-flash"`（不在 spawnableModels），运行 `lycx doctor`
- **THEN** 该项判定 FAIL，列出 `deepseek-v4-flash` 及其不在可用列表的原因，并给出修配指引

## MODIFIED Requirements

### Requirement: 模型经"模板指示 + 宿主能力"落实，subagent 不可用时回退
模型指定 SHALL 以模板内明确的模型指示落实（模板写明各 subagent 的模型取哪个配置字段、未配置用当前会话模型），由运行环境的宿主 spawn 能力执行；模板 SHALL NOT 依赖任何 shell 层模型参数。**未配置（留空）**时 SHALL 回退为继承当前会话模型，SHALL NOT 阻断安装或审查流程。**非空配置值 ∉ `spawnableModels`**（未配置 `spawnableModels` 时按内置默认）SHALL 判定为配置无效：明确报告"子代理模型配置无效（<model> 不在可用列表，请运行 `lycx doctor` 或配置 `[codexHost] spawnableModels`）"，停止该关卡转人工改配，SHALL NOT 以笼统的"运行期失败/审查调用失败"终止条件掩盖，SHALL NOT 回退为当前会话直接执行。运行环境无 subagent 能力或初始 spawn 失败（配置合法时）按回退口径回退当前会话直接执行并如实报告"已回退，原因：subagent 不可用"，该回退 SHALL NOT 视为流程失败。spawn 失败报错原文（含 `Available models: ...` 时）SHALL 如实展示，并可提示用户据此维护 `spawnableModels`。模板运行时读取 `~/.ly/config.toml` 失败（缺文件/解析错误）SHALL 视为"配置状态未知"：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。

#### Scenario: 宿主无 subagent 能力
- **WHEN** 当前 codex 环境不提供 subagent spawn 能力，用户运行 `@lyx-review-plan`
- **THEN** 提示"当前环境无 subagent 能力，已回退为当前会话直接审查"，审查流程以当前会话继续执行

#### Scenario: 配置了不在可用列表的模型
- **WHEN** 用户配置 `reviewModelB = "glm-5.3-flash"` 而 `spawnableModels` 未包含该模型，运行 `@lyx-review-code`
- **THEN** 明确报告"子代理模型配置无效（glm-5.3-flash 不在可用列表）"，停止该关卡转人工改配，不回退当前会话直接执行，不归入笼统的"运行期失败"终止

#### Scenario: 初始 spawn 失败（配置合法）
- **WHEN** 模型配置合法但宿主初始 spawn 失败（如端点异常）
- **THEN** 按回退口径回退为当前会话直接执行并如实报告"已回退，原因：subagent 不可用"，不作为流程失败

#### Scenario: 模板运行时无法读取配置
- **WHEN** 审查/实施子代理 spawn 前读取 `~/.ly/config.toml` 失败（缺文件或解析错误）
- **THEN** 明确提示"无法读取配置，请运行 `lycx doctor` 检查"，按"配置状态未知"处理，SHALL NOT 按"未配置"静默继承回退，也不把合法模型值当作留空继承

### Requirement: init 向导按"提供方 → 模型三连"采集三个模型字段
`lycx init` 向导 SHALL 在交互模式采集 `codexHost` 的三个模型字段：`reviewModel`（审查 agent A）、`reviewModelB`（审查 agent B）、`codingModel`（coding 实施）。交互流程 SHALL 为"语言 → 选定 API 提供方 → **Codex 现状检测展示** → 模型三连 → 配置摘要"，SHALL NOT 包含"工作流模式"与"选择 Agent"等单选项步骤。**现状检测 SHALL 为纯静态读取**：展示 `~/.codex/config.toml` 顶层 `model`（主会话模型，即"默认继承"的实际值）、`[model_providers.*]` 条目、`~/.codex/models.json` 注册集合规模；读取失败或缺文件时 SHALL 如实标注"未检测到"，SHALL NOT 阻断流程。现状检测展示块 SHALL 附带 `reasoning_effort` 参数坑背景提示（如部分第三方模型默认推理参数不可用、需显式 `low`；该提示为背景说明，SHALL NOT 新增模板参数通道）。**模型三连候选 SHALL = `默认继承当前会话模型（留空）` + `spawnableModels` 生效清单（配置值或内置默认）**，逐字段 list 选择；采集 SHALL NOT 以选定 provider 的 `/models` 拉取结果为候选，SHALL NOT 提供自由输入入口。每个字段默认值语义：既有值非空且 ∈ 候选清单 → 默认该项；既有值非空但 ∉ 候选清单 → 候选清单附加"保留当前值 `<value>`（不在可用列表，警告）"项并默认该项，SHALL NOT 静默丢弃或替换；无既有值或空白 → 默认"留空"。交互 init、非交互模式（`--skip-prompt`）与 menu 单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有 `reviewModelB`/`codingModel` 与 `spawnableModels`，SHALL NOT 因重装或编辑而丢弃。menu 的审查模型编辑 SHALL 使用同一候选清单与默认值语义。

#### Scenario: 全新安装，三字段均选择"不设置"
- **WHEN** 用户全新运行 `lycx init`，模型三连均选择"不设置（默认继承当前会话模型，留空）"
- **THEN** 配置摘要明确标注三字段"未配置（回退当前会话模型）"，审查/实施流程回退当前会话模型，不阻断安装

#### Scenario: update 重装保留已配置的 B/coding 字段
- **WHEN** 用户已配置 `reviewModelB`/`codingModel` 后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.ly/config.toml` 仍保留 `reviewModelB`/`codingModel` 原值，`spawnableModels` 同规则保留，SHALL NOT 被重置

#### Scenario: 既有模型值不在当前 provider 的模型列表
- **WHEN** 用户既有 `reviewModel` 值不在 `spawnableModels` 生效清单（原本的"不在当前 provider 的模型列表"场景随 /models 候选移除一并失效）
- **THEN** 该字段候选附加"保留当前值 `<value>`（不在可用列表，警告）"项并默认该项，用户确认后原值保留，SHALL NOT 静默替换为清单首项或清空

#### Scenario: menu 单字段编辑不丢其余字段
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"仅编辑 `reviewModel`，而 `reviewModelB`/`codingModel`/`spawnableModels` 已有配置
- **THEN** 写回后其余字段原值保留，SHALL NOT 被清除

#### Scenario: 交互重装保留既有值作默认并统一写回
- **WHEN** 用户已有三字段配置后交互运行 `lycx init`（未跳过提示），未改动任一字段直接确认
- **THEN** 三个字段均以既有值写回配置，`spawnableModels` 同规则保留，等效于原配置不变

#### Scenario: 模型列表拉取失败回退自由输入
- **WHEN** 模型三连候选机制自本改动起不再依赖选定 provider 的 `GET {base_url}/models` 拉取（原"拉取失败回退自由输入"路径随 /models 候选与自由输入移除而永久失效）
- **THEN** 不存在"拉取失败回退自由输入"分支，候选恒为"留空 + spawnableModels 生效清单"，任意环境（含 /models 不可达）下模型三连均可正常选择，不阻断安装

#### Scenario: Codex 现状检测展示主模型
- **WHEN** `~/.codex/config.toml` 顶层配置 `model = "DeepSeek-V4-Flash-0731"`，用户运行 `lycx init` 进入模型三连前
- **THEN** 现状检测展示主会话模型 `DeepSeek-V4-Flash-0731` 与 provider 信息，"默认继承"选项标注该实际值

#### Scenario: 非交互重装不触发现状检测与候选选择
- **WHEN** 用户运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 不展示现状检测、不进行候选选择，配置三字段与 `spawnableModels` 原值保留写回，等效于原配置不变

#### Scenario: 现状检测附推理参数坑提示
- **WHEN** init 现状检测展示块渲染（交互模式模型三连前）
- **THEN** 展示块附带 `reasoning_effort` 参数坑背景提示（背景说明、不新增模板参数通道），既有检测项照常展示
