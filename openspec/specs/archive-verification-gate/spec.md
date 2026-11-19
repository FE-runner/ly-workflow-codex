# archive-verification-gate Specification

## Purpose

定义归档前的验证关卡：`@lyx-archive` 在委托 OpenSpec 归档前对当前工作区执行一次项目验证（测试 / 类型检查），不执行生产构建；验证失败时阻断归档，避免未通过验证的 change 被归档。

## Requirements

### Requirement: 归档前执行完整验证

`@lyx-archive` SHALL 在委托 OpenSpec 归档流程**之前**读取当前宿主 `testMode`。`testMode = "normal"` 时，对当前工作区执行验证，覆盖测试、类型检查两类（按项目实际提供的脚本选择，例如 `package.json` 的 `scripts.test` / `scripts.typecheck`）。`testMode = "off"` 时，SHALL 跳过测试类别，但仍执行项目提供的类型检查；报告 SHALL 明确注明“testMode=off，测试已跳过”。项目未提供的类别 SHALL 跳过并在报告中注明，SHALL NOT 因缺失而判定失败。`@lyx-archive` SHALL NOT 执行 `build` / 生产构建；生产构建由上线或发布流程负责。

验证 SHALL 在归档动作之前完成：执行范围内的类别全部通过才调用 `opsx:archive`；任一执行类别失败 SHALL 停止归档，SHALL NOT 移动 `openspec/changes/<change-name>/`，并如实报告失败的脚本与原始错误输出。无测试模式 SHALL NOT 把测试摘要描述为通过——只能描述为跳过。

验证时机 SHALL 为"归档前一次"——审查循环 SHALL NOT 重复执行测试 / 类型检查（见 `ly-review-gates`）；`openspec validate` 仍由 review-plan 每轮执行，不属于本能力的验证范围。

#### Scenario: 归档前验证通过
- **WHEN** `testMode = "normal"`，用户运行 `@lyx-archive <change-name>`，项目提供测试 / 类型检查脚本且全部通过
- **THEN** 命令在归档前执行测试与类型检查，全部通过后调用 `opsx:archive` 完成归档

#### Scenario: 归档前验证失败阻断归档
- **WHEN** `testMode = "normal"`，用户运行 `@lyx-archive <change-name>`，测试脚本执行失败
- **THEN** 命令停止归档，SHALL NOT 移动 `openspec/changes/<change-name>/`，如实报告失败的脚本与原始错误输出

#### Scenario: 无测试模式跳过测试但执行其余验证
- **WHEN** `testMode = "off"`，项目提供测试 / 类型检查脚本
- **THEN** 命令跳过测试，执行类型检查，并在报告中注明“testMode=off，测试已跳过”

#### Scenario: 归档前不执行生产构建
- **WHEN** 用户运行 `@lyx-archive <change-name>` 且项目提供 `build` 脚本
- **THEN** 命令不执行 `build`，并在报告中注明生产构建不属于归档门禁

#### Scenario: 项目未提供某类验证脚本
- **WHEN** 用户运行 `@lyx-archive <change-name>`，项目 `package.json` 未定义 `typecheck` 脚本
- **THEN** 命令跳过该项并在报告中注明"未提供 typecheck 脚本"，其余应执行的验证照常执行，不因该项缺失判定失败

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
