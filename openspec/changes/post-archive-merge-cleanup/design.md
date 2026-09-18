## Context

见 proposal.md 的 Why。现有 `/ly:propose` 的隔离分支来自“当前分支 HEAD”，但该来源分支没有写入任何持久 metadata；`/ly:archive` 完成后只提交归档改动，无法判断是否应该合并回来源分支。实现必须先把来源分支变成可读取数据，再让 archive 在提交完成后执行安全收尾。

## Goals / Non-Goals

**Goals:**

- 在 propose 阶段记录可随 change 归档移动的 isolation metadata。
- 在 archive 阶段提交完成后，按 metadata 提示并执行本地合并、worktree 删除、开发分支删除。
- 失败时保留现场，避免半合并、半清理或误删 worktree。
- 对旧 change 缺少 metadata 的情况给出保守路径。

**Non-Goals:**

- 不自动 push 到远端。
- 不强制删除 dirty worktree，不使用 `git worktree remove --force`。
- 不自动解决 merge 冲突。
- 不改变 propose 的隔离方式选择、apply/review 流水线或 archive 前验证关卡。

## Decisions

### 1. isolation metadata 先捕获，change 名确认后写入 `.openspec.yaml`

propose 开始时先捕获到会话内存：

```yaml
lyx:
  isolation: worktree
  sourceBranch: main
  developmentBranch: feature/xxx
  worktreePath: /Users/ly/.ly/worktrees/project/feature/xxx
```

`branch` 模式不写 `worktreePath`；`none` 模式只写 `isolation: none` 与 `sourceBranch`。

在 `opsx:propose` 生成 change 并确认真实 change 名之后、propose commit 之前，才把上述 metadata 写入 `openspec/changes/<change-name>/.openspec.yaml`。理由：worktree/branch 隔离动作早于 change 目录生成，此时没有可写的 `.openspec.yaml`；若隔离动作成功但 change 生成失败，命令只报告隔离环境状态，不自动清理。

### 2. sourceBranch 在隔离动作之前捕获

`sourceBranch` SHALL 是 propose 开始时所在分支，必须在 `git worktree add` 或 `git checkout -b` 之前读取。理由：一旦切到开发分支，当前分支已不再是目标分支；事后无法可靠推断。

若 propose 开始时已在某个 linked worktree 内，命令捕获当前分支为 `developmentBranch`、当前 worktree 为 `worktreePath`，并把 `sourceBranch` 记录为 `null`；archive 阶段走保守提示，要求用户选择目标分支或跳过。若 propose 开始时处于 detached HEAD，命令 SHALL 停止并要求用户切到命名分支后再运行。

### 3. archive 提交完成后执行收尾

收尾流程 SHALL 在 archive 阶段 commit 成功之后运行。若归档提交失败或无归档改动可提交，则不执行任何 merge/删除。理由：archive commit 本身属于 change 生命周期的一部分，必须随开发分支一起合回目标分支。

### 4. 合并使用 `git merge --no-ff`

用户确认收尾后，命令切回 `sourceBranch`，执行 `git merge --no-ff <developmentBranch>`。理由：保留 change 的合并边界，便于回溯；若 merge 冲突则停止，不自动解冲突。

### 5. 清理顺序：先删 worktree，再删开发分支

worktree 模式成功 merge 后，先删除 `worktreePath`，再删除 `developmentBranch`。若 worktree 删除失败，则不继续删除分支。理由：worktree 仍可能持有该分支；先删分支会造成状态更混乱。

执行位置 SHALL 是 `sourceBranch` 所在 worktree，而不是当前开发 worktree。原因：linked worktree 中通常无法 checkout 已被主 worktree 占用的 `sourceBranch`。若 `sourceBranch` 未被任何 worktree checkout，则使用主 worktree 并 checkout 该分支。worktree 删除也必须从 `sourceBranch` 所在主 worktree 执行。

### 6. 旧 change 不猜测来源分支

缺少 isolation metadata 时，不默认合并到 `main` / `master`。命令提示用户选择目标分支后继续，或跳过自动收尾。理由：旧 change 没有可靠来源信息，猜测会带来错误合并风险。

缺 metadata 时可保守推导 `developmentBranch = 当前分支`、`worktreePath = 当前 linked worktree（若存在）`；`sourceBranch` 必须由用户选择。若当前分支或 worktree 状态无法唯一判定，跳过收尾并保留现场。

`isolation != none` 但 `sourceBranch` 为 `null` / 空值时，也走同一保守路径。`isolation = branch` 时当前分支必须等于 `developmentBranch`，否则停止并要求人工复核。

## Risks / Trade-offs

- [`.openspec.yaml` 增加未知字段可能受未来 OpenSpec schema 影响] → 使用 `lyx:` 命名空间隔离；任务中保留 `openspec validate` 验证。
- [worktree 存在未跟踪文件导致删除失败] → 不强制删除，报告失败并保留现场。
- [sourceBranch 已被其他 worktree 占用] → 切回失败即停止，不做替代 checkout 或强制切换。
- [sourceBranch 所在 worktree 有未提交改动] → 收尾前同时检查开发 worktree 与目标 worktree，任一 dirty 即停止。
- [metadata 与实际 Git 状态不一致] → 收尾提示前校验 worktree 注册状态、开发分支和当前执行环境，不一致即停止并要求复核。
- [propose 在 detached HEAD 下启动] → 停止并要求用户切到命名分支后再运行，避免记录无意义 sourceBranch。
- [merge 后不 push 可能被误认为已完成远端同步] → 成功报告中明确“仅本地合并，未 push”。
