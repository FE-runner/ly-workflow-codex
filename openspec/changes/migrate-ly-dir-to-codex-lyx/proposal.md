## Why

`ly-workflow-codex` 当前把自己的配置/角色词/worktree 数据放在 `~/.ly/`，代码里多处注释（`installer.ts` 的 uninstall 逻辑、警告文案）明确把这个目录设计成"ly-workflow（双宿主老项目）共享命名空间"——因此 uninstall 时保守保留 `config.toml` 不删。实际探查发现这个"共享"假设已经不成立：ly-workflow 用的是 `~/.claude/.ly/config.toml`，与 ly-workflow-codex 当前用的 `~/.ly/config.toml` 是两份独立文件，内容早已分叉（version/routing/codexHost 字段都不同）。继续维持"共享目录"的设计既不反映现实，也让 uninstall 不敢真正清理自己的产物。

现在需要让 ly-workflow-codex 的配置目录彻底私有化、与 ly-workflow 解耦，同时借这个机会把已经不再需要的"旧路径迁移/共存检测"逻辑一并移除。

## What Changes

- 新增私有配置目录 `~/.codex/lyx/`，结构对齐现有 `~/.ly/`：
  - `~/.codex/lyx/config.toml`
  - `~/.codex/lyx/prompts/codex/`（8 个角色提示词，含 `reviewer.md`、`plan-reviewer.md`）
  - `~/.codex/lyx/worktrees/<项目名>/`（`lycx worktree` 创建的实际 git worktree）
- **BREAKING**：`~/.ly/` 下现有文件不做任何读取/迁移/删除，原样保留、视为已废弃。已安装用户的 `~/.ly/config.toml` 中的模型配置（`reviewModel`/`codingModel`/`spawnableModels` 等）需要在新位置 `~/.codex/lyx/config.toml` 重新配置，不会自动带过来。
- 移除 `config.ts` 中的旧路径迁移逻辑 `migrateLegacyConfig`（`~/.claude/.ly/` → `~/.ly/`）与共存检测逻辑 `hasCoexistingLegacyLyProducts`——不再需要从任何旧位置读取配置。
- **BREAKING**：`lycx uninstall` 的 config.toml 保留策略改变：不再"保守保留 + 警告"，改为真正删除 `~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/`（回归普通卸载语义，因为新目录已是本包私有、不存在"可能是别的工具的数据"顾虑）。`~/.codex/lyx/worktrees/` 子目录若存在未清理的实际 git worktree，SHALL 警告并跳过删除（避免裸删导致 git 元数据孤儿引用），提示用户先用 `lycx worktree remove`；`worktrees/` 为空或不存在时随其余内容一并清理。`installer.ts` 中描述旧"ly-workflow 共享命名空间"设计意图的代码注释（uninstall 相关警告文案周边）同步清理，改为描述新的私有目录语义。
- 所有写死 `~/.ly/...` 绝对路径的角色词模板（`templates/prompts/codex/*.md` 中的 `ROLE_FILE`）、文档（AGENTS.md/README.md/CLAUDE.md）、技能描述（`ly:worktree`）同步改为 `~/.codex/lyx/...`。

## Capabilities

### New Capabilities

（无——这是对现有安装/配置管理行为的路径迁移与逻辑简化，不引入新能力）

### Modified Capabilities

- `ly-review-gates`：ROLE_FILE 绝对路径引用（`~/.ly/prompts/codex/plan-reviewer.md` / `reviewer.md`）与 config.toml 读取失败场景中的路径引用，均改为 `~/.codex/lyx/...`。
- `subagent-agent-config`：所有 `~/.ly/config.toml` 的路径引用改为 `~/.codex/lyx/config.toml`（`[codexHost]` 各字段的读写行为本身不变，只是文件位置变化）。
- `worktree-create-before-propose`：worktree 目录路径 `~/.ly/worktrees/<项目名>/<开发分支名>` 改为 `~/.codex/lyx/worktrees/<项目名>/<开发分支名>`（含相关 Scenario 中的示例路径）。

## Impact

- **代码**：`src/utils/package-meta.ts`（`LY_DIR` 常量）、`src/utils/config.ts`（移除 `migrateLegacyConfig`/`hasCoexistingLegacyLyProducts`，相关调用点同步清理）、`src/utils/installer.ts`（uninstall 的保留策略与警告文案、"共享命名空间"相关注释）、`src/cli-setup.ts`（uninstall 命令提示文案）。
- **模板**：`templates/prompts/codex/*.md` 中写死的 `ROLE_FILE` 绝对路径。
- **文档**：`AGENTS.md`、`README.md`、`CLAUDE.md` 中所有 `~/.ly` 路径引用及"共享命名空间"相关表述。
- **技能描述**：`ly:worktree` 等技能描述中写死的路径示例。
- **测试**：`src/utils/__tests__/host-adapters.test.ts`、`legacy-cleanup.test.ts` 等对路径的断言；覆盖 `migrateLegacyConfig`/`hasCoexistingLegacyLyProducts` 的测试用例随函数移除一并删除。
- **用户侧影响**：已安装用户升级后需要在 `~/.codex/lyx/config.toml` 重新配置模型字段；`lycx uninstall` 行为变化（真正删除配置而非保留）。
