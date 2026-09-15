## ADDED Requirements

### Requirement: init 向导按"提供方 → 模型三连"采集三个模型字段
`lycx init` 向导 SHALL 在交互模式采集 `codexHost` 的三个模型字段：`reviewModel`（审查 agent A）、`reviewModelB`（审查 agent B）、`codingModel`（coding 实施）。采集 SHALL 以"选定 API 提供方 → 拉取一次模型列表 → 三字段共用该列表逐个选择"的顺序完成；每个字段 SHALL 提供"自定义输入"与"不设置（回退当前会话模型）"入口。默认值语义：既有配置值在列表内时默认该项；既有值非空但不在列表时默认"自定义输入"（SHALL NOT 静默丢弃或替换为列表首项）；无既有值时默认"不设置"。模型列表拉取失败时 SHALL 回退为自由输入（留空 = 不设置）。非交互模式（`--skip-prompt`）SHALL 保留既有三字段值写入配置，SHALL NOT 因重装丢弃 `reviewModelB`/`codingModel`。

#### Scenario: 全新安装，三字段均选择"不设置"
- **WHEN** 用户全新运行 `lycx init`，模型三连均选择"不设置（回退当前会话模型）"
- **THEN** 配置摘要明确标注三字段"未配置（回退当前会话模型）"，审查/实施流程回退当前会话模型，不阻断安装

#### Scenario: update 重装保留已配置的 B/coding 字段
- **WHEN** 用户已配置 `reviewModelB`/`codingModel` 后运行 `lycx update`（即 `init --force --skip-prompt`）
- **THEN** 重装后 `~/.ly/config.toml` 仍保留 `reviewModelB`/`codingModel` 原值，SHALL NOT 被重置

#### Scenario: 既有模型值不在当前 provider 的模型列表
- **WHEN** 用户既有 `reviewModel` 值不在所选 provider 拉取到的模型列表中
- **THEN** 该字段默认进入"自定义输入"，用户确认后原值保留，SHALL NOT 静默替换为列表首项或清空
