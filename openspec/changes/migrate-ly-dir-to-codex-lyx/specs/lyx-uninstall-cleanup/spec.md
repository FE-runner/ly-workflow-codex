## Purpose

定义 `lycx uninstall` 对 ly-workflow-codex 私有目录 `~/.codex/lyx/` 的清理策略：配置与角色词真正删除，`worktrees/` 子目录按是否存在存活的实际 git worktree 分别处理，避免裸删导致 git 元数据孤儿引用。

## ADDED Requirements

### Requirement: uninstall 真正删除 config.toml 与 prompts/

`lycx uninstall` SHALL 删除 `~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/`，不再采取"保守保留 + 警告"策略——该目录已是 ly-workflow-codex 私有产物，不存在"可能是别的工具的数据"的顾虑。删除前 SHALL NOT 询问用户二次确认（uninstall 命令本身的确认已在更早步骤完成）。

#### Scenario: 卸载时删除配置与角色词
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/` 存在
- **THEN** 两者均被删除，命令不输出"保留配置"类警告

#### Scenario: 配置或角色词本就不存在
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/config.toml` 或 `~/.codex/lyx/prompts/` 不存在
- **THEN** 命令跳过对应删除动作，不报错，汇总中如实说明"本就不存在，已跳过"

### Requirement: worktrees/ 子目录按存活 worktree 递归检测分别处理

`lycx uninstall` SHALL 在删除 `~/.codex/lyx/` 之前，递归检测 `~/.codex/lyx/worktrees/` 目录树下是否存在任何有效的 git worktree（worktree 实际路径可能是多层的，形如 `worktrees/<项目名>/<开发分支名>`，且 `<开发分支名>` 本身可能含 `/`；判定 SHALL 递归到目录树的叶子层，SHALL NOT 只检测第一层子目录——`<项目名>` 这层容器目录本身不是 git 仓库，仅检测第一层会把它误判为"非存活"）。对目录树中每个候选目录，SHALL 通过在该目录（或其内部任一目录）下执行 `git rev-parse --git-dir` 判断是否命中有效 git worktree（命令成功即视为该 worktree 存活）；判定不要求命令必须在"无子目录的最深层目录"执行——一个 worktree 根目录内部本身可能还有子目录/文件，只要在其目录树内任一处命中即可。

- 整棵 `worktrees/` 目录树下**不存在**任何有效 git worktree（含目录为空或不存在）→ SHALL 将 `worktrees/` 随 `config.toml`、`prompts/` 一并删除，即整个 `~/.codex/lyx/` 被删除。
- 整棵 `worktrees/` 目录树下**存在至少一个**有效 git worktree → SHALL 警告并跳过删除 `worktrees/`（config.toml 与 prompts/ 仍照常删除），提示用户先运行 `lycx worktree remove <name>` 清理后再自行删除 `~/.codex/lyx/`。
- 检测过程中发生异常（权限不足、目录读取失败等）→ SHALL 保守按"存在有效 worktree"处理（跳过删除该路径下的 worktrees/），SHALL NOT 冒险误删；异常信息 SHALL 在汇总中如实报告。

#### Scenario: worktrees/ 为空或不存在，整体清理
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/worktrees/` 不存在或为空目录
- **THEN** `~/.codex/lyx/` 整个目录（含 config.toml、prompts/、worktrees/）被删除

#### Scenario: worktrees/ 下存在一个单层有效 worktree
- **WHEN** `~/.codex/lyx/worktrees/my-project/fix-login` 是一个有效的 git worktree（`git rev-parse --git-dir` 成功），用户运行 `lycx uninstall`
- **THEN** `config.toml` 与 `prompts/` 被删除，`worktrees/` 整体保留，命令警告"检测到未清理的 worktree，请先运行 `lycx worktree remove` 清理"

#### Scenario: worktrees/ 下存在多层路径的有效 worktree
- **WHEN** `~/.codex/lyx/worktrees/my-project/feature/login` 是一个有效的 git worktree（开发分支名含 `/`），用户运行 `lycx uninstall`
- **THEN** 递归检测到该叶子层的有效 worktree，`worktrees/` 整体保留并警告；SHALL NOT 因第一层 `my-project` 目录本身不是 git 仓库而误判为可删除

#### Scenario: worktrees/ 下曾有 worktree 但已失效
- **WHEN** `~/.codex/lyx/worktrees/my-project/old-branch` 目录仍存在，但其关联的主仓库已被删除、`git rev-parse --git-dir` 在该目录下执行失败，用户运行 `lycx uninstall`
- **THEN** 该目录不被判定为有效 worktree；若整棵 `worktrees/` 目录树下无其他有效 worktree，`~/.codex/lyx/` 整体被删除

#### Scenario: 检测异常时保守保留
- **WHEN** 递归检测 `worktrees/` 目录树过程中因权限不足读取某子目录失败，用户运行 `lycx uninstall`
- **THEN** 命令按"存在有效 worktree"保守处理，跳过删除 `worktrees/`，并在汇总中如实报告该检测异常
