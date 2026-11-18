## MODIFIED Requirements

### Requirement: 归档提交后检测隔离状态并提示分支收尾

`@lyx-archive` 在归档提交完成后 SHALL 从归档后 change 目录的 `run-state.md` 固定 frontmatter 读取 isolation metadata，并根据 `isolation` 取值决定是否提示分支收尾。run-state 缺少必要字段且目标 change 属于旧格式时，MAY 只读回退归档后 `.openspec.yaml` 的 `lyx:` metadata；SHALL NOT 改写该文件。

- `none`：不提示合并或清理。
- `branch`：提示用户是否把 `developmentBranch` 合并回 `sourceBranch` 并删除 `developmentBranch`。
- `worktree`：提示用户是否把 `developmentBranch` 合并回 `sourceBranch`，删除 `worktreePath` 对应的 worktree，并删除 `developmentBranch`。

提示 SHALL 明确展示 `sourceBranch`、`developmentBranch` 和（worktree 模式下的）worktree 路径。用户选择“否”或取消时，SHALL 保留当前分支、worktree 与开发分支，不做合并、不删除任何内容。

在展示提示前，命令 SHALL 校验 metadata 与实际 Git 状态一致：worktree 模式下的 `worktreePath` 必须仍注册为 linked worktree，该 worktree 必须 checkout `developmentBranch`，当前执行环境必须能定位到该开发分支或 worktree；branch 模式下当前分支必须等于 `developmentBranch`。任一不一致时，命令 SHALL 停止自动收尾并报告不一致项，要求用户复核。

`isolation != none` 且 `sourceBranch` 缺失（`null` 或空值）时，命令 SHALL 进入保守路径：提示用户选择目标分支后继续收尾，或跳过收尾；SHALL NOT 默认选择 `main` / `master`。

#### Scenario: worktree 模式提示合并和清理
- **WHEN** 归档完成后 run-state 记录 `isolation: worktree`、`sourceBranch: main`、`developmentBranch: feature/login`、`worktreePath: /Users/ly/.ly/worktrees/project/feature/login`
- **THEN** 命令提示是否把 `feature/login` 合并到 `main`，并删除该 worktree 与开发分支

#### Scenario: branch 模式只提示合并和删除分支
- **WHEN** 归档完成后 run-state 记录 `isolation: branch`、`sourceBranch: main`、`developmentBranch: feature/login`
- **THEN** 命令提示是否把 `feature/login` 合并到 `main` 并删除 `feature/login`，SHALL NOT 尝试删除 worktree

#### Scenario: none 模式不提示
- **WHEN** 归档完成后 run-state 记录 `isolation: none`
- **THEN** 命令不出现合并或清理提示

#### Scenario: 用户拒绝收尾
- **WHEN** 命令提示后用户选择“否”
- **THEN** 当前分支、worktree 与开发分支保持原状，命令只报告未执行收尾

#### Scenario: metadata 与实际状态不一致时停止
- **WHEN** run-state 记录 `worktreePath: /tmp/old`，但该路径已不是注册的 linked worktree
- **THEN** 命令停止自动收尾并报告不一致，不执行 merge、不删除 worktree 或分支

#### Scenario: branch 模式当前分支不匹配时停止
- **WHEN** run-state 记录 `isolation: branch`、`developmentBranch: feature/login`，但当前分支为 `feature/other`
- **THEN** 命令停止自动收尾并报告当前分支不匹配

#### Scenario: 旧 change 回退读取 .openspec.yaml
- **WHEN** 归档后的旧 change 在 run-state 中没有 isolation 固定字段，但 `.openspec.yaml` 保存旧 `lyx` metadata
- **THEN** 命令只读使用旧值执行同样的校验与收尾决策，不改写 `.openspec.yaml`

### Requirement: 旧 change 缺少 isolation metadata 时不猜测目标分支

归档完成后若 run-state 与旧 `.openspec.yaml` 均缺少 isolation metadata，命令 SHALL NOT 猜测 `sourceBranch` 或自动执行 merge/删除。命令 SHALL 提示当前处于非 `none` 隔离状态但缺少来源分支信息，并允许用户选择目标分支后继续收尾，或跳过收尾。可保守推导 `developmentBranch = 当前分支`、`worktreePath = 当前 linked worktree（若存在）`；若无法唯一判定，则跳过收尾并保留现场。

#### Scenario: 旧 change 无 metadata 时提示选择
- **WHEN** 归档完成后当前分支不是主工作区分支，但 change 的 run-state 与 `.openspec.yaml` 都没有 isolation metadata
- **THEN** 命令提示用户选择要合并回的目标分支，或跳过自动收尾；SHALL NOT 默认选择 `main` / `master`

#### Scenario: 用户选择跳过旧 change 收尾
- **WHEN** 旧 change 缺少 metadata，用户在提示中选择跳过
- **THEN** 命令不做任何 merge 或删除，只报告当前分支与 worktree 状态

#### Scenario: 旧 change 可保守推导开发分支
- **WHEN** 旧 change 缺少 metadata，当前处于 linked worktree 且当前分支为 `feature/legacy`
- **THEN** 命令可把 `feature/legacy` 作为 `developmentBranch` 候选展示给用户，但仍要求用户选择 `sourceBranch` 后才执行 merge

#### Scenario: metadata 存在但 sourceBranch 缺失
- **WHEN** run-state 或旧 `.openspec.yaml` 记录 `isolation: worktree`，但 `sourceBranch` 为 `null` 或空值
- **THEN** 命令进入保守路径，提示用户选择目标分支或跳过，SHALL NOT 自动合并
