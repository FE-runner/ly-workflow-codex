## ADDED Requirements

### Requirement: 隔离 worktree 选项在无提交仓库中不可用

`@lyx-propose` 在呈现隔离方式三选一之前 SHALL 执行 `git rev-parse --verify HEAD >/dev/null 2>&1`；无提交（unborn branch）时 SHALL 禁用"隔离 worktree"选项（或显式标注不可用），并在提示中说明需先创建 baseline commit 及恢复路径，SHALL NOT 把必然失败的选项当作可用选项呈现。SHALL NOT 因此禁用"本项目切新分支"与"留在当前分支"。

#### Scenario: unborn branch 禁用隔离 worktree

- **WHEN** 当前仓库 `git rev-parse --verify HEAD` 失败（尚无任何提交），用户运行 `@lyx-propose`
- **THEN** 隔离方式提示中"隔离 worktree"标注不可用并说明需先创建 baseline commit；其余两项可选

#### Scenario: 有提交时三项均可选

- **WHEN** 仓库存在 HEAD commit，用户运行 `@lyx-propose`
- **THEN** 隔离 worktree / 切新分支 / 留在当前分支三项均可选

### Requirement: WIP commit 文案按隔离路径区分

工作区存在未提交改动、且用户选择 WIP commit 时，提交首行 SHALL 按路径取值：切新分支路径用 `chore(wip): 切分支前暂存工作区改动`；留在当前分支路径用 `chore: 暂存工作区改动`。暂存命令、进行中快照排除与"暂存区仍为空则跳过提交"的容错 SHALL 与既有规则一致。

#### Scenario: 留在当前分支的 WIP 文案

- **WHEN** 用户选择"留在当前分支"且工作区有未提交改动，并选择 WIP commit
- **THEN** 提交首行为 `chore: 暂存工作区改动`，SHALL NOT 出现"切分支前"

#### Scenario: 切新分支的 WIP 文案不变

- **WHEN** 用户选择"本项目切新分支"且工作区有未提交改动，并选择 WIP commit
- **THEN** 提交首行沿用 `chore(wip): 切分支前暂存工作区改动`
