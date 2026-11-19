## REMOVED Requirements

### Requirement: change 级 ask 决策持久化
**Reason**: 持久决策依赖已删除的 `run-state.md`，并与本次流程减负目标冲突。
**Migration**: `ask` 改为当前调用会话内决策；跨命令或中断后重新询问。需要无人值守时使用项目或宿主级 `normal` / `off`。

## ADDED Requirements

### Requirement: ask 决策使用当前调用会话
effective `testMode = "ask"` 时，change 级命令 SHALL 在需要测试决策前询问一次 `normal` / `off`。选择 SHALL 在同一个未中断全自动回合的 propose、审查、apply 内复用；新的直接命令调用、新用户回合或中断后 SHALL 视为没有可复用选择并重新询问。命令 SHALL NOT 把决策写入 `run-state.md`、`.openspec.yaml` 或其他专用状态文件。显式项目或宿主级 `normal` / `off` SHALL 优先并避免询问。

#### Scenario: propose 在同一回合选择
- **WHEN** effective 配置为 `ask`，用户选择 `off`
- **THEN** propose、同回合 review-plan 和 apply 使用 `off`，但不创建 run-state

#### Scenario: 新回合重新询问
- **WHEN** effective 配置为 `ask`，用户在上一个回合选择过 `normal`，稍后重新调用 `@lyx-apply`
- **THEN** 新调用重新询问 `normal` / `off`，不声称读取已持久化决策

#### Scenario: 显式配置覆盖
- **WHEN** effective 配置为项目级 `normal`
- **THEN** 命令直接使用 `normal`，不询问

### Requirement: ask 决策可写入 context.md 供当前流程说明
命令 MAY 在 `context.md` 的 `## 执行上下文` 中记录本次所选测试模式及其来源，作为人类可读的讨论记录。该记录 SHALL NOT 被解释为跨命令持久决策，亦不得替代每次新命令对 effective 配置的重新解析。命令不得把该记录写入机器 frontmatter。

#### Scenario: context 记录测试模式
- **WHEN** propose 在 ask 下选择 `off`
- **THEN** `context.md` 可包含“测试模式：off”，但后续新命令仍需按 effective 配置重新解析并在 ask 时询问

#### Scenario: 旧 `.openspec.yaml` 存在 lyx 决策
- **WHEN** 一个旧 change 的 `.openspec.yaml` 含 `lyx.testModeDecision`
- **THEN** `ask` 且没有同回合选择时，命令 MAY 只读复用该合法值；不改写文件，也不把它扩展到新 change 流程
