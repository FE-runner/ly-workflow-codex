# archive-branch-cleanup Specification

## Purpose
让归档完成后的 change 能安全地合并回 propose 开始时记录的来源分支，并按用户确认清理 worktree 与开发分支，避免代码归档后仍滞留在隔离分支。

## Requirements

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

### Requirement: 分支收尾从会话与 context 推导
`@lyx-archive` 在 archive commit 成功后 SHALL 优先使用当前会话仍保留的 propose 隔离选择；新回合 SHALL 读取归档后的 `context.md` `## 执行上下文` 和当前 Git 状态。命令 SHALL 校验开发分支、当前 worktree、来源分支候选与实际状态一致，再展示合并/清理确认。`context.md` 明确 `isolation: none` 时 SHALL 不提示自动清理；信息缺失或冲突时 SHALL 询问目标分支或跳过，SHALL NOT 默认选择 `main` / `master`。

#### Scenario: 同一会话保留来源分支
- **WHEN** 用户在同一会话完成 propose 与 archive，来源分支为 `main`
- **THEN** archive 使用会话中的来源分支，校验 Git 后提示合并与清理

#### Scenario: 新会话读取 context
- **WHEN** 新会话 archive 一个 change，`context.md` 记录来源分支和开发分支
- **THEN** 命令以该人类可读记录作为候选，经 Git 校验后提示

#### Scenario: context 记录无需收尾
- **WHEN** `context.md` 记录 `isolation: none`
- **THEN** 命令不出现自动 merge 或清理提示

#### Scenario: 信息不足
- **WHEN** 会话和 `context.md` 都没有来源分支
- **THEN** 命令要求用户选择目标分支或跳过收尾

### Requirement: 缺少上下文时保留现场
归档后无法唯一识别开发分支、来源分支或 worktree 时，命令 SHALL 报告当前分支与 `git worktree list --porcelain` 结果，允许用户选择目标分支后继续，或跳过整个收尾。SHALL NOT 自动 merge、删除 worktree、删除分支或通过名称猜测来源。

#### Scenario: 用户跳过
- **WHEN** 命令无法唯一确定来源分支，用户选择跳过
- **THEN** 不执行任何 Git 写操作，只报告当前状态

#### Scenario: 用户选择目标分支
- **WHEN** 用户从现有分支中选择目标分支
- **THEN** 命令执行原有工作区干净、分支存在和 worktree 定位校验后才允许确认合并
