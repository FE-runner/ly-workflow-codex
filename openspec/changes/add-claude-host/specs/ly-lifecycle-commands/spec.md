## MODIFIED Requirements

### Requirement: init 命令串联 AGENTS.md 生成、OpenSpec 初始化与提交
`/ly:init` 必须（SHALL）按顺序执行三步：（1）由当前会话直接生成/更新项目根目录的项目记忆文件（单 Agent 模式，无外部技能委托）：以 `$ARGUMENTS` 为线索结合当前仓库结构，写清模块职责、入口与启动方式、核心类型、构建/测试命令、关键约定；已存在时增量更新，不推翻既有内容；（2）复用与 `lycx init` / `lycx doctor` 相同的 OpenSpec 依赖检查模型，检查 CLI、skills 与 OpenSpec root，并执行项目级修复：CLI 缺失时先安装 `@fission-ai/openspec@latest`；root 缺失时运行 `openspec init --tools <当前宿主的 tools 取值>`；root 存在但 skills 为 `missing` 时针对缺失技能的宿主运行 `openspec init --tools <该宿主>` 补齐（必要时以 `openspec update --force` 刷新）；仅全局可用时输出 WARN 并继续，不自动固化项目级；修复后复查，若 root 仍不健康或 required skills 仍缺失则停止并报告 `openspec doctor --json` / 缺失清单；（3）若步骤 1-2 产生了实际文件变动，暂存本次实际产出的项目记忆文件与 `openspec/` 并执行一次 commit。前两步都不得静默跳过；如果 `openspec` CLI 未安装，命令必须先安装它再继续。第三步若无可提交内容或 `git commit` 本身失败，SHALL 跳过提交并在汇总中如实报告，SHALL NOT 因此中断或视为命令失败。

**项目记忆产出按宿主（自本 change 起）**：步骤 1 产出的文件集合 SHALL 按当前宿主确定。codex 宿主产出项目根目录的 `AGENTS.md`；claude 宿主在 `AGENTS.md` 之外 SHALL 额外产出或更新导入 `AGENTS.md` 的 `CLAUDE.md`，使该宿主能实际加载项目指令（该宿主仅在项目无 `CLAUDE.md` 时读取 `AGENTS.md`）。目标记忆文件已存在且含用户内容时 SHALL 增量更新，SHALL NOT 覆盖既有章节。步骤 3 的暂存范围与步骤 4 的汇总 SHALL 与本次实际产出的记忆文件集合一致。

**OpenSpec 修复命令按宿主（自本 change 起）**：`--tools` 取值 SHALL 按宿主映射（codex 宿主对应 `codex`，claude 宿主对应 `claude`），SHALL NOT 固定为单一宿主；仅对确实缺少项目级技能的宿主执行补齐，SHALL NOT 因补齐一个宿主而重建或清理另一宿主的 OpenSpec 产物。

**本能力其他 Requirement 的配置载体与命令标识按宿主解读（自本 change 起）**：本能力其余 Requirement 正文中出现的 `~/.codex/lyx/config.toml` 与 `[codexHost]` SHALL 按宿主作用域解读（见 `multi-host-install` 与 `subagent-agent-config`）——claude 宿主对应该宿主的配置文件与宿主配置节，字段语义两宿主一致。正文中以 `@lyx-<command>` 形式出现的命令引用 SHALL 视为命令标识，其宿主调用写法由各宿主定义（见 `multi-host-install` 的命令标识约定）。

#### Scenario: 全新项目, 既无 AGENTS.md 也无 openspec/ 目录
- **WHEN** 用户在既无 AGENTS.md 也无 `openspec/` 目录的项目中运行 `/ly:init`
- **THEN** 命令由当前会话直接生成 AGENTS.md，通过共享检查器确认 CLI 可用后运行 `openspec init --tools <当前宿主对应取值>` 初始化 `openspec/` 与项目级 skills，复查通过后提交这两部分产物

#### Scenario: openspec CLI 未安装
- **WHEN** 用户运行 `/ly:init` 且 PATH 中找不到 `openspec` 命令
- **THEN** 命令先全局安装 `@fission-ai/openspec`，再通过共享检查器确认 CLI 可用，随后运行 `openspec init --tools <当前宿主对应取值>`，完成后提交产物

#### Scenario: 仅全局 skills 可用时 WARN 并继续
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但 required skills 仅能在当前宿主对应的全局技能根中可发现
- **THEN** 命令输出 `global-only` WARN，说明命令可用但未固化到当前项目，然后继续后续步骤，SHALL NOT 自动运行 `openspec update --force`

#### Scenario: 必需 skills 缺失时修复
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但某个 required skill 在项目级与全局级均缺失
- **THEN** 命令针对当前宿主运行 `openspec init --tools <当前宿主对应取值>` 补齐；若仍缺失则以 `openspec update --force` 刷新；复查仍失败时停止并输出缺失 skill 清单

#### Scenario: OpenSpec root 不健康时阻断
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 required skills 可用，但 `openspec doctor --json` 返回 root 不健康
- **THEN** 命令输出 `openspec doctor --json` 的错误状态与 fix 建议，停止初始化提交步骤，SHALL NOT 将不健康状态静默通过

#### Scenario: init 无新变动, 跳过提交
- **WHEN** 用户在项目记忆文件与 `openspec/` 均已存在且未发生变化，且共享 OpenSpec 依赖检查通过的项目中运行 `/ly:init`
- **THEN** 命令跳过 commit 步骤，在汇总中如实说明无变动可提交，不视为失败

#### Scenario: claude 宿主额外产出可加载的项目记忆
- **WHEN** 在 claude 宿主下运行 `/ly:init`，项目根目录不存在 `CLAUDE.md`
- **THEN** 命令在生成或更新 `AGENTS.md` 之外产出导入它的 `CLAUDE.md`，步骤 3 的暂存文件集合包含该文件，汇总中一并列出

#### Scenario: 既有 CLAUDE.md 增量更新
- **WHEN** 在 claude 宿主下运行 `/ly:init`，项目根目录已存在含用户内容的 `CLAUDE.md`
- **THEN** 命令增量更新并保留既有章节，SHALL NOT 整体覆盖或删除用户内容

#### Scenario: 补齐宿主技能不重建另一宿主产物
- **WHEN** 在 claude 宿主下运行 `/ly:init` 且项目中已存在 codex 宿主产生的 OpenSpec 技能目录
- **THEN** 命令只为当前缺失技能的宿主执行补齐，既有另一宿主目录保持原样，SHALL NOT 被重建或清理
