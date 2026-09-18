## Why

当前 `/ly:propose` 能从当前分支 HEAD 切出 worktree 或开发分支，但归档完成后不会提示把开发分支合回来源分支，也不会清理 worktree。结果是 change 已归档，代码却仍停留在隔离分支；用户需要手动回忆来源分支并执行合并、worktree 删除和分支删除。需要在 propose 阶段记录隔离元数据，并在 archive 提交完成后提供安全的本地收尾提示。

## What Changes

- `/ly:propose` 在创建 worktree 或切新分支前记录 isolation metadata：`isolation`、`sourceBranch`、`developmentBranch`、`worktreePath`。
- `/ly:archive` 在归档提交完成后检测 isolation metadata 与当前分支/ worktree 状态。
- `isolation = none` 时不提示；`branch` 时提示是否合并开发分支到 `sourceBranch` 并删除开发分支；`worktree` 时提示是否合并、删除 worktree 并删除开发分支。
- 用户选择“是”时执行本地收尾：工作区干净 → 切回 `sourceBranch` → `git merge --no-ff <developmentBranch>` → 成功后删除 worktree（如有）→ 删除开发分支。
- 不自动 push；merge 冲突、目标分支脏、worktree 删除失败等情况停止并保留现场。
- 未记录 isolation metadata 的旧 change 不猜测目标分支；提示用户选择目标分支或跳过自动收尾。
- 更新 propose / archive / worktree 模板与测试，固定 metadata 字段和安全失败路径。

## Capabilities

### New Capabilities

- `archive-branch-cleanup`: 定义归档提交完成后的来源分支合并、worktree 清理与开发分支删除行为。

### Modified Capabilities

- `worktree-create-before-propose`: 创建 worktree 或开发分支前记录 sourceBranch / developmentBranch / worktreePath 等 isolation metadata。
- `ly-lifecycle-commands`: `/ly:archive` 在归档提交完成后进入 post-archive merge cleanup 流程。

## Impact

- 模板：`templates/skills-codex/propose.md`、`archive.md`、`worktree.md`
- Specs：新增 `archive-branch-cleanup`；更新 `worktree-create-before-propose`、`ly-lifecycle-commands`
- 测试：`src/utils/__tests__/host-adapters.test.ts` 增加模板断言
- 兼容性：未记录 metadata 的旧 change 不自动合并，只提示或跳过；不改变现有 propose/apply/review 提交流程
