## ADDED Requirements

### Requirement: 直接调用审查命令不受 reviewMode 影响
`@lyx-review-plan` / `@lyx-review-code` 被用户或调用方**直接调用**时，SHALL 按本能力的既有规则执行审查-修复循环，SHALL NOT 读取或受当前宿主配置的 `reviewMode`（见 `subagent-agent-config`）影响。`reviewMode` SHALL 只门控编排入口 `@lyx-propose` 触发哪些审查关卡（见 `ly-propose-flow`）；直接调用的审查命令 SHALL NOT 因 `reviewMode = "off"` / `"plan-only"` / `"code-only"` 而被静默跳过、降级为 no-op 或改变审查范围。

#### Scenario: reviewMode=off 时直接调用 review-plan 仍然审查
- **WHEN** 用户配置 `reviewMode = "off"`，但仍直接运行 `@lyx-review-plan <change-name>`
- **THEN** 命令照常执行方案审查-修复循环，SHALL NOT 因 `reviewMode = "off"` 跳过或降级审查

#### Scenario: reviewMode=plan-only 时直接调用 review-code 仍然审查
- **WHEN** 用户配置 `reviewMode = "plan-only"`，但仍直接运行 `@lyx-review-code <change-name>`
- **THEN** 命令照常执行代码审查-修复循环，SHALL NOT 因 `reviewMode` 未包含代码审查而跳过
