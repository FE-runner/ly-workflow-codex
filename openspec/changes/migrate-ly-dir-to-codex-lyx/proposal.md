## Why

`ly-workflow-codex` 当前把自己的配置/角色词/worktree 数据放在 `~/.ly/`，代码里多处注释（`installer.ts` 的 uninstall 逻辑、警告文案）明确把这个目录设计成"ly-workflow（双宿主老项目）共享命名空间"——因此 uninstall 时保守保留 `config.toml` 不删。实际探查发现这个"共享"假设已经不成立：ly-workflow 用的是 `~/.claude/.ly/config.toml`，与 ly-workflow-codex 当前用的 `~/.ly/config.toml` 是两份独立文件，内容早已分叉（version/routing/codexHost 字段都不同）。继续维持"共享目录"的设计既不反映现实，也让 uninstall 不敢真正清理自己的产物。

现在需要让 ly-workflow-codex 的配置目录彻底私有化、与 ly-workflow 解耦，同时借这个机会把已经不再需要的"旧路径迁移/共存检测"逻辑一并移除。

## What Changes

- 新增私有配置目录 `~/.codex/lyx/`，结构对齐现有 `~/.ly/`：
  - `~/.codex/lyx/config.toml`
  - `~/.codex/lyx/prompts/codex/`（8 个角色提示词，含 `reviewer.md`、`plan-reviewer.md`）
  - `~/.codex/lyx/worktrees/<项目名>/`（`lycx worktree` 创建的实际 git worktree）
- **BREAKING**：`~/.ly/` 下现有文件不做任何读取/迁移/删除，原样保留、视为已废弃。已安装用户的 `~/.ly/config.toml` 中的模型配置（`reviewModel`/`codingModel`/`spawnableModels` 等）需要在新位置 `~/.codex/lyx/config.toml` 重新配置，不会自动带过来。
- 移除 `config.ts` 中的旧路径迁移逻辑 `migrateLegacyConfig`（`~/.claude/.ly/` → `~/.ly/`）与共存检测逻辑 `hasCoexistingLegacyLyProducts`——不再需要从任何旧位置读取配置。同一批"旧路径迁移"逻辑还包括 `installer.ts` 里的 `migrateLegacyPrompts`（`~/.claude/.ly/prompts/` → `~/.ly/prompts/`，同样依赖 `hasCoexistingLegacyLyProducts`）——一并整体移除，包括其在 `src/commands/init.ts` 的调用点与 `src/index.ts` 的公开导出。
- **BREAKING**：`lycx uninstall` 的 config.toml 保留策略改变：不再"保守保留 + 警告"，改为真正删除 `~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/`（回归普通卸载语义，因为新目录已是本包私有、不存在"可能是别的工具的数据"顾虑）。`~/.codex/lyx/worktrees/` 子目录若存在未清理的实际 git worktree（递归遍历候选 worktree，在其自身或内部任一目录命中 `git rev-parse --git-dir` 即视为存活，不止检测第一层子目录——worktree 路径可能是 `worktrees/<项目名>/<开发分支名>` 这样的多层路径，`<开发分支名>` 本身还可能含 `/`），SHALL 警告并跳过删除（避免裸删导致 git 元数据孤儿引用），提示用户先用 `lycx worktree remove`；确认不存在任何存活 worktree 时随其余内容一并清理。`installer.ts` 中描述旧"ly-workflow 共享命名空间"设计意图的代码注释（uninstall 相关警告文案周边）同步清理，改为描述新的私有目录语义。这一行为变更新增一个 Capability 覆盖其可测试契约（见 Capabilities 段）。
- 所有写死 `~/.ly/...` 绝对路径的用户可见文案与技能模板同步改为 `~/.codex/lyx/...`：审查/实施技能模板（`templates/skills-codex/{apply,review-code,review-plan,propose,worktree}.md`）里的 `ROLE_FILE` 绝对路径与 worktree 路径示例；CLI 双语提示文案（`src/i18n/index.ts` 的中英文字符串）、`src/cli-setup.ts`（uninstall 确认/汇总文案）、`src/commands/doctor.ts`（体检项展示文案）、`src/commands/init.ts`（安装完成提示）、`src/commands/update.ts`（代码注释）；文档（`AGENTS.md`/`README.md`/`CLAUDE.md`/`templates/CLAUDE.md`/`workflow.md` 流程图）；代码注释（`src/utils/host-adapters.ts`、`src/utils/installer-template.ts`）。

## Capabilities

### New Capabilities

- `lyx-uninstall-cleanup`：`lycx uninstall` 对 `~/.codex/lyx/` 私有目录的清理策略——真正删除 `config.toml`/`prompts/`，`worktrees/` 按是否存在存活 git worktree 分别处理。此前该行为完全没有 spec 覆盖（纯实现细节），本次改动引入了涉及数据删除的新行为，需要可测试的行为契约。

### Modified Capabilities

- `ly-review-gates`：ROLE_FILE 绝对路径引用（`~/.ly/prompts/codex/plan-reviewer.md` / `reviewer.md`）与 config.toml 读取失败场景中的路径引用，均改为 `~/.codex/lyx/...`。
- `subagent-agent-config`：所有 `~/.ly/config.toml` 的路径引用改为 `~/.codex/lyx/config.toml`（`[codexHost]` 各字段的读写行为本身不变，只是文件位置变化）。
- `worktree-create-before-propose`：worktree 目录路径 `~/.ly/worktrees/<项目名>/<开发分支名>` 改为 `~/.codex/lyx/worktrees/<项目名>/<开发分支名>`（含相关 Scenario 中的示例路径）。

## Impact

- **代码**：`src/utils/package-meta.ts`（`LY_DIR` 常量）；`src/utils/config.ts`（移除 `migrateLegacyConfig`/`hasCoexistingLegacyLyProducts`）；`src/utils/installer.ts`（移除 `migrateLegacyPrompts`，导入/调用同步清理；uninstall 的保留策略改写为真正删除 + worktree 存活检测；"共享命名空间"相关注释清理）；`src/commands/init.ts`（移除对 `migrateLegacyPrompts` 的调用与安装完成提示文案）；`src/index.ts`（移除 `migrateLegacyPrompts` 公开导出）；`src/cli-setup.ts`（uninstall 命令提示文案）；`src/commands/doctor.ts`（体检项展示文案）；`src/commands/update.ts`（代码注释）；`src/i18n/index.ts`（中英文双语提示文案：卸载确认/汇总、角色词迁移提示、doctor 展示、spawnableHint 等）；`src/utils/host-adapters.ts`、`src/utils/installer-template.ts`（代码注释中的路径示例）。
- **模板**：`templates/skills-codex/apply.md`、`review-code.md`、`review-plan.md`、`propose.md`、`worktree.md` 中写死的 `ROLE_FILE` 绝对路径与 worktree 路径示例（角色词内容本身 `templates/prompts/codex/{reviewer,plan-reviewer}.md` 不含路径字面量，无需改动，仅其安装目标路径随 `LY_DIR` 常量变化）。
- **文档**：`AGENTS.md`、`README.md`、根目录 `CLAUDE.md`、`templates/CLAUDE.md`、`workflow.md`（流程图中的 worktree 路径）中所有 `~/.ly` 路径引用及"共享命名空间"相关表述。
- **测试**：`src/utils/__tests__/config.test.ts`（现有对 `~/.ly/prompts`、`~/.ly/backup`、`~/.ly/config.toml` 等路径的断言需更新为 `~/.codex/lyx/...`，不只是删除覆盖 `migrateLegacyConfig` 的用例）；`src/utils/__tests__/host-adapters.test.ts`（路径断言更新；覆盖 `migrateLegacyPrompts` 的测试随函数移除一并删除；新增覆盖 uninstall 新行为——含 worktree 存活检测——的测试）；`legacy-cleanup.test.ts` 视排查结果决定是否需要更新。
- **用户侧影响**：已安装用户升级后需要在 `~/.codex/lyx/config.toml` 重新配置模型字段；`lycx uninstall` 行为变化（真正删除配置而非保留）。

