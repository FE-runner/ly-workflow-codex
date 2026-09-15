# subagent-agent-config Specification

## Purpose
TBD - created by archiving change subagent-multi-agent-mode. Update Purpose after archive.

## Requirements

### Requirement: codexHost 提供 codingModel 与 reviewModelB 可选模型字段
`~/.ly/config.toml` 的 `[codexHost]` 节 SHALL 提供 `codingModel` 与 `reviewModelB` 两个可选字段（与既有 `reviewModel` 并列，均非必填）。`codingModel` SHALL 作为 coding subagent 的模型指定，`reviewModelB` SHALL 作为双审查中审查 agent B 的模型指定；任一字段未配置或配置为空白时 SHALL 回退当前会话模型（subagent 继承发起会话模型），SHALL NOT 阻断安装或审查流程。`src/types/index.ts` 的类型定义 SHALL 同步这两个可选字段。

#### Scenario: 仅配置 reviewModel，未配置新字段
- **WHEN** 用户 `~/.ly/config.toml` 仅配置 `codexHost.reviewModel`，未配置 `codingModel` 与 `reviewModelB`
- **THEN** coding subagent 与审查 agent B 均回退使用当前会话模型，审查 agent A 使用 reviewModel，流程不受影响

#### Scenario: 三个字段全部配置
- **WHEN** 用户配置 `reviewModel = A`、`reviewModelB = B`、`codingModel = C`
- **THEN** 审查 agent A 用 A、审查 agent B 用 B、coding subagent 用 C，三者可完全不同模型

### Requirement: 模型经"模板指示 + 宿主能力"落实，subagent 不可用时回退
模型指定 SHALL 以模板内明确的模型指示落实（模板写明各 subagent 的模型取哪个配置字段、未配置用当前会话模型），由运行环境的宿主 spawn 能力执行；模板 SHALL NOT 依赖任何 shell 层模型参数。运行环境无 subagent 能力或 spawn 失败时，审查/实施 SHALL 回退为当前会话直接执行并如实报告"已回退，原因：subagent 不可用"，该回退 SHALL NOT 视为流程失败而中断整体编排。

#### Scenario: 宿主无 subagent 能力
- **WHEN** 当前 codex 环境不提供 subagent spawn 能力，用户运行 `@lyx-review-plan`
- **THEN** 提示"当前环境无 subagent 能力，已回退为当前会话直接审查"，审查流程以当前会话继续执行

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
