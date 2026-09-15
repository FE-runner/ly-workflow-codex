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
