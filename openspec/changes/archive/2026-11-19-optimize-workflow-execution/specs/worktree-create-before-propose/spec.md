## REMOVED Requirements

### Requirement: propose 创建隔离时捕获并持久化 isolation metadata
**Reason**: 隔离 metadata 原写入已删除的 run-state。
**Migration**: propose 将当前隔离选择保留在会话中，并在 `context.md` 记录简短的人读执行上下文；后续命令缺少信息时询问用户。

## ADDED Requirements

### Requirement: propose 将隔离上下文记录到 context.md
`@lyx-propose` SHALL 在 change 名确认后把当前隔离方式、来源分支、开发分支和 worktree 路径（如适用）作为人类可读条目写入 `context.md` 的 `## 执行上下文`。该 section SHALL 不包含 YAML frontmatter、阶段机、commit 队列或 next action。`isolation = none` 时 SHALL 记录来源分支和“无需收尾”。信息缺失时 SHALL 写“未知”并在报告说明，不得猜测。

#### Scenario: worktree 隔离写入 context
- **WHEN** 用户选择隔离 worktree，来源分支 `main`，开发分支 `feature/login`
- **THEN** `context.md` 记录隔离方式、来源分支、开发分支与 worktree 绝对路径

#### Scenario: 留当前分支写入 context
- **WHEN** 用户选择留在当前分支
- **THEN** `context.md` 记录 `isolation: none` 与当前来源分支，并注明归档无需自动清理

#### Scenario: context 缺失隔离信息
- **WHEN** 旧 change 没有执行上下文
- **THEN** archive 不猜测来源分支，要求用户选择目标分支或跳过收尾

### Requirement: worktree baseline 默认执行轻量检查
worktree 创建并复制环境文件后，baseline SHALL 默认只验证依赖可用性，并运行项目提供的 typecheck 或明确声明的 smoke 命令；SHALL NOT 默认运行完整测试套件。项目没有 typecheck 或 smoke 命令时 SHALL 记录“未提供轻量 baseline”并继续，完整测试由 archive 门禁负责。用户显式要求完整 baseline 时 MAY 运行测试命令。

#### Scenario: 项目提供 typecheck
- **WHEN** 新 worktree 创建完成且项目定义 `typecheck`
- **THEN** 只运行依赖可用性检查与 typecheck，不默认运行 `test`

#### Scenario: 项目只有 test 脚本
- **WHEN** 新 worktree 没有 typecheck 或 smoke 命令，只定义完整 `test`
- **THEN** 默认记录轻量 baseline 不可用并继续，不自动运行完整测试

#### Scenario: 用户要求完整 baseline
- **WHEN** 用户显式要求完整 baseline
- **THEN** 命令可运行测试套件，并把结果作为已知风险输入
