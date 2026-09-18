## ADDED Requirements

### Requirement: propose 创建隔离时记录 isolation metadata

`/ly:propose` SHALL 在创建 worktree 或切新分支前，把本次隔离信息记录到 change 可持久读取的 metadata 中，至少包含：

- `isolation`: `worktree` / `branch` / `none`
- `sourceBranch`: propose 开始时所在分支
- `developmentBranch`: 本次开发分支；`isolation = none` 时可为空
- `worktreePath`: worktree 绝对路径；仅 `isolation = worktree` 时存在

metadata SHALL 在 propose 阶段 commit 前写入，并随 change artifacts 一起提交。`isolation = none` 时 SHALL 仍记录 `sourceBranch` 与 `isolation: none`，便于后续判断无需收尾。

#### Scenario: worktree 模式记录完整 metadata
- **WHEN** 用户选择隔离 worktree，来源分支为 `main`，开发分支为 `feature/login`，worktree 路径为 `/Users/ly/.ly/worktrees/project/feature/login`
- **THEN** change metadata 记录 `isolation: worktree`、`sourceBranch: main`、`developmentBranch: feature/login`、`worktreePath: /Users/ly/.ly/worktrees/project/feature/login`

#### Scenario: branch 模式记录来源和开发分支
- **WHEN** 用户选择本项目切新分支，来源分支为 `main`，开发分支为 `feature/login`
- **THEN** change metadata 记录 `isolation: branch`、`sourceBranch: main`、`developmentBranch: feature/login`，不记录 worktreePath

#### Scenario: none 模式记录无需收尾
- **WHEN** 用户选择留在当前分支
- **THEN** change metadata 记录 `isolation: none` 与 `sourceBranch`，后续 archive SHALL NOT 提示合并或清理
