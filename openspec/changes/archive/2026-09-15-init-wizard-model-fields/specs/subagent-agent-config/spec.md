## ADDED Requirements

### Requirement: init 向导按"提供方 → 模型三连"采集三个模型字段
`lycx init` 向导 SHALL 在交互模式采集 `codexHost` 的三个模型字段：`reviewModel`（审查 agent A）、`reviewModelB`（审查 agent B）、`codingModel`（coding 实施）。交互流程 SHALL 为"语言 → 选定 API 提供方 → 模型三连 → 配置摘要"，SHALL NOT 包含"工作流模式"与"选择 Agent"等单选项步骤。采集 SHALL 以"选定 API 提供方 → 拉取一次模型列表 → 三字段共用该列表逐个选择"的顺序完成；每个字段 SHALL 提供"自定义输入"与"不设置（回退当前会话模型）"入口，其中"自定义输入"SHALL 预填该字段既有值作为默认（用户直接确认即保留原值）。默认值语义：既有配置值在模型列表内时默认该项；既有值非空但不在列表时默认"自定义输入"（SHALL NOT 静默丢弃或替换为列表首项）；无既有值或既有值为空白时默认"不设置"（空白等价未配置）。模型列表拉取失败时 SHALL 回退为自由输入（留空 = 不设置）。交互 init、非交互模式（`--skip-prompt`）与 menu 单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留既有 `reviewModelB`/`codingModel`，SHALL NOT 因重装或编辑而丢弃。

#### Scenario: 全新安装，三字段均选择"不设置"
- **WHEN** 用户全新运行 `lycx init`，模型三连均选择"不设置（回退当前会话模型）"
- **THEN** 配置摘要明确标注三字段"未配置（回退当前会话模型）"，审查/实施流程回退当前会话模型，不阻断安装

#### Scenario: update 重装保留已配置的 B/coding 字段
- **WHEN** 用户已配置 `reviewModelB`/`codingModel` 后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.ly/config.toml` 仍保留 `reviewModelB`/`codingModel` 原值，SHALL NOT 被重置

#### Scenario: 既有模型值不在当前 provider 的模型列表
- **WHEN** 用户既有 `reviewModel` 值不在所选 provider 拉取到的模型列表中
- **THEN** 该字段默认进入"自定义输入"，用户确认后原值保留，SHALL NOT 静默替换为列表首项或清空

#### Scenario: menu 单字段编辑不丢其余字段
- **WHEN** 用户通过 `lycx` 菜单"修改审查模型"仅编辑 `reviewModel`，而 `reviewModelB`/`codingModel` 已有配置
- **THEN** 写回后 `reviewModelB`/`codingModel` 原值保留，SHALL NOT 被清除

#### Scenario: 交互重装保留既有值作默认并统一写回
- **WHEN** 用户已有三字段配置后交互运行 `lycx init`（未跳过提示），未改动任一字段直接确认
- **THEN** 三个字段均以既有值写回配置，等效于原配置不变

#### Scenario: 模型列表拉取失败回退自由输入
- **WHEN** 选定 provider 后 `GET {base_url}/models` 拉取失败
- **THEN** 三个字段回退为自由输入（每字段预填既有值，留空 = 不设置），配置流程继续，不阻断安装
