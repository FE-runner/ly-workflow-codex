## ADDED Requirements

### Requirement: propose 创建隔离时捕获并持久化 isolation metadata

`/ly:propose` SHALL 在创建 worktree 或切新分支前捕获本次隔离信息，至少包含：

- `isolation`: `worktree` / `branch` / `none`
- `sourceBranch`: propose 开始时所在分支
- `developmentBranch`: 本次开发分支；`isolation = none` 时可为空
- `worktreePath`: worktree 绝对路径；仅 `isolation = worktree` 时存在

捕获发生在隔离动作之前，因为 worktree/branch 动作早于 `opsx:propose` 生成 change 目录。待 `opsx:propose` 生成 change 并确认真实 change 名后、propose 阶段 commit 前，命令 SHALL 把捕获的 metadata 写入 `.openspec.yaml`，并随 change artifacts 一起提交。`isolation = none` 时 SHALL 仍记录 `sourceBranch` 与 `isolation: none`，便于后续判断无需收尾。

若隔离动作成功但 change 生成失败，命令 SHALL 报告已创建的隔离环境状态，SHALL NOT 自动合并或删除。若 propose 开始时处于 detached HEAD，命令 SHALL 停止并要求用户切到命名分支后再运行。

#### Scenario: worktree 模式捕获后持久化完整 metadata
- **WHEN** 用户选择隔离 worktree，来源分支为 `main`，开发分支为 `feature/login`，worktree 路径为 `/Users/ly/.ly/worktrees/project/feature/login`
- **THEN** 命令在隔离前捕获这些值，并在 change 名确认后、propose commit 前把 `isolation: worktree`、`sourceBranch: main`、`developmentBranch: feature/login`、`worktreePath: /Users/ly/.ly/worktrees/project/feature/login` 写入 `.openspec.yaml`

#### Scenario: branch 模式记录来源和开发分支
- **WHEN** 用户选择本项目切新分支，来源分支为 `main`，开发分支为 `feature/login`
- **THEN** change metadata 记录 `isolation: branch`、`sourceBranch: main`、`developmentBranch: feature/login`，不记录 worktreePath

#### Scenario: none 模式记录无需收尾
- **WHEN** 用户选择留在当前分支
- **THEN** change metadata 记录 `isolation: none` 与 `sourceBranch`，后续 archive SHALL NOT 提示合并或清理

#### Scenario: 隔离成功但 change 生成失败
- **WHEN** 用户选择隔离 worktree 且 worktree 创建成功，但 `opsx:propose` 未生成 change
- **THEN** 命令报告已创建的 worktree 与分支，SHALL NOT 自动合并或删除

#### Scenario: 已在 worktree 内发起 propose
- **WHEN** 用户在某个 linked worktree 内运行 `/ly:propose`
- **THEN** 命令记录 `isolation: worktree`、当前分支为 `developmentBranch`、当前 worktree 为 `worktreePath`；若无法确定 `sourceBranch`，metadata 标记来源缺失，archive 阶段要求用户选择目标分支或跳过

#### Scenario: detached HEAD 下停止
- **WHEN** 用户在 detached HEAD 状态运行 `/ly:propose`
- **THEN** 命令停止并要求用户切到命名分支后再运行
