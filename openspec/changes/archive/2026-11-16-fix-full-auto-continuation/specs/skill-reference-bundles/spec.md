## ADDED Requirements

### Requirement: 全自动交接锚点保存在主 skill
`propose`、`review-plan` 与 `apply` 的最终宿主渲染主 `SKILL.md` SHALL 各自保留简短、最高优先级的“全自动交接”段，写明当前阶段的下一阶命令、同级 skill 路径、必须读取主文件与全部 references，以及只输出命令标识不算执行。该段 SHALL 在上下文压缩后仍可见，不得只存在于 sidecar reference。

#### Scenario: 压缩后仍能定位下一阶段
- **WHEN** 全自动会话发生上下文压缩，宿主只重新挂载 `propose`、`review-plan` 或 `apply` 的主 `SKILL.md`
- **THEN** 主文件仍包含下一阶段同级 skill 路径和完整 bundle 读取要求，不依赖此前工具输出

#### Scenario: 主文件过期时测试失败
- **WHEN** 任一上述主文件删除“读取同级 `lyx-<next-command>/SKILL.md` 及其 references”或“只输出命令标识不算交接”的锚点
- **THEN** 模板契约测试失败，不把该 bundle 视为可发布

#### Scenario: review-code 不要求虚构下一阶段
- **WHEN** review-code 以正常清零结束全自动流水线
- **THEN** 该主文件不要求加载不存在的下一 skill，只在报告中说明流水线正常终态
