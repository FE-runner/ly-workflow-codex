# execution-run-state Specification

## Purpose

定义 lyx 全自动流程的非持久执行状态边界：状态只在同一未中断回合内传递，跨回合恢复依赖 Git、tasks、context、commit trailer 与审查快照，不创建 run-state 账本。

## Requirements

### Requirement: 新 change 不创建 run-state.md
`@lyx-propose`、`@lyx-apply`、`@lyx-review-plan`、`@lyx-review-code` 与 `@lyx-archive` SHALL NOT 为新建或新进入的 change 创建、更新或删除 `run-state.md`。存量 `run-state.md` MAY 留在仓库中供历史查看，但新流程 SHALL NOT 将其作为执行状态、恢复状态或分支收尾的输入。旧 `.openspec.yaml lyx.testModeDecision` 是唯一例外：它可由 `test-mode` 能力在旧 change 上只读复用，但不得改写。

#### Scenario: propose 创建新 change
- **WHEN** 用户运行 `@lyx-propose`
- **THEN** change 目录只包含 OpenSpec artifacts、`context.md` 及必要的 `review-findings.md`，不出现 `run-state.md`

#### Scenario: 存量 run-state 存在
- **WHEN** 一个活跃 change 已存在旧的 `run-state.md`
- **THEN** 新命令保持该文件不变，并忽略其中的 stage、commit 或下一步信息

### Requirement: 全自动状态只在当前会话内传递
全自动流程 SHALL 只在同一未中断全自动回合的当前会话中保存 `EXECUTION_MODE`、隔离坐标、测试模式选择和阶段结果，并在该回合按正常终态继续下一阶段。命令 SHALL NOT 承诺中断后的自动恢复；新用户回合开始时，状态 SHALL 从当前 Git、`tasks.md`、`context.md`、commit trailer 和用户重新提供的决策重建。

#### Scenario: 同一回合连续执行
- **WHEN** 用户选择全自动且 review-plan 正常清零
- **THEN** 当前会话直接继续 apply，不依赖磁盘状态文件

#### Scenario: 回合中断后重新进入
- **WHEN** 全自动流程在 apply 前中断，用户在稍后重新调用 `@lyx-apply <change-name>`
- **THEN** 命令从当前 tasks、Git 文件和 `context.md` 读取事实，不声称从旧 run-state 自动恢复

### Requirement: 执行证据分散到现有 artifacts
新流程 SHALL 将执行证据保存在既有 artifact 和 Git 元数据中：任务进度使用 `tasks.md` 勾选；阶段身份使用 `Change-Stage` / `Change-Name` trailer；审查未修项使用 `review-findings.md`；讨论决策、测试模式和隔离上下文使用 `context.md`；命令证据使用阶段报告与 commit 正文。SHALL NOT 新增专用执行账本或其他替代状态文件。

#### Scenario: apply 后识别实施结果
- **WHEN** 用户或后续命令需要确认 apply 已完成
- **THEN** 通过 apply 阶段 commit trailer、tasks 勾选和提交文件集合判断，不读取 run-state

#### Scenario: archive 读取隔离上下文
- **WHEN** archive 需要执行分支收尾
- **THEN** 从当前 Git 状态和 `context.md` 的简短执行上下文推导候选值，信息不足时询问用户

### Requirement: 既有 run-state 不被自动迁移或删除
仓库 SHALL NOT 批量扫描、迁移、改写或删除既有 `run-state.md`。该文件在历史 change、归档目录和工作树中保持原样；任何删除 MUST 由用户显式请求。

#### Scenario: 归档历史 change
- **WHEN** 一个包含 `run-state.md` 的旧 change 被归档
- **THEN** 文件随 change 目录原样移动，不作为新归档状态机器读取
