## Purpose

installer 多宿主适配器契约：将"装到哪个 AI CLI 宿主"的差异化（安装目标路径、模板形态渲染、卸载清单）收敛为 HostAdapter 接口，使新增宿主成为注册一个适配器而非修改安装流程。首期实现 claude（现有行为收敛）与 codex（新增单 Agent 模式）两个适配器。

## ADDED Requirements

### Requirement: HostAdapter 接口与注册
安装器必须（SHALL）以 HostAdapter 接口表达宿主差异，接口至少包含：宿主标识（host id）、命令模板安装目标（promptsTarget）、模板渲染规则（renderTemplate——宿主可追加宿主专属变量/占位处理）、卸载清单（uninstallList）。claude 与 codex 两个适配器必须（SHALL）注册于统一注册表；新增宿主必须（SHALL）通过注册新适配器接入，SHALL NOT 在安装主流程中写宿主 if/else 分支。

#### Scenario: 现有 claude 安装行为收敛后不变
- **WHEN** 用户选择仅 claude 宿主运行 init
- **THEN** 安装产物、目标路径（~/.claude/commands/ly/ 等）与渲染结果与 v2.x 完全一致（行为回归零变化）

#### Scenario: 新增宿主 = 注册适配器
- **WHEN** 未来接入另一个 CLI 宿主
- **THEN** 仅新增一个 HostAdapter 实现并注册，安装主流程（init 宿主选择 → 遍历所选适配器执行安装）无需修改

### Requirement: init 宿主选择与安装流程
init 向导必须（SHALL）提供宿主选择步骤：claude / codex / both 三选一（默认 claude）。选择结果决定本次执行哪些适配器的安装分支；选 both 时两个适配器都执行，且共享 prompts 中立位置与 LyConfig 配置。`ly menu` 必须提供独立入口（X. 安装 Codex）单独安装/重装 codex 宿主产物。

#### Scenario: 选 both 双宿主安装
- **WHEN** 用户在 init 宿主选择中选 both
- **THEN** claude 适配器装 ~/.claude 侧产物、codex 适配器装 ~/.codex/prompts/ 侧产物，prompts 角色词只写一份（中立位置），配置共享一份

#### Scenario: 仅 codex 宿主
- **WHEN** 用户选择仅 codex
- **THEN** 不安装任何 ~/.claude 侧产物（命令/roles 安装、wrapper 均跳过），仅装 codex 侧产物与共享配置

### Requirement: prompts 角色词位置中立化
prompts 角色词必须（SHALL）安装到中立位置 `~/.ly/prompts/`，SHALL NOT 再写入 `~/.claude/.ly/prompts/`。两侧命令模板中的 ROLE_FILE 引用路径必须（SHALL）同步更新为 `~/.ly/prompts/...`。存量用户升级时安装器必须（SHALL）将旧位置内容迁移至新位置并清理旧目录（或重建），迁移失败不阻断安装主流程。

#### Scenario: 老用户升级迁移
- **WHEN** 用户机器存在旧位置 `~/.claude/.ly/prompts/` 的角色词，运行 init/update
- **THEN** 角色词迁移至 `~/.ly/prompts/`，旧位置清理，claude 命令模板重装后 ROLE_FILE 指向新位置，审查流程照常工作

### Requirement: 共享资产的整体卸载口径
`~/.ly/prompts/` 为 ly-workflow 共享资产：仅当所有宿主的产物都被卸载（整体卸载）时安装器必须（SHALL）清理该目录；任一宿主仍安装时必须（SHALL）保留。

#### Scenario: 卸载宿主不连带共享资产
- **WHEN** 用户卸载 claude 宿主产物（保留 codex）
- **THEN** `~/.ly/prompts/` 中立角色词保留，仅 ~/.claude 侧命令/wrapper 等被清理
