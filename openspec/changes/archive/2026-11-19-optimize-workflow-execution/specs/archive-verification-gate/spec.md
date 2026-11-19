## REMOVED Requirements

### Requirement: archive 在 ask 模式下使用 change 决策
**Reason**: change 级持久决策依赖已删除的 run-state。
**Migration**: archive 每次重新解析 effective 配置；`ask` 时在当前调用询问，跨调用不沿用旧选择。

### Requirement: 归档前验证结果写入 run-state
**Reason**: 新流程不维护运行账本。
**Migration**: 验证命令、退出码与摘要写入 archive 命令最终报告和 archive commit 正文；失败时不移动 change。

## ADDED Requirements

### Requirement: archive ask 使用当前调用决策
effective 配置为 `ask` 时，`@lyx-archive` SHALL 在验证前询问一次 `normal` / `off`，并在本次调用内使用该选择。命令 SHALL NOT 写入 run-state 或其他持久决策文件；显式项目或宿主配置为 `normal` / `off` 时 SHALL 直接使用配置。旧 `.openspec.yaml lyx.testModeDecision` MAY 作为只读兼容输入，SHALL NOT 被改写。

#### Scenario: 当前调用选择 off
- **WHEN** effective 配置为 `ask`，用户在 archive 中选择 `off`
- **THEN** archive 跳过测试，执行类型检查，不写 run-state

#### Scenario: 显式配置 normal
- **WHEN** effective 配置为项目级 `normal`
- **THEN** archive 直接执行测试与类型检查，不询问

### Requirement: archive 验证证据写入报告和 commit
`@lyx-archive` SHALL 在最终报告中列出测试和类型检查的“命令 + 退出码 + 结果摘要”，并在有 archive commit 时把同一摘要写入 commit 正文。验证失败时 SHALL 不移动 change，并在报告中保留失败命令、退出码与关键错误摘要。命令 SHALL NOT 为保存该证据创建额外状态文件。

#### Scenario: 验证通过
- **WHEN** 测试与类型检查均通过
- **THEN** 报告与 archive commit 正文包含两类验证证据

#### Scenario: 验证失败
- **WHEN** 测试失败
- **THEN** 命令停止归档，保留失败证据，不创建 archive commit
