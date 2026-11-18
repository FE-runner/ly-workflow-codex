## ADDED Requirements

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
