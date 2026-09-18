## ADDED Requirements

### Requirement: archive 归档提交后进入分支收尾流程

`/ly:archive` SHALL 在归档提交成功完成后调用 `archive-branch-cleanup` 能力定义的收尾流程。该流程 SHALL 在归档提交之后执行，确保 archive commit 已存在于当前开发分支上，随后才提示合并、删除 worktree 或删除开发分支。

若归档提交失败或无归档改动可提交，命令 SHALL 如实报告，并 SHALL NOT 继续执行合并或清理。

#### Scenario: 归档提交成功后提示收尾
- **WHEN** `/ly:archive <change-name>` 完成归档并成功提交 archive 阶段 commit
- **THEN** 命令读取 isolation metadata，并按 `archive-branch-cleanup` 规则提示是否合并回 `sourceBranch` 并清理 worktree/开发分支

#### Scenario: 归档提交失败不清理
- **WHEN** `/ly:archive <change-name>` 归档提交失败
- **THEN** 命令报告失败，SHALL NOT 执行合并、删除 worktree 或删除开发分支
