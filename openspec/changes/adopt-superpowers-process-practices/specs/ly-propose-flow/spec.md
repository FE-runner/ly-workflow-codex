## ADDED Requirements

### Requirement: 方案自审增加实施就绪检查
`@lyx-propose` 的方案自审 SHALL 在既有四项检查之外验证实施就绪：每个核心任务有明确文件路径或可检索定位锚点；跨任务接口写明参数、返回值或数据结构；每个任务有可运行验证命令和预期结果；禁止“完善处理”“适当校验”“补充相关逻辑”等不可执行描述；每个任务可作为独立交付、验证和审查单元。机械缺失 SHALL 直接修复，涉及产品语义或取舍的未知项 SHALL 询问用户。

#### Scenario: tasks 缺少验证命令
- **WHEN** 某核心任务只写“实现接口”但没有可运行验证方式和预期输出
- **THEN** propose 自审把该项标为机械断链，补齐验证命令或明确无法自动化的验证原因后再 commit

#### Scenario: 任务需要未决业务决策
- **WHEN** 实施者必须决定是否支持一个尚未确认的用户场景
- **THEN** propose 自审把该问题列为待用户决策，不自行补默认行为

### Requirement: propose 初始化 change 运行账本
`@lyx-propose` SHALL 在 change 确定后创建 `run-state.md`，记录 isolation metadata、propose 基线、当前阶段、自审结论摘要和下一步。该文件 SHALL 作为 change artifact 与 context.md 一同纳入 propose 阶段提交，但不得替代 proposal/design/tasks。

#### Scenario: 全自动 propose 结束
- **WHEN** propose commit 成功
- **THEN** run-state 的下一步是 review-plan 或 apply，取决于 reviewMode 与自动/手动路径
