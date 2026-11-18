## MODIFIED Requirements

### Requirement: propose 与 apply 使用 change 级 ask 决策

`@lyx-propose` SHALL 在生成 artifacts 前解析 effective 配置 `testMode` 与 change 级决策。effective 配置为 `ask` 且新 change 尚无 change 级决策时，命令 SHALL 在生成 artifacts 前询问一次 `normal` / `off`，并在当前会话暂存该选择；真实 change 名确定后，SHALL 把选择写入该 change 的 `run-state.md` 固定 frontmatter，随 propose 阶段 commit 提交。若在 run-state 建立前中断，恢复时 MAY 重新询问，SHALL NOT 伪造已持久化的决策。

`@lyx-apply` SHALL 在实施前读取当前 change 的 `run-state.md` `testModeDecision`。新字段缺失且目标 change 属于旧格式时，MAY 只读回退 `.openspec.yaml` 的 `lyx.testModeDecision`。effective 配置为 `ask` 且决策合法时，apply SHALL 使用该决策；决策缺失或非法时，apply SHALL 询问一次并把新选择持久化到 run-state 后再实施。配置为 `normal` / `off` 时，配置 SHALL 覆盖历史决策。

最终决策为 `off` 时，propose/apply SHALL 遵守无测试模式；最终决策为 `normal` 时，SHALL 按 `risk-based-testing-policy` 生成测试任务并在 apply 执行相称测试。apply SHALL 在成功路径把 `run-state.md` 纳入待提交清单，只要本轮新写入决策，或读取了前次遗留且尚未提交的决策；即使没有其他实施改动也不得遗漏该决策修改。

apply 在最终模式为 `normal` 时 SHALL 校验 artifacts 与该模式一致：若历史决策为 `off` 但配置覆盖为 `normal`，或缺失决策补问为 `normal`，而 proposal/tasks 没有测试任务或测试执行计划，apply SHALL 在实施前停止并要求先更新 artifacts 或恢复配置，SHALL NOT 临时添加范围外测试。

新 change 的 `.openspec.yaml` 整体不可读或 YAML 解析失败时，propose/apply SHALL 停止并要求人工修复 OpenSpec 元数据。仅在需要回退读取旧 `lyx` 时，旧 `.openspec.yaml` 不可读或解析失败同样 SHALL 阻断。

#### Scenario: ask 选择 normal 时 propose 生成测试任务
- **WHEN** effective 配置为 `ask`，用户在 `@lyx-propose` 中选择 `normal`
- **THEN** artifacts 按风险策略包含相称测试任务，run-state 写入 `testModeDecision: "normal"` 并随 propose commit 提交

#### Scenario: ask 选择 off 时 propose 不生成测试任务
- **WHEN** effective 配置为 `ask`，用户在 `@lyx-propose` 中选择 `off`
- **THEN** tasks 不包含测试文件或测试命令任务，run-state 写入 `testModeDecision: "off"`

#### Scenario: apply 沿用 change 决策
- **WHEN** effective 配置为 `ask`，run-state 保存 `testModeDecision: "off"`
- **THEN** apply 不执行测试命令，跳过测试专用任务并保留实现部分

#### Scenario: apply 补问并提交元数据
- **WHEN** effective 配置为 `ask`，目标 change 缺少决策，用户在 apply 中选择 `normal`
- **THEN** apply 写入 run-state 的 `testModeDecision: "normal"`，随 apply 阶段 commit 提交 `run-state.md` 并按 normal 执行相称测试

#### Scenario: 旧活跃 change 只读回退
- **WHEN** run-state 没有 `testModeDecision`，旧 change 的 `.openspec.yaml` 保存 `lyx.testModeDecision = "off"`
- **THEN** apply 使用 `off` 且不修改 `.openspec.yaml`

#### Scenario: 历史决策不覆盖显式配置
- **WHEN** run-state 保存 `testModeDecision: "off"`，当前 effective 配置为 `normal`
- **THEN** apply 使用 `normal`，不沿用历史 `off`

#### Scenario: 未回答时 propose 停止
- **WHEN** effective 配置为 `ask`，用户在 propose 的测试模式询问中取消回答
- **THEN** 命令停止，不生成任何 artifacts 或测试任务

#### Scenario: run-state 不可读时停止
- **WHEN** effective 配置为 `ask` 且目标 change 的 run-state frontmatter 不可读或解析失败
- **THEN** propose/apply 停止，不覆盖元数据，也不执行测试相关动作

#### Scenario: YAML 不可读时停止
- **WHEN** effective 配置为 `ask`，run-state 缺少决策且需要回退读取旧 `.openspec.yaml`，但该文件不可读或解析失败
- **THEN** propose/apply 停止，不覆盖元数据，也不执行测试相关动作

#### Scenario: normal 覆盖历史 off 但 artifacts 未规划测试时停止
- **WHEN** change 保存 `testModeDecision: "off"`，当前配置为 `normal`，tasks 没有测试任务或测试执行计划
- **THEN** apply 在实施前停止并提示更新 artifacts 或恢复配置

### Requirement: propose 初始化 change 运行账本
`@lyx-propose` SHALL 在真实 change 名确认后、方案自审开始前创建 `run-state.md`，以固定 YAML frontmatter 初始记录 isolation metadata、执行模式、`stage: propose-self-review`、流水线阶段、propose 基线、`testModeDecision`（如有）和下一步安全动作；自审与 context.md 完成后再增量写入自审结论摘要。该文件 SHALL 作为 change artifact 与 context.md 一同纳入 propose 阶段提交，但不得替代 proposal/design/tasks。

propose SHALL NOT 为新建 change 向 `.openspec.yaml` 写入 `lyx:` 或 `x-lyx:`；隔离、测试模式和运行坐标只写入 run-state。

#### Scenario: 全自动自审前已有恢复账本
- **WHEN** 用户选择全自动，真实 change 名确认且方案自审即将开始
- **THEN** `run-state.md` 已记录 `executionMode: full-auto`、`stage: propose-self-review`、隔离信息、测试模式（如已选择）和下一流水线阶段

#### Scenario: 全自动 propose 结束
- **WHEN** propose commit 成功
- **THEN** run-state 的下一步是 review-plan 或 apply，取决于 reviewMode 与自动/手动路径

#### Scenario: 新 change 不写 lyx 扩展字段
- **WHEN** propose 为新 change 写入隔离与测试模式
- **THEN** `.openspec.yaml` 只包含 OpenSpec 官方字段，不包含 `lyx:` 或 `x-lyx:`

### Requirement: 全自动阶段交接显式加载下一 skill bundle
`@lyx-propose` 的全自动流水线在进入 review-plan、apply 或 review-code 前，SHALL 以当前 skill 所在目录为锚点解析同级 `lyx-<next-command>/SKILL.md`，完整读取该主文件及其 frontmatter 声明的全部 references，再按该 bundle 执行。仅输出 `@lyx-<command>`、写出下一阶段名称或等待用户再次触发 SHALL NOT 视为已交接。

#### Scenario: review-plan 正常清零后进入 apply
- **WHEN** 全自动执行中的 review-plan 以正常清零结束，`run-state.md` 的下一步为 apply
- **THEN** 当前回合读取同级 `lyx-apply/SKILL.md` 与声明的 references，随后以同一 change 名继续 apply，不在阶段报告后结束

#### Scenario: apply 正常完成后进入 review-code
- **WHEN** apply 实施、验证与阶段 commit 均正常完成，且 `run-state.md` 的下一步为 review-code
- **THEN** 当前回合读取同级 `lyx-review-code/SKILL.md` 与声明的 references，随后继续代码审查

#### Scenario: 只输出命令标识不算交接
- **WHEN** 阶段报告写有“下一步运行 `@lyx-apply <change-name>`”，但没有读取 `lyx-apply` bundle
- **THEN** 该回合不得声明全自动已推进，恢复时应从 run-state 记录的当前阶段重新执行显式交接

#### Scenario: 人工介入点仍允许结束
- **WHEN** review-plan 或 apply 因业务决策、失败或审查终止条件需要人工介入
- **THEN** 不加载下一阶段 bundle，如实报告停止原因并结束全自动回合

#### Scenario: 方案自审后先完成 propose 内部步骤
- **WHEN** 全自动 propose 输出方案自审逐项结论清单且无待用户决策项
- **THEN** 同一回合依次产出 context.md、更新包含 isolation metadata 的 run-state，并提交 propose 阶段 commit，之后才读取 review-plan bundle

#### Scenario: opsx planning boundary 不终止 lyx 编排
- **WHEN** 被委托的 opsx:propose 完成 artifacts 并声明 planning boundary 或 “stop after artifacts”
- **THEN** 当前会话返回 lyx-propose 编排，继续后续步骤；该声明不要求用户再次触发环节，也不把 artifacts 完成作为全自动终态

#### Scenario: 自审中断后从 run-state 恢复
- **WHEN** 唯一活跃 change 的 run-state 记录 `stage: propose-self-review`、`executionMode: full-auto` 且 proposal/design/tasks 完整
- **THEN** 恢复执行沿用 run-state 中的 isolation 与执行模式，从方案自审或 context.md 产出继续，不重复询问隔离方式或全自动/手动
