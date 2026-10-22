## ADDED Requirements

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
