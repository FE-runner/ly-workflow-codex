## REMOVED Requirements

### Requirement: 归档提交后检测隔离状态并提示分支收尾
**Reason**: 原流程从 run-state 读取 isolation，账本已删除。
**Migration**: 改为从当前会话、`context.md` 和当前 Git 状态推导候选；信息不足时询问或跳过。

### Requirement: 旧 change 缺少 isolation metadata 时不猜测目标分支
**Reason**: 新流程不再用 run-state/旧 `.openspec.yaml` metadata 作为首选来源。
**Migration**: 所有缺少足够上下文的 change 统一进入保守路径，由用户选择目标分支或跳过。

## ADDED Requirements

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
