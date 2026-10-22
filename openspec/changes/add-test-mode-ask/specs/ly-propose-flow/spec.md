## ADDED Requirements

### Requirement: propose 与 apply 使用 change 级 ask 决策

`@lyx-propose` SHALL 在生成 artifacts 前解析 effective 配置 `testMode` 与 change 级决策。effective 配置为 `ask` 且新 change 尚无 `lyx.testModeDecision` 时，命令 SHALL 在生成 artifacts 前询问一次 `normal` / `off`，并按选择决定是否生成测试任务；真实 change 名确定后，SHALL 把选择写入该 change 的 `.openspec.yaml`，随 propose 阶段 commit 提交。

`@lyx-apply` SHALL 在实施前读取当前 change 的 `lyx.testModeDecision`。effective 配置为 `ask` 且决策合法时，apply SHALL 使用该决策；决策缺失或非法时，apply SHALL 询问一次并持久化后再实施。配置为 `normal` / `off` 时，配置 SHALL 覆盖历史决策。

最终决策为 `off` 时，propose/apply SHALL 遵守无测试模式；最终决策为 `normal` 时，SHALL 按 `risk-based-testing-policy` 生成测试任务并在 apply 执行相称测试。任何因 `ask` 写入 `.openspec.yaml` 的 apply SHALL 把该文件纳入待提交清单，即使没有其他实施改动也不得遗漏该决策修改。

#### Scenario: ask 选择 normal 时 propose 生成测试任务
- **WHEN** effective 配置为 `ask`，用户在 `@lyx-propose` 中选择 `normal`
- **THEN** artifacts 按风险策略包含相称测试任务，`.openspec.yaml` 写入 `lyx.testModeDecision = "normal"` 并随 propose commit 提交

#### Scenario: ask 选择 off 时 propose 不生成测试任务
- **WHEN** effective 配置为 `ask`，用户在 `@lyx-propose` 中选择 `off`
- **THEN** tasks 不包含测试文件或测试命令任务，`.openspec.yaml` 写入 `lyx.testModeDecision = "off"`

#### Scenario: apply 沿用 change 决策
- **WHEN** effective 配置为 `ask`，change 保存 `lyx.testModeDecision = "off"`
- **THEN** apply 不执行测试命令，跳过测试专用任务并保留实现部分

#### Scenario: apply 补问并提交元数据
- **WHEN** effective 配置为 `ask`，目标 change 缺少决策，用户在 apply 中选择 `normal`
- **THEN** apply 写入 `lyx.testModeDecision = "normal"`，随 apply 阶段 commit 提交 `.openspec.yaml` 并按 normal 执行相称测试

#### Scenario: 历史决策不覆盖显式配置
- **WHEN** change 保存 `lyx.testModeDecision = "off"`，当前 effective 配置为 `normal`
- **THEN** apply 使用 `normal`，不沿用历史 `off`

#### Scenario: 未回答时 propose 停止
- **WHEN** effective 配置为 `ask`，用户在 propose 的测试模式询问中取消回答
- **THEN** 命令停止，不生成任何 artifacts 或测试任务
