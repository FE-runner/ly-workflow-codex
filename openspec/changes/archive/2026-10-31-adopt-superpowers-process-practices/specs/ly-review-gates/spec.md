## ADDED Requirements

### Requirement: review-plan 检查实施可执行性
`@lyx-review-plan` SHALL 审查 tasks 是否足以让一个无会话历史的实施者直接开始：文件或定位锚点、接口、验证命令、预期结果和独立审查边界必须明确。含糊任务或缺失验证属于方案审查发现；若文档自身无法给出答案且需要产品决策，SHALL 不得判为机械可自动修复。

#### Scenario: 新实施者无法判断接口
- **WHEN** tasks 提到一个跨模块接口但 proposal/design 未定义其参数或返回结构
- **THEN** review-plan 报告影响落地的发现，并要求在方案中补齐接口

### Requirement: 审查关卡读取 run-state 作为恢复事实
review-plan 与 review-code 在开始和每轮循环前 SHALL 读取 `run-state.md` 中当前阶段、基线 commit、最近轮次和未决项，并用 git 事实核对。若账本与 git 不一致，命令 SHALL 在报告中说明并以 git 为准继续或停止；SHALL NOT 把账本当作用来替代真实 diff 的内容。

#### Scenario: run-state 的 headCommit 过旧
- **WHEN** run-state 记录的 HEAD 与当前 HEAD 不一致
- **THEN** 审查报告说明差异，按既有基线锚定规则重新核对，不静默覆盖旧记录

### Requirement: 审查报告记录新鲜验证证据
review-plan 与 review-code 的报告 SHALL 为正常清零和终止结论提供本轮可核验证据：执行的校验命令、退出码、关键输出摘要、审查基线和轮次。依赖 subagent 自报成功时，主会话 SHALL 核对 diff、文件清单或命令结果后再声明完成。慢测试仍由 archive 统一执行，审查阶段 SHALL NOT 声称没有运行的测试已经通过。

#### Scenario: subagent 声称修复成功
- **WHEN** 审查 subagent 报告问题已修复但没有对应 diff 或命令证据
- **THEN** 主会话要求下一轮核验或把结论标为证据不足，不据此清零
