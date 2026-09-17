# lyx-uninstall-cleanup Specification

## Purpose

定义 `lycx uninstall` 对 ly-workflow-codex 私有目录 `~/.codex/lyx/` 的清理策略：私有目录（config.toml 与 prompts/）真正删除；worktree 目录因与 ly-workflow 共用（`~/.ly/worktrees/`）而 SHALL NOT 被卸载触碰。

## Requirements

### Requirement: uninstall 真正删除本包私有目录 config.toml 与 prompts/

`lycx uninstall` SHALL 删除 `~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/`（即整个 `~/.codex/lyx/` 目录），不再采取"保守保留 + 警告"策略——该目录已是 ly-workflow-codex 私有产物，不存在"可能是别的工具的数据"的顾虑。删除前 SHALL NOT 询问用户二次确认（uninstall 命令本身的确认已在更早步骤完成）。

#### Scenario: 卸载时删除配置与角色词
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/` 存在
- **THEN** 两者均被删除，命令不输出"保留配置"类警告

#### Scenario: 配置或角色词本就不存在
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/config.toml` 或 `~/.codex/lyx/prompts/` 不存在
- **THEN** 命令跳过对应删除动作，不报错，汇总中如实说明"本就不存在，已跳过"

### Requirement: uninstall 不触碰共享的 worktree 目录

`lycx uninstall` SHALL NOT 删除、移动或修改 `~/.ly/worktrees/`——该目录是 ly-workflow（双宿主）与 ly-workflow-codex 共用的 worktree 目录，里面可能存放两个项目各自未提交开发的真实 git worktree。本包的 worktree 目录沿用 `~/.ly/worktrees/<项目名>/` 这一共用位置，卸载本包 SHALL NOT 把它当作本包私有产物清理。

#### Scenario: 卸载时共享 worktree 目录原样保留
- **WHEN** 用户运行 `lycx uninstall`，`~/.ly/worktrees/` 下存在任意内容（例如 ly-workflow 或本包创建的 worktree）
- **THEN** 该目录及其内容被完整保留，命令不删除、不移动、不改动其中任何文件，也不输出"worktree 已清理"类提示

#### Scenario: 卸载只删除私有目录，不影响共享 worktree
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/`（config.toml + prompts/）与 `~/.ly/worktrees/` 同时存在
- **THEN** `~/.codex/lyx/` 被删除、`~/.ly/worktrees/` 原样保留——两者互不干扰，卸载边界以私有目录为界