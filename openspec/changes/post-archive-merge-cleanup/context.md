# post-archive-merge-cleanup Context

## 讨论结论

- `sourceBranch` 的定义已确认：propose 开始时当前所在分支。
- 用户确认 archive 收尾时选择“是”后，应同时删除 worktree（如有）和开发分支。
- metadata 使用 change 的 `.openspec.yaml`，放在 `lyx:` 命名空间下，随 change 归档移动。
- metadata 在隔离动作前只捕获到会话内存；change 名确认后、propose commit 前再写入 `.openspec.yaml`。
- archive 收尾提示发生在 archive 阶段 commit 成功之后；archive commit 失败或无提交时不清理。
- merge 使用 `git merge --no-ff`，只做本地合并，不自动 push。
- worktree 模式下不能在当前开发 linked worktree 里 checkout sourceBranch；必须先定位 sourceBranch 所在 worktree（通常是主 worktree）并在那里 merge、删除 worktree。
- 用户选择“否”时保留当前分支、worktree 和开发分支，只报告未执行收尾。
- 旧 change 没有 isolation metadata 时不猜 main/master，提示用户选择目标分支或跳过。
- 已在 worktree 内发起 propose 时记录当前开发分支与 worktree；若无法确定 sourceBranch，archive 阶段保守提示。
- detached HEAD 下 propose 直接停止，要求先切到命名分支。

## 已否决备选

- 从 git 当前状态反推 sourceBranch：否决。切换分支后无法可靠推断 propose 开始时所在分支。
- 默认合并到 main/master：否决。旧 change 或非 main 来源会产生错误合并。
- merge 后自动 push：否决。用户只要求本地合并与清理；push 风险应由用户显式决定。
- `git worktree remove --force` 强制删除：否决。可能丢失未跟踪文件，失败时保留现场更安全。
- 在开发 linked worktree 中直接 checkout sourceBranch：否决。sourceBranch 通常已被主 worktree 占用，git 会拒绝。

## 实现注意

- metadata 字段固定为 `isolation`、`sourceBranch`、`developmentBranch`、`worktreePath`；`worktreePath` 只在 worktree 模式存在。
- `isolation = none` 时只记录 `isolation: none` 与 `sourceBranch`，archive 不提示。
- 收尾前同时检查开发 worktree 与 sourceBranch 所在 worktree 是否干净。
- 清理顺序固定为：merge 成功 → 删除 worktree → 删除开发分支。worktree 删除失败时不得继续删除分支。
- 收尾命令应从 sourceBranch 所在 worktree 执行，尤其是 worktree 删除。

## 审查提示

- 重点检查 worktree 模式下 sourceBranch 的 checkout/merge 执行位置是否正确。
- 重点检查 archive commit 失败或无提交时是否不会触发清理。
- 重点检查旧 change 缺 metadata 时是否完全没有默认猜测 main/master 的行为。
- 重点检查失败路径是否都保留现场，尤其 merge 冲突与 worktree 删除失败。
