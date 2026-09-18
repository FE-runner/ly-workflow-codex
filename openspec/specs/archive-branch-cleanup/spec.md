# archive-branch-cleanup Specification

## Purpose
让归档完成后的 change 能安全地合并回 propose 开始时记录的来源分支，并按用户确认清理 worktree 与开发分支，避免代码归档后仍滞留在隔离分支。

## Requirements

### Requirement: 归档提交后检测隔离状态并提示分支收尾

`@lyx-archive` 在归档提交完成后 SHALL 读取该 change 的 isolation metadata，并根据 `isolation` 取值决定是否提示分支收尾：

- `none`：不提示合并或清理。
- `branch`：提示用户是否把 `developmentBranch` 合并回 `sourceBranch` 并删除 `developmentBranch`。
- `worktree`：提示用户是否把 `developmentBranch` 合并回 `sourceBranch`，删除 `worktreePath` 对应的 worktree，并删除 `developmentBranch`。

提示 SHALL 明确展示 `sourceBranch`、`developmentBranch` 和（worktree 模式下的）worktree 路径。用户选择“否”或取消时，SHALL 保留当前分支、worktree 与开发分支，不做合并、不删除任何内容。

在展示提示前，命令 SHALL 校验 metadata 与实际 Git 状态一致：worktree 模式下的 `worktreePath` 必须仍注册为 linked worktree，该 worktree 必须 checkout `developmentBranch`，当前执行环境必须能定位到该开发分支或 worktree；branch 模式下当前分支必须等于 `developmentBranch`。任一不一致时，命令 SHALL 停止自动收尾并报告不一致项，要求用户复核。

`isolation != none` 且 `sourceBranch` 缺失（`null` 或空值）时，命令 SHALL 进入保守路径：提示用户选择目标分支后继续收尾，或跳过收尾；SHALL NOT 默认选择 `main` / `master`。

#### Scenario: worktree 模式提示合并和清理
- **WHEN** 归档完成后读取到 `isolation: worktree`、`sourceBranch: main`、`developmentBranch: feature/login`、`worktreePath: /Users/ly/.ly/worktrees/project/feature/login`
- **THEN** 命令提示是否把 `feature/login` 合并到 `main`，并删除该 worktree 与开发分支

#### Scenario: branch 模式只提示合并和删除分支
- **WHEN** 归档完成后读取到 `isolation: branch`、`sourceBranch: main`、`developmentBranch: feature/login`
- **THEN** 命令提示是否把 `feature/login` 合并到 `main` 并删除 `feature/login`，SHALL NOT 尝试删除 worktree

#### Scenario: none 模式不提示
- **WHEN** 归档完成后读取到 `isolation: none`
- **THEN** 命令不出现合并或清理提示

#### Scenario: 用户拒绝收尾
- **WHEN** 命令提示后用户选择“否”
- **THEN** 当前分支、worktree 与开发分支保持原状，命令只报告未执行收尾

#### Scenario: metadata 与实际状态不一致时停止
- **WHEN** metadata 记录 `worktreePath: /tmp/old`，但该路径已不是注册的 linked worktree
- **THEN** 命令停止自动收尾并报告不一致，不执行 merge、不删除 worktree 或分支

#### Scenario: branch 模式当前分支不匹配时停止
- **WHEN** metadata 记录 `isolation: branch`、`developmentBranch: feature/login`，但当前分支为 `feature/other`
- **THEN** 命令停止自动收尾并报告当前分支不匹配

### Requirement: 用户确认后执行本地合并与清理

用户在归档后收尾提示中选择“是”时，命令 SHALL 执行本地合并与清理：

1. 校验开发分支 worktree 与 `sourceBranch` 所在 worktree 都干净；任一不干净则停止。
2. 校验 `sourceBranch` 与 `developmentBranch` 均存在。
3. 定位 `sourceBranch` 所在 worktree；若该分支未被任何 worktree checkout，则使用主 worktree 并切回 `sourceBranch`。
4. 在 `sourceBranch` 所在 worktree 中执行 `git merge --no-ff <developmentBranch>`。
5. 合并成功后，若 `isolation = worktree`，删除 `worktreePath` 对应的 worktree。
6. 删除 `developmentBranch`。

命令 SHALL NOT 自动 push 到远端。收尾成功后，报告合并结果、已删除的 worktree（如有）和已删除的开发分支。

#### Scenario: worktree 模式收尾成功
- **WHEN** 用户确认收尾，当前工作区干净，`sourceBranch` 与 `developmentBranch` 均存在，merge 成功
- **THEN** 命令在 `sourceBranch` 所在 worktree 中以 `--no-ff` 合并 `developmentBranch`，删除开发 worktree，再删除 `developmentBranch`

#### Scenario: sourceBranch 在主 worktree 中执行合并
- **WHEN** `isolation = worktree`，当前目录是开发分支的 linked worktree，`sourceBranch` 已在主 worktree checkout
- **THEN** 命令 SHALL NOT 在当前 linked worktree 中 `checkout sourceBranch`；它 SHALL 定位主 worktree，并在那里执行 merge 和 worktree 删除

#### Scenario: branch 模式收尾成功
- **WHEN** 用户确认收尾，`isolation = branch`，merge 成功
- **THEN** 命令切回 `sourceBranch`，以 `--no-ff` 合并 `developmentBranch`，并删除 `developmentBranch`，不执行 worktree 删除

#### Scenario: 收尾不自动 push
- **WHEN** 本地合并与清理成功
- **THEN** 命令 SHALL NOT 执行 `git push`，只在报告中提示需要时由用户手动推送

### Requirement: 收尾失败时保留现场

归档后收尾任一步骤失败时，命令 SHALL 停止后续步骤并保留现场，SHALL NOT 强制删除 worktree、SHALL NOT 强制删除开发分支、SHALL NOT 猜测性继续合并。

失败情形至少包括：

- 当前工作区不干净；
- `sourceBranch` 所在 worktree 有未提交改动；
- `sourceBranch` 或 `developmentBranch` 不存在；
- 切回 `sourceBranch` 失败；
- merge 冲突或 merge 命令失败；
- worktree 删除失败；
- 开发分支删除失败。

#### Scenario: merge 冲突停止清理
- **WHEN** 用户确认收尾后执行 merge 产生冲突
- **THEN** 命令停止，保留 worktree 与 `developmentBranch`，报告冲突文件与需人工处理的提示

#### Scenario: worktree 删除失败不删分支
- **WHEN** merge 成功但 `git worktree remove` 失败
- **THEN** 命令保留 `developmentBranch`，报告 worktree 删除失败原因，SHALL NOT 继续删除分支

#### Scenario: 目标分支不存在
- **WHEN** isolation metadata 中的 `sourceBranch` 已不存在
- **THEN** 命令停止收尾，报告缺失的分支名，保留 worktree 与开发分支

### Requirement: 旧 change 缺少 isolation metadata 时不猜测目标分支

归档完成后若 change 缺少 isolation metadata，命令 SHALL NOT 猜测 `sourceBranch` 或自动执行 merge/删除。命令 SHALL 提示当前处于非 `none` 隔离状态但缺少来源分支信息，并允许用户选择目标分支后继续收尾，或跳过收尾。可保守推导 `developmentBranch = 当前分支`、`worktreePath = 当前 linked worktree（若存在）`；若无法唯一判定，则跳过收尾并保留现场。

#### Scenario: 旧 change 无 metadata 时提示选择
- **WHEN** 归档完成后当前分支不是主工作区分支，但 change 没有 isolation metadata
- **THEN** 命令提示用户选择要合并回的目标分支，或跳过自动收尾；SHALL NOT 默认选择 `main` / `master`

#### Scenario: 用户选择跳过旧 change 收尾
- **WHEN** 旧 change 缺少 metadata，用户在提示中选择跳过
- **THEN** 命令不做任何 merge 或删除，只报告当前分支与 worktree 状态

#### Scenario: 旧 change 可保守推导开发分支
- **WHEN** 旧 change 缺少 metadata，当前处于 linked worktree 且当前分支为 `feature/legacy`
- **THEN** 命令可把 `feature/legacy` 作为 `developmentBranch` 候选展示给用户，但仍要求用户选择 `sourceBranch` 后才执行 merge

#### Scenario: metadata 存在但 sourceBranch 缺失
- **WHEN** metadata 记录 `isolation: worktree`，但 `sourceBranch` 为 `null` 或空值
- **THEN** 命令进入保守路径，提示用户选择目标分支或跳过，SHALL NOT 自动合并
