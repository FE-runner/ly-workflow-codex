# 方案软上下文

## 已确认决策

- 项目配置放在每个宿主既有的 `lyx/config.toml` 中，使用路径键 `[projects."<project-root>"]`，不创建项目级独立配置文件。
- 项目身份按主仓库根；普通仓库子目录归一到仓库根，linked worktree 归一到主工作树根。用户在探索阶段明确选择“按推荐”。
- 当前项目只扩展 `testMode`，不把执行者、模型、`reviewMode` 等字段项目化。
- `[host].testMode` 保留为宿主默认值；优先级为项目覆盖 > 宿主默认 > `normal`。
- 当前 Codex 有效 `testMode=off`，因此本 change 不生成测试文件、测试任务或测试命令任务。验证限定手工 smoke、`rg` 静态检查、typecheck、build 与 OpenSpec 校验。

## 否决方案

- 项目根独立 `lyx/config.toml`：用户明确要求在宿主配置内用 path 区分。
- `[[projects]]` 数组结构：不采用；使用带引号路径键的 TOML 表更直接。
- 继续用 `git rev-parse --show-toplevel` 作为唯一项目键：会让每个 linked worktree 独立，违背已确认的主仓库根语义。
- 在 `lycx init` / 菜单中隐式写当前项目覆盖：会把全局安装与当前项目策略混合；项目覆盖由独立命令管理。

## 范围边界

- 做：配置类型与保留、项目路径解析、有效值解析、`lycx project test-mode`、doctor/status、六模板、四角色词、文档。
- 不做：项目级其他配置、命令级单次覆盖、环境变量覆盖、历史路径键自动迁移、跨进程配置写锁。

## 已知坑与注意

- `lycx init` 当前通过 `createDefaultConfig` 重建配置；必须显式传入既有 `projects`，否则重装会丢项目表。
- `resolveProjectRoot` 在 `src/utils/preflight.ts` 中服务 OpenSpec root 校验，仍返回当前 checkout 的 `show-toplevel`；测试模式项目键必须使用独立解析，不能直接复用。
- 普通仓库可能使用 separate-git-dir；这类 checkout 的 `git-dir == git-common-dir`，应使用 `show-toplevel`，不能一律取 common dir 父目录。
- 项目字段非法时回退宿主默认并让 doctor WARN；宿主配置整体不可读或 TOML 非法时停止测试相关动作。
- CLI 目标配置需先全部预校验；多宿主写入中途失败时报告已完成项，不自动回滚或猜测性修复。
