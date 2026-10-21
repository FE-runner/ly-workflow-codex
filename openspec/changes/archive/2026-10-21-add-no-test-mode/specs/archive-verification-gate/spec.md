## MODIFIED Requirements

### Requirement: 归档前执行完整验证

`@lyx-archive` SHALL 在委托 OpenSpec 归档流程**之前**读取当前宿主 `testMode`。`testMode = "normal"` 时，对当前工作区执行完整验证，覆盖测试、类型检查、构建三类（按项目实际提供的脚本选择，例如 `package.json` 的 `scripts.test` / `scripts.typecheck` / `scripts.build`）。`testMode = "off"` 时，SHALL 跳过测试类别，但仍执行项目提供的类型检查与构建；报告 SHALL 明确注明“testMode=off，测试已跳过”。项目未提供的类别 SHALL 跳过并在报告中注明，SHALL NOT 因缺失而判定失败。

验证 SHALL 在归档动作之前完成：执行范围内的类别全部通过才调用 `opsx:archive`；任一执行类别失败 SHALL 停止归档，SHALL NOT 移动 `openspec/changes/<change-name>/`，并如实报告失败的脚本与原始错误输出。无测试模式 SHALL NOT 把测试摘要描述为通过——只能描述为跳过。

验证时机 SHALL 为"归档前一次"——审查循环 SHALL NOT 重复执行测试 / 类型检查 / 构建（见 `ly-review-gates`）；`openspec validate` 仍由 review-plan 每轮执行，不属于本能力的验证范围。

#### Scenario: 归档前验证通过
- **WHEN** `testMode = "normal"`，用户运行 `@lyx-archive <change-name>`，项目提供测试 / 类型检查 / 构建脚本且全部通过
- **THEN** 命令在归档前执行完整验证，全部通过后调用 `opsx:archive` 完成归档

#### Scenario: 归档前验证失败阻断归档
- **WHEN** `testMode = "normal"`，用户运行 `@lyx-archive <change-name>`，测试脚本执行失败
- **THEN** 命令停止归档，SHALL NOT 移动 `openspec/changes/<change-name>/`，如实报告失败的脚本与原始错误输出

#### Scenario: 无测试模式跳过测试但执行其余验证
- **WHEN** `testMode = "off"`，项目提供测试 / 类型检查 / 构建脚本
- **THEN** 命令跳过测试，执行类型检查与构建，并在报告中注明“testMode=off，测试已跳过”

#### Scenario: 项目未提供某类验证脚本
- **WHEN** 用户运行 `@lyx-archive <change-name>`，项目 `package.json` 未定义 `typecheck` 脚本
- **THEN** 命令跳过该项并在报告中注明"未提供 typecheck 脚本"，其余应执行的验证照常执行，不因该项缺失判定失败
