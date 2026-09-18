---
name: lyx-archive
description: '归档前先执行项目完整验证（测试/类型检查/构建），通过后按 opsx:archive 编排流程归档完成的 change，完成后 commit'
argument-hint: '[<change-name>]'
---

# Archive

> 调用方式：`@lyx-archive` mention 后跟随的自然语言即参数（如 `@lyx-archive` 带需求描述/选项）；无参数时直接 `@lyx-archive`。

按 `@openspec-archive-change skill`（opsx archive 编排 prompt）定义的流程归档指定 change（`参数` 未指定时按 opsx:archive 流程的默认规则确定目标）。

## 归档前完整验证（SHALL，先于任何归档动作）

在委托 OpenSpec 归档流程**之前**，对当前工作区执行一次项目完整验证，覆盖测试 / 类型检查 / 构建三类：

- 按项目实际提供的脚本选择（例如 `package.json` 的 `scripts.test` / `scripts.typecheck` / `scripts.build`，或项目 README/AGENTS.md 声明的等价命令）。
- 项目未提供的类别 SHALL 跳过并在报告中注明（例如"未提供 typecheck 脚本"），SHALL NOT 因缺失判定失败。
- 全部通过才继续；任一类别失败 SHALL 停止归档，**不移动** `openspec/changes/<change-name>/`，如实报告失败的脚本与原始错误输出。

该验证是慢验证的**唯一执行点**：审查关卡（`@lyx-review-plan` / `@lyx-review-code`）SHALL NOT 重复执行测试 / 类型检查 / 构建（`openspec validate` 仍由 review-plan 每轮执行，不属于本步范围）。

## 提交归档改动

归档会把 `openspec/changes/<change-name>/` 移动到 `openspec/changes/archive/`，并可能同步更新 `openspec/specs/`。提交涉及的全部文件：

```bash
MSG_FILE="$(git rev-parse --git-path COMMIT_EDITMSG)"
git add -- openspec/
# 先将完整 message 写入 "$MSG_FILE"：
# chore(openspec): 归档 <change-name>
#
# - 动机：完成 <change-name> 的归档收尾
# - 改动：移动 change 目录并同步 openspec/specs
# - 影响：归档后的 change 不再作为活跃 change
#
# Change-Stage: archive
# Change-Name: <change-name>
git commit -F "$MSG_FILE"
```

message 采用 Conventional Commits 前缀 + 正文 + trailer 结构：先用 `git rev-parse --git-path COMMIT_EDITMSG` 获取 message 路径并按 `@lyx-commit` 规范写入完整 message，CC 前缀固定 `chore(openspec)`，正文包含动机/改动/影响，末尾带 `Change-Stage: archive` 与 `Change-Name: <change-name>` trailer。

若无可提交内容或 `git commit` 失败，跳过提交，如实报告原始错误，不视为归档失败。

## 归档后分支收尾（archive commit 成功后）

archive 阶段 commit 成功后，读取归档后 change 目录下 `.openspec.yaml` 的 `lyx:` metadata，并执行分支收尾：

```yaml
lyx:
  isolation: worktree | branch | none
  sourceBranch: main | null
  developmentBranch: feature/xxx | null
  worktreePath: /abs/path | null
```

### 1. 判定是否需要收尾

- `isolation: none` 或缺失且当前无隔离状态：不提示。
- `isolation: branch`：提示“是否把 `<developmentBranch>` 合并到 `<sourceBranch>` 并删除开发分支？”
- `isolation: worktree`：提示“是否把 `<developmentBranch>` 合并到 `<sourceBranch>`，删除 worktree `<worktreePath>` 并删除开发分支？”
- `sourceBranch` 为 `null` / 空，或完全缺少 isolation metadata：进入保守路径，提示用户选择目标分支后继续，或跳过；SHALL NOT 默认猜 `main` / `master`。

### 2. 收尾前一致性校验

用户确认前先校验：

- `isolation: branch` 时，当前分支必须等于 `developmentBranch`。
- `isolation: worktree` 时，`worktreePath` 必须仍是注册的 linked worktree，且该 worktree checkout `developmentBranch`。
- `sourceBranch` 与 `developmentBranch` 必须存在。
- 开发 worktree 与 `sourceBranch` 所在 worktree 都必须干净。

任一校验失败：停止收尾，报告不一致项，保留 worktree 与开发分支，SHALL NOT 自动合并或删除。

### 3. 用户确认后的本地收尾

用户选择“是”后：

1. 用 `git worktree list --porcelain` 定位 `sourceBranch` 所在 worktree；若该分支未被任何 worktree checkout，则使用主 worktree 并切回 `sourceBranch`。
2. 在 `sourceBranch` 所在 worktree 执行 `git merge --no-ff <developmentBranch>`。
3. merge 成功后，若 `isolation: worktree`，从 `sourceBranch` 所在 worktree 执行 `git worktree remove <worktreePath>`。
4. worktree 删除成功后（或本就不需要删除 worktree），执行 `git branch -d <developmentBranch>`。
5. SHALL NOT 自动 `git push`；报告中明确“仅本地合并，未 push”。

失败保留现场规则：

- merge 冲突或失败：停止，保留 worktree 与开发分支。
- worktree 删除失败：停止，SHALL NOT 继续删除开发分支。
- 开发分支删除失败：报告失败原因，保留分支。

### 4. 旧 change 缺少 metadata

若 change 缺少 isolation metadata，可保守推导 `developmentBranch = 当前分支`、`worktreePath = 当前 linked worktree（若存在）`，但 `sourceBranch` 必须由用户选择。无法唯一判定当前分支或 worktree 时，跳过收尾并保留现场。
