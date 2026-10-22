# archive-verification-gate Specification

## Purpose

定义归档前的完整验证关卡：`@lyx-archive` 在委托 OpenSpec 归档前对当前工作区执行一次项目完整验证（测试 / 类型检查 / 构建），验证失败时阻断归档，避免未通过验证的 change 被归档。

## Requirements

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

### Requirement: archive 在 ask 模式下使用 change 决策

`@lyx-archive` SHALL 在归档前验证开始前解析 effective 配置 `testMode` 与目标 change 的 `lyx.testModeDecision`。effective 配置为 `ask` 且决策合法时，归档门禁 SHALL 使用该决策；决策缺失或非法时，命令 SHALL 询问一次 `normal` / `off` 并持久化后再验证。

最终决策为 `normal` 时 SHALL 执行测试、类型检查、构建完整验证；最终决策为 `off` 时 SHALL 跳过测试并执行类型检查、构建。因 `ask` 新写入，或本轮成功消费的前次遗留且尚未提交的 `.openspec.yaml` 决策修改，SHALL 随既有 `git add -- openspec/` 进入归档 commit。

`.openspec.yaml` 整体不可读或 YAML 解析失败时，archive SHALL 在询问、写入、验证或归档动作前停止并要求人工修复。

#### Scenario: ask 已有 off 决策
- **WHEN** effective 配置为 `ask`，change 保存 `lyx.testModeDecision = "off"`
- **THEN** archive 跳过测试，执行 typecheck / build，并注明最终决策来自 change 元数据

#### Scenario: ask 已有 normal 决策
- **WHEN** effective 配置为 `ask`，change 保存 `lyx.testModeDecision = "normal"`
- **THEN** archive 执行测试、typecheck、build 完整验证

#### Scenario: archive 补问并持久化
- **WHEN** effective 配置为 `ask`，change 缺少决策，用户在归档前选择 `off`
- **THEN** archive 写入 `lyx.testModeDecision = "off"`，随归档 commit 提交，并按 off 执行门禁

#### Scenario: archive 消费继承 dirty 决策
- **WHEN** 前次阶段留下尚未提交的 `lyx.testModeDecision`，archive 成功消费该决策并完成归档
- **THEN** 归档 commit 包含 `.openspec.yaml`，不遗留 dirty 决策

#### Scenario: archive 未获得回答时停止
- **WHEN** effective 配置为 `ask` 且决策缺失，用户取消或环境无法交互
- **THEN** archive 停止在验证与归档动作前，不移动 change 目录

#### Scenario: YAML 不可读时停止
- **WHEN** effective 配置为 `ask` 且目标 change 的 `.openspec.yaml` 不可读或解析失败
- **THEN** archive 停止，不覆盖元数据、不执行门禁、不移动 change 目录
