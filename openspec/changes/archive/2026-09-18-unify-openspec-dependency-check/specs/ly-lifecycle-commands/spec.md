## MODIFIED Requirements

### Requirement: init 命令串联 AGENTS.md 生成、OpenSpec 初始化与提交
`/ly:init` 必须（SHALL）按顺序执行三步：（1）由当前会话直接生成/更新项目根目录的 `AGENTS.md`（codex 单 Agent 模式，无外部技能委托）：以 `$ARGUMENTS` 为线索结合当前仓库结构，写清模块职责、入口与启动方式、核心类型、构建/测试命令、关键约定；已存在时增量更新，不推翻既有内容；（2）复用与 `lycx init` / `lycx doctor` 相同的 OpenSpec 依赖检查模型，检查 CLI、skills 与 OpenSpec root，并执行项目级修复：CLI 缺失时先安装 `@fission-ai/openspec@latest`；root 缺失时运行 `openspec init --tools codex`；root 存在但 skills 为 `missing` 时运行 `openspec update --force`（必要时回退 `openspec init --tools codex`）；仅全局可用时输出 WARN 并继续，不自动固化项目级；修复后复查，若 root 仍不健康或 required skills 仍缺失则停止并报告 `openspec doctor --json` / 缺失清单；（3）若步骤 1-2 产生了实际文件变动，暂存 `AGENTS.md`、`openspec/` 并执行一次 commit。前两步都不得静默跳过；如果 `openspec` CLI 未安装，命令必须先安装它再继续。第三步若无可提交内容或 `git commit` 本身失败，SHALL 跳过提交并在汇总中如实报告，SHALL NOT 因此中断或视为命令失败。

#### Scenario: 全新项目, 既无 AGENTS.md 也无 openspec/ 目录
- **WHEN** 用户在既无 AGENTS.md 也无 `openspec/` 目录的项目中运行 `/ly:init`
- **THEN** 命令由当前会话直接生成 AGENTS.md，通过共享检查器确认 CLI 可用后运行 `openspec init --tools codex` 初始化 `openspec/` 与项目级 skills，复查通过后提交这两部分产物

#### Scenario: openspec CLI 未安装
- **WHEN** 用户运行 `/ly:init` 且 PATH 中找不到 `openspec` 命令
- **THEN** 命令先全局安装 `@fission-ai/openspec`，再通过共享检查器确认 CLI 可用，随后运行 `openspec init --tools codex`，完成后提交产物

#### Scenario: 仅全局 skills 可用时 WARN 并继续
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但 required skills 仅能在全局 `~/.agents/skills` 或 `~/.codex/skills` 中可发现
- **THEN** 命令输出 `global-only` WARN，说明命令可用但未固化到当前项目，然后继续后续步骤，SHALL NOT 自动运行 `openspec update --force`

#### Scenario: 必需 skills 缺失时修复
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但某个 required skill 在项目级与全局级均缺失
- **THEN** 命令运行 `openspec update --force` 修复；若仍缺失则回退 `openspec init --tools codex`；复查仍失败时停止并输出缺失 skill 清单

#### Scenario: OpenSpec root 不健康时阻断
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 required skills 可用，但 `openspec doctor --json` 返回 root 不健康
- **THEN** 命令输出 `openspec doctor --json` 的错误状态与 fix 建议，停止初始化提交步骤，SHALL NOT 将不健康状态静默通过

#### Scenario: init 无新变动, 跳过提交
- **WHEN** 用户在 AGENTS.md 与 `openspec/` 均已存在且未发生变化，且共享 OpenSpec 依赖检查通过的项目中运行 `/ly:init`
- **THEN** 命令跳过 commit 步骤，在汇总中如实说明无变动可提交，不视为失败
