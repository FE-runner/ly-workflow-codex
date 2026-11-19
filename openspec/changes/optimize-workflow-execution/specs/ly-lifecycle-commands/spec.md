## REMOVED Requirements

### Requirement: 生命周期命令以 run-state 作为 lyx 状态源
**Reason**: 新流程删除 run-state，生命周期命令改为从 Git、tasks、context 和 commit trailer 获取事实。
**Migration**: 存量文件保持原样；后续命令不读取其中状态，缺失决策时由当前调用重新询问或使用显式配置。

### Requirement: archive 归档提交后进入分支收尾流程
**Reason**: 原要求绑定归档后 run-state isolation metadata，需替换为不依赖账本的收尾流程。
**Migration**: 归档提交后仍执行分支收尾，但候选分支从当前 Git 与 `context.md` 推导，信息不足时询问用户。

## ADDED Requirements

### Requirement: 生命周期命令不依赖持久运行账本
propose、apply、review-plan、review-code 与 archive SHALL NOT 创建、读取或更新 `run-state.md`。阶段身份 SHALL 由 Git commit trailer 和当前会话结果确定；任务进度 SHALL 由 `tasks.md` 勾选确定；讨论决策与隔离信息 SHALL 来自 `context.md`；未修审查项 SHALL 来自 `review-findings.md`。命令遇到信息不足时 SHALL 询问用户或根据当前 Git 事实进入保守路径，SHALL NOT 虚构历史阶段。

#### Scenario: apply 识别已完成任务
- **WHEN** 用户重新调用 `@lyx-apply <change-name>`
- **THEN** 命令读取 `tasks.md`、Git diff 与 apply 阶段 commit，不读取 run-state

#### Scenario: review 识别审查基线
- **WHEN** 用户调用 `@lyx-review-plan` 或 `@lyx-review-code`
- **THEN** 命令通过 `Change-Stage` / `Change-Name` trailer 定位对应阶段 commit

### Requirement: apply 按批次执行低风险验证
`@lyx-apply` SHALL 读取 tasks 中每个任务的验证要求，并允许连续、使用相同命令且无独立风险边界的低风险任务共享一次批次验证。行为或契约改动、逻辑缺陷复现、安全或迁移任务，以及 tasks 明确声明为独立验证单元的任务 SHALL 保留自身验证检查点。批次验证通过后 MAY 一次性勾选该批次全部任务；任一任务失败时 SHALL 报告批次中失败的检查点并停止自动勾选后续任务。

#### Scenario: 低风险任务同命令合并
- **WHEN** 连续三个文档或配置任务都要求 `pnpm typecheck`
- **THEN** apply 在批次结束时运行一次 typecheck，并据结果勾选三个任务

#### Scenario: 高风险任务不合并
- **WHEN** 一个任务要求先写失败复现测试
- **THEN** 该任务独立运行测试，不等待其他任务

### Requirement: archive 从当前 Git 与 context 推导分支收尾
`@lyx-archive` 在归档提交成功后 SHALL 根据当前分支、`git worktree list --porcelain` 和 `context.md` 的 `## 执行上下文` 识别开发分支、来源分支与 worktree 候选。当前会话仍保有 propose 隔离选择时 MAY 直接使用该值；新回合信息不足时 SHALL 询问目标分支或跳过收尾，SHALL NOT 默认猜测 `main` / `master`。所有 merge、worktree 删除和分支删除仍须用户确认，并保持现有失败保留现场规则。

#### Scenario: context 含来源分支
- **WHEN** 归档后的 `context.md` 记录来源分支 `main`、开发分支 `feature/login` 和当前 worktree 路径
- **THEN** archive 校验 Git 状态后提示是否合并和清理

#### Scenario: 新回合缺少来源分支
- **WHEN** archive 在新会话运行且 context 与当前会话都没有来源分支
- **THEN** 命令要求用户选择目标分支或跳过收尾
