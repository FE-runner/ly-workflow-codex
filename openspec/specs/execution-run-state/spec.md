# execution-run-state Specification

## Purpose

为每个活跃 OpenSpec change 提供可跨压缩、中断和用户回合恢复的磁盘运行账本，记录阶段状态、机械裁决和新鲜验证证据。

## Requirements

### Requirement: 每个活跃 change 维护 run-state.md
`@lyx-propose` SHALL 在 change 目录下创建 `run-state.md`，并随 propose 阶段 commit 提交。文件 SHALL 至少记录 change 名、当前阶段、基线或最后成功 commit、已完成任务比例、最近审查轮次与终止类型、验证证据、机械裁决和下一步安全动作。run-state.md 的标题、字段名、状态说明和证据摘要 SHALL 使用当前宿主配置中 `[general].language` 对应的自然语言（缺失、空白或非法时按 `zh-CN`）；`@lyx-apply`、review-plan、review-code 与 archive 续写时 SHALL 沿用该文件现有语言。`run-state.md` SHALL 与 `context.md` 分离：`context.md` 保存讨论语义和取舍背景，`run-state.md` 只保存可恢复执行状态。

#### Scenario: propose 完成
- **WHEN** change artifacts、context.md 与方案自审完成
- **THEN** run-state 记录阶段为 propose commit 已完成，并给出下一步审查或 apply 入口

#### Scenario: zh-CN 宿主生成中文运行账本
- **WHEN** 当前宿主配置的 `[general].language` 为 `zh-CN`
- **THEN** run-state 使用中文标题、字段名和状态说明，代码标识符、命令和必要的技术状态值可保留英文

### Requirement: run-state 在阶段转换和验证后更新
propose、apply、review-plan、review-code 和 archive SHALL 在阶段开始或结束时更新 `run-state.md`。每完成一个任务或一轮审查，SHALL 记录最近可用基线 commit、检查命令、退出码、关键结果和未决项；当工作尚未进入阶段统一 commit 时 SHALL 标记“待本次阶段提交归属”，统一 commit 成功后 SHALL 在同一生命周期的下一次允许更新中回填 SHA。该规则 SHALL NOT 要求每个任务或每轮审查新增独立 commit。更新 SHALL 是增量或幂等的，SHALL NOT 删除既有证据。无状态变化的阶段 MAY 保持文件不变，SHALL NOT 为凑更新制造空内容。

#### Scenario: review-plan 正常清零
- **WHEN** 某轮 review-plan 以 Critical 为 0 且所有影响落地 Warning 已解决结束
- **THEN** run-state 写入终止类型 `normal`、轮次、统一提交 SHA 和下一步 apply

#### Scenario: 验证失败
- **WHEN** archive 前测试或构建失败
- **THEN** run-state 记录失败命令、退出码、关键错误摘要和“未归档”状态

### Requirement: 恢复优先读取 run-state 和 git 事实
命令在恢复中断的 change 时 SHALL 先读取 `run-state.md`，再以 `git status`、`git log` 和 `tasks.md` 核对事实。会话记忆与账本冲突时 SHALL 以可核验的 git 状态和文件内容为准，并把冲突记录为新的恢复事件；SHALL NOT 因账本存在就跳过当前文件核对。

#### Scenario: 会话压缩后继续 apply
- **WHEN** 用户在新回合继续一个已完成部分任务的 change
- **THEN** agent 从 run-state 获取 last commit 与任务进度，再用 git 和 tasks 校验后从第一个未完成或证据不一致的任务恢复

### Requirement: run-state 不保存敏感内容
run-state SHALL NOT 写入凭据、token、完整环境变量、私密 URL、用户无关个人信息或大段命令原始输出。验证证据 SHALL 保存命令、退出码、测试计数和短摘要；需要详细信息时引用已有日志路径或 commit，不复制敏感内容。

#### Scenario: 验证命令输出包含环境变量
- **WHEN** 命令输出包含可能的密钥或凭据
- **THEN** run-state 只记录脱敏摘要和“详见终端/日志”，不保存原始值

### Requirement: run-state 参与阶段贡献与归档
`run-state.md` SHALL 视为 change artifact，随对应生命周期阶段 commit 一并提交；review-plan 与 review-code SHALL 把它作为恢复和证据输入，但 SHALL NOT 将其当作实现代码挑错或要求修改的源码。archive SHALL 把最终 run-state 随 change 移入归档目录。

#### Scenario: archive 完成
- **WHEN** change 成功归档
- **THEN** run-state 位于归档 change 目录内，最后阶段为 archive，且包含最终验证证据和分支收尾结果
