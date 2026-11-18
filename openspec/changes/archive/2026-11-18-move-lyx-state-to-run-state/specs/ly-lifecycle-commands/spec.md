## ADDED Requirements

### Requirement: 生命周期命令以 run-state 作为 lyx 状态源
新建 change 的 propose、apply、review-plan、review-code 与 archive SHALL 以 change 目录 `run-state.md` 的固定 YAML frontmatter 作为 lyx 状态来源。命令 SHALL NOT 从新 change 的 `.openspec.yaml` 读取 `lyx:` 或 `x-lyx:`，也 SHALL NOT 向该文件写入这些字段。

旧活跃 change 的 `.openspec.yaml lyx:` MAY 只读回退，但生命周期命令 SHALL NOT 自动迁移或改写旧字段。归档后的分支收尾 SHALL 从归档目录中的 run-state 读取新格式字段，确需兼容时才读取归档后的旧 `.openspec.yaml`。

#### Scenario: 新 change 生命周期只读 run-state
- **WHEN** 新 change 已由 propose 创建固定 frontmatter
- **THEN** apply/review/archive 从 run-state 读取测试模式与隔离信息，不检查 `.openspec.yaml` 是否存在 lyx 字段

#### Scenario: 旧 change 不被自动迁移
- **WHEN** 生命周期命令处理一个只有旧 `.openspec.yaml lyx:` 的活跃 change
- **THEN** 命令按兼容规则只读旧值，不向 `.openspec.yaml` 写回，也不批量复制旧字段

## MODIFIED Requirements

### Requirement: archive 归档提交后进入分支收尾流程

`/ly:archive` SHALL 在归档提交成功完成后调用 `archive-branch-cleanup` 能力定义的收尾流程。该流程 SHALL 在归档提交之后执行，确保 archive commit 已存在于当前开发分支上，随后才提示合并、删除 worktree 或删除开发分支。

若归档提交失败或无归档改动可提交，命令 SHALL 如实报告，并 SHALL NOT 继续执行合并或清理。

#### Scenario: 归档提交成功后提示收尾
- **WHEN** `/ly:archive <change-name>` 完成归档并成功提交 archive 阶段 commit
- **THEN** 命令从归档后 `run-state.md` 读取 isolation metadata（旧 change 可只读回退 `.openspec.yaml`），并按 `archive-branch-cleanup` 规则提示是否合并回 `sourceBranch` 并清理 worktree/开发分支

#### Scenario: 归档提交失败不清理
- **WHEN** `/ly:archive <change-name>` 归档提交失败
- **THEN** 命令报告失败，SHALL NOT 执行合并、删除 worktree 或删除开发分支
