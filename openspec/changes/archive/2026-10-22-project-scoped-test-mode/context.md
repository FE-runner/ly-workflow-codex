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
- 子模块按自身 `show-toplevel`；bare repository 的 linked worktree 没有主工作树根，回退当前 worktree 的 `show-toplevel`。
- 项目字段非法时回退宿主默认并让 doctor WARN；宿主配置整体不可读或 TOML 非法时停止测试相关动作。
- `init/update` 必须区分配置 missing/ok/invalid；任一所选宿主 invalid 时在任何写入前整体停止，避免默认配置覆盖项目表。
- CLI 目标配置需先全部预校验并检查规范化路径冲突；冲突或预检失败不写，任何多宿主写入中途失败时报告已完成项，不自动回滚或猜测性修复。
- `--unset` 目标是所有规范化等价原始键；逐项删测试模式，条目空则删条目，其他字段保留；仅完全无匹配键时幂等成功。

## 实施决策

- 配置读取新增 `HostConfigReadResult`（missing / ok / invalid）；`init/update` 在宿主选择后、任何写入前预检全部所选宿主，invalid 时整体停止。菜单配置入口同样拒绝覆盖 invalid 配置。
- `resolveProjectKey` 独立于 OpenSpec root 校验；实现覆盖 normal / separate-git-dir / submodule / linked worktree / bare worktree / 非 Git cwd。
- 非 bare linked worktree 的主工作树根优先读取 common git dir 的 `core.worktree`；缺失时只把 common dir 父目录下的候选 `.git` 视为主 checkout，且必须显式以 `--git-dir=<candidate>` 解析并确认结果等于当前 common git dir。`git init --separate-git-dir` 不写 `core.worktree`，且 `git worktree list` 不能反推主 checkout，因此无法确认时回退当前 worktree 根，不能猜 common dir 父目录。
- 项目解析保留原始键，按规范化等价键集合匹配；冲突或匹配条目非法时不采用项目覆盖，回退宿主默认并产生诊断。
- CAC 不支持 `project test-mode` 这种多 token 子命令直接挂 options，实际注册为 `project <action> [mode]` 并在 action 中只接受 `test-mode`；用户调用方式仍是 `lycx project test-mode`。
- 项目命令在写入前预校验全部目标；设置时 canonical 键可被覆盖，规范化等价别名键与目标值冲突则整体失败且不写；`--unset` 删除全部等价键中的 testMode。
- doctor/status 使用同一有效模式解析；doctor 输出宿主默认、有效值、来源、规范化路径和路径来源，项目结构/字段/冲突问题输出 WARN。
- 六个共享模板和四份审查角色词统一改为有效模式规则，覆盖的跳过状态明确标注项目来源。
- 当前有效 `testMode=off`，未新增或修改任何测试文件，也未运行测试命令；验证使用 smoke、静态检查、typecheck、build 与 OpenSpec validate。
