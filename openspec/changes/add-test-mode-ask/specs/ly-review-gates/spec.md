## ADDED Requirements

### Requirement: review 在 ask 模式下使用 change 决策

`@lyx-review-plan` 与 `@lyx-review-code` SHALL 在开始测试相关判级前解析 effective 配置 `testMode` 与目标 change 的 `lyx.testModeDecision`。effective 配置为 `ask` 且决策合法时，审查 SHALL 使用该决策；决策缺失或非法时，命令 SHALL 询问一次 `normal` / `off` 并持久化后再审查。

最终决策为 `off` 时，审查 SHALL 继续遵守无测试模式例外；最终决策为 `normal` 时，测试风险策略照常适用。任何因 `ask` 写入 `.openspec.yaml` 的审查命令 SHALL 把该文件纳入正常清零统一 commit；若本轮没有审查修复，但决策元数据被新写入，SHALL 为该实际改动创建一次 commit，不得留下未提交决策。

#### Scenario: review 使用已保存 off
- **WHEN** effective 配置为 `ask`，change 保存 `lyx.testModeDecision = "off"`
- **THEN** review-plan / review-code 不产生测试缺失类发现，也不重复询问

#### Scenario: review 使用已保存 normal
- **WHEN** effective 配置为 `ask`，change 保存 `lyx.testModeDecision = "normal"`
- **THEN** review 按风险测试策略判定测试相关发现

#### Scenario: review 补问并提交决策
- **WHEN** effective 配置为 `ask`，change 缺少决策，用户在 review-plan 中选择 `off`
- **THEN** review 写入 `lyx.testModeDecision = "off"`，并在正常清零时把 `.openspec.yaml` 纳入统一 commit

#### Scenario: 无其他修复时仍提交决策
- **WHEN** review-code 在 `ask` 下补问并写入决策，但本轮没有 Critical 或其他修复
- **THEN** 命令仍提交仅含 `.openspec.yaml` 决策修改的阶段 commit，使工作区恢复干净

#### Scenario: review 未获得回答时停止
- **WHEN** effective 配置为 `ask` 且决策缺失，用户取消或环境无法交互
- **THEN** 审查在输出任何测试缺失类发现前停止，不默认按 normal / off 继续
