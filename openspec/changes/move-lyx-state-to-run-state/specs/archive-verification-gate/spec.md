## MODIFIED Requirements

### Requirement: archive 在 ask 模式下使用 change 决策

`@lyx-archive` SHALL 在归档前验证开始前解析 effective 配置 `testMode` 与目标 change 的 run-state `testModeDecision`。effective 配置为 `ask` 且 run-state 决策合法时，归档门禁 SHALL 使用该决策；新字段缺失且目标 change 属于旧格式时，MAY 只读回退 `.openspec.yaml` 的 `lyx.testModeDecision`。决策缺失或非法时，命令 SHALL 询问一次 `normal` / `off` 并持久化到 run-state 后再验证。

最终决策为 `normal` 时 SHALL 执行测试与类型检查；最终决策为 `off` 时 SHALL 跳过测试并执行类型检查。两种模式 SHALL NOT 执行生产构建。因 `ask` 新写入，或本轮成功消费的前次遗留且尚未提交的 run-state 决策修改，SHALL 随既有 `git add -- openspec/` 进入归档 commit。

新 change 的 `.openspec.yaml` 不承载 lyx 决策；仅在兼容回退时读取旧 `.openspec.yaml`。需要回退时若该文件不可读或 YAML 解析失败，archive SHALL 在询问、写入、验证或归档动作前停止并要求人工修复。run-state frontmatter 不可读或解析失败时同样 SHALL 阻断归档。

#### Scenario: ask 已有 off 决策
- **WHEN** effective 配置为 `ask`，run-state 保存 `testModeDecision: "off"`
- **THEN** archive 跳过测试，执行 typecheck，并注明最终决策来自 run-state

#### Scenario: ask 已有 normal 决策
- **WHEN** effective 配置为 `ask`，run-state 保存 `testModeDecision: "normal"`
- **THEN** archive 执行测试与 typecheck，不执行 build

#### Scenario: archive 补问并持久化
- **WHEN** effective 配置为 `ask`，change 缺少决策，用户在归档前选择 `off`
- **THEN** archive 写入 run-state 的 `testModeDecision: "off"`，随归档 commit 提交，并按 off 执行门禁

#### Scenario: archive 消费继承 dirty 决策
- **WHEN** 前次阶段留下尚未提交的 run-state `testModeDecision`，archive 成功消费该决策并完成归档
- **THEN** 归档 commit 包含 `run-state.md`，不遗留 dirty 决策

#### Scenario: 旧活跃 change 只读回退
- **WHEN** run-state 没有 `testModeDecision`，目标旧 change 的 `.openspec.yaml` 保存 `lyx.testModeDecision = "off"`
- **THEN** archive 使用 `off` 执行门禁，且不修改 `.openspec.yaml`

#### Scenario: archive 未获得回答时停止
- **WHEN** effective 配置为 `ask` 且决策缺失，用户取消或环境无法交互
- **THEN** archive 停止在验证与归档动作前，不移动 change 目录

#### Scenario: run-state 不可读时停止
- **WHEN** effective 配置为 `ask` 且目标 change 的 run-state frontmatter 不可读或解析失败
- **THEN** archive 停止，不覆盖元数据、不执行门禁、不移动 change 目录

#### Scenario: YAML 不可读时停止
- **WHEN** effective 配置为 `ask`，run-state 缺少决策且需要回退读取旧 `.openspec.yaml`，但该文件不可读或解析失败
- **THEN** archive 停止，不覆盖元数据、不执行门禁、不移动 change 目录
