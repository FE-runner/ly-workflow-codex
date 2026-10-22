## ADDED Requirements

### Requirement: fix 在 ask 模式下每次调用询问

`@lyx-fix` 不创建 change 元数据，effective 配置 `testMode = "ask"` 时 SHALL 在每次调用进入实施前询问一次 `normal` / `off`。该选择 SHALL 只对本次 fix 生效，SHALL NOT 写入任何 change 元数据或宿主配置。

选择 `normal` 时 SHALL 使用风险测试策略；选择 `off` 时 SHALL 遵守无测试模式。用户取消或环境无法交互时 SHALL 停止在测试动作前。effective 配置为 `normal` / `off` 时 SHALL 直接使用配置，不询问。

#### Scenario: ask 每次 fix 都询问
- **WHEN** effective 配置为 `ask`，用户连续两次运行 `@lyx-fix`
- **THEN** 两次调用分别询问测试模式，不沿用上一次 fix 的选择

#### Scenario: fix 选择 normal
- **WHEN** `@lyx-fix` 在 `ask` 下选择 `normal`，本次为逻辑 bug 修复
- **THEN** 命令按风险策略先写复现测试并确认失败，再修复至通过

#### Scenario: fix 选择 off
- **WHEN** `@lyx-fix` 在 `ask` 下选择 `off`
- **THEN** 本次不新增或修改测试文件、不运行测试命令，改用 typecheck / build 等非测试验证

#### Scenario: ask 取消时停止
- **WHEN** `@lyx-fix` 在 `ask` 下无法获得用户选择
- **THEN** 命令停止，不开始实施或运行测试
