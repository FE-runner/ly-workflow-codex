## Purpose

定义归档前的完整验证关卡：`@lyx-archive` 在委托 OpenSpec 归档前对当前工作区执行一次项目完整验证（测试 / 类型检查 / 构建），验证失败时阻断归档，避免未通过验证的 change 被归档。

## ADDED Requirements

### Requirement: 归档前执行完整验证

`@lyx-archive` SHALL 在委托 OpenSpec 归档流程**之前**对当前工作区执行一次项目完整验证，覆盖测试、类型检查、构建三类（按项目实际提供的脚本选择，例如 `package.json` 的 `scripts.test` / `scripts.typecheck` / `scripts.build`）。项目未提供的类别 SHALL 跳过并在报告中注明，SHALL NOT 因缺失而判定失败。

验证 SHALL 在归档动作之前完成：全部通过才调用 `opsx:archive`；任一类别失败 SHALL 停止归档，SHALL NOT 移动 `openspec/changes/<change-name>/`，并如实报告失败的脚本与原始错误输出。

验证时机 SHALL 为"归档前一次"——审查循环 SHALL NOT 重复执行测试 / 类型检查 / 构建（见 `ly-review-gates`）；`openspec validate` 仍由 review-plan 每轮执行，不属于本能力的验证范围。

#### Scenario: 归档前验证通过

- **WHEN** 用户运行 `@lyx-archive <change-name>`，项目提供测试 / 类型检查 / 构建脚本且全部通过
- **THEN** 命令在归档前执行完整验证，全部通过后调用 `opsx:archive` 完成归档，并按 `ly-lifecycle-commands` 规则提交 `archive: <change-name>`

#### Scenario: 归档前验证失败阻断归档

- **WHEN** 用户运行 `@lyx-archive <change-name>`，测试脚本执行失败
- **THEN** 命令停止归档，SHALL NOT 移动 `openspec/changes/<change-name>/`，如实报告失败的脚本与原始错误输出

#### Scenario: 项目未提供某类验证脚本

- **WHEN** 用户运行 `@lyx-archive <change-name>`，项目 `package.json` 未定义 `typecheck` 脚本
- **THEN** 命令跳过该项并在报告中注明"未提供 typecheck 脚本"，其余存在的验证照常执行，不因该项缺失判定失败

