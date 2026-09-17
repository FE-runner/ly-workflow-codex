# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> 本文件记录 ly-workflow-codex 自 0.1.0 起的独立版本。0.1.0 之前的版本（ly-workflow 的 1.0.0–2.0.0，双宿主时代）属于上游项目，不在本文件记录范围内；如需追溯请查看上游仓库的 CHANGELOG。

---

## [Unreleased]

审查与实施改为"执行者可切换"：默认由主 agent 直接执行，`[codexHost] reviewExecutor` / `codingExecutor` 可显式切到 spawn 独立子代理；测试 / 类型检查 / 构建从审查循环移到归档前一次完整验证。

### Added

- `[codexHost] reviewExecutor` / `codingExecutor`：取值 `main` / `subagent`，未配置等价 `main`
- 新能力 `archive-verification-gate`：`@lyx-archive` 在归档前执行一次项目完整验证（测试 / 类型检查 / 构建），失败阻断归档
- `@lyx-review-plan` / `@lyx-review-code` / `@lyx-apply` 的执行者分支：主 agent 路径无 spawn、无逐条裁决 / 驳回硬线，自审循环最多 2 轮

### Changed

- **BREAKING 默认执行者变更**：`reviewExecutor` / `codingExecutor` 未配置等价 `main`，升级用户即使不改配置，行为也会从"spawn 子代理"变为"主 agent 直接执行"
- **BREAKING 子代理默认复用**：subagent 路径第 2 轮起默认用 `send_input` 复用同一子代理（实测宿主支持跨轮唤醒并保留上下文），复用失败才回退重新 spawn；"回合结束即失去访问能力"的旧表述废止
- 测试 / 类型检查 / 构建不再在审查循环每轮执行；`openspec validate` 仍保留在 review-plan 每轮
- `lycx init` 向导新增执行者二连采集；执行者为 `main` 时不采集对应模型字段并在摘要标注"不生效"
- `lycx doctor` 展示执行者字段；执行者为 `main` 时对非空模型 / 推理档字段输出 WARN

### Removed

- **BREAKING `[codexHost] reviewModelB` / `reviewReasoningEffortB`**：字段与类型定义移除，不再读取或保留写回；存量配置中的这两个键可自行删除
- 审查循环内的慢验证步骤（review-code 的"本轮验证"与对应终止条件）

### Migration

- 依赖独立审查 / 独立实施的用户需显式配置 `reviewExecutor = "subagent"` / `codingExecutor = "subagent"`（旧配置中留空的 `reviewModel` 不再隐含"spawn 子代理"）
- 存量 `reviewModelB` / `reviewReasoningEffortB` 可删除；`lycx doctor` 会提示这两个字段已移除

## [0.2.0] - 2026-09-14

命令形态从「斜杠命令」迁移为 Codex 官方 skill 机制：Codex CLI 的 `/` 命令为内置硬编码，不支持从文件系统加载自定义命令，因此 14 个命令模板由 slash command 格式改造为 `SKILL.md`（frontmatter：`name`/`description`/`argument-hint`），安装位移位到 Codex 官方 skill 发现目录；命令前缀统一为 `lyx`，与上游 ly-workflow 的 `ly` 命令区分。

### Changed

- **命令调用形态 `/ly:*` → `@lyx-*`**：14 个命令以 `@lyx-<cmd>` mention 调用（`~/.agents/skills/lyx-<cmd>/SKILL.md`），参数为 mention 后跟随的自然语言；`/ly:*` 旧形态不再可用
- **安装位 `~/.codex/prompts/ly-*.md` → `~/.agents/skills/lyx-*/SKILL.md`**：`~/.codex/prompts/` 为死目录（Codex CLI 不读取），`~/.agents/skills/<name>/SKILL.md` 为 skill 发现目录（用户级 + 项目级 `.agents/skills/`）
- **模板源 `templates/commands-codex/` → `templates/skills-codex/`**：每份模板增加 `name: lyx-<cmd>` frontmatter 与调用方式说明
- **openspec 依赖检测改为 openspec-* skills**：preflight/doctor 检测 `~/.agents/skills/` 或项目 `.agents/skills/` 下的 `openspec-*` SKILL.md（旧 `~/.codex/prompts/opsx-*.md` 检测移除）
- **卸载/更新兼容旧安装位**：`uninstall` 与 `update` 在清理/备份新安装位 `~/.agents/skills/lyx-*` 的同时回收旧安装位残留（`~/.agents/skills/ly-*` 目录与 `~/.codex/prompts/ly-*.md`）

### Fixed

- 修复「`/ly` no matches」根因：Codex CLI 的斜杠命令为内置硬编码，无法从文件系统加载自定义 `/` 命令；现改为官方 `@mention skills` 机制

### Removed

- 旧迁移产物 `source-command-opsx-*` skills（`@opsx-*` 已由 openspec CLI 生成的 `openspec-*` skills 取代）

## [0.1.0] - 2026-09-14

首个版本：从 ly-workflow 拆分，codex 单宿主化——砍掉 claude 宿主、wrapper、Web UI 与 routing/implementer 概念，审查关卡改为 `codex exec` 独立子会话。

### Added

- **14 个 `/ly:*` 命令（codex 单宿主版）**：`init`/`explore`/`propose`/`apply`/`archive`/`review-plan`/`review-code`/`release`/`changelog`/`publish`/`commit`/`rollback`/`clean-branches`/`worktree`，模板源 `templates/commands-codex/`，安装到 `~/.codex/prompts/ly-*.md`
- **审查执行模型 = `codex exec` 独立子会话**：`codex exec -C "$WORKDIR" --json -m <reviewModel> -` + 第 2 轮起 `codex exec resume <session_id>` 续聊；模型由 `codexHost.reviewModel` 渲染，未配置回退当前会话模型；调用契约见 `docs/codex-exec-contract.md`
- **8 个共享角色提示词**：`templates/prompts/codex/` → `~/.ly/prompts/codex/`（审查实际使用 `plan-reviewer.md`/`reviewer.md`，绝对路径为行为契约）
- **CLI + 安装器**：bin `lycx`，子命令 `init`/`doctor`/`status`/`uninstall` + 交互式菜单；init 向导四级采集（模式 → Agent → API 提供方 → 审查模型）；`doctor` 体检 OpenSpec CLI 与 skills
- **openspec 依赖 preflight**：安装器入口（裸命令 / init）检查 openspec CLI 与 `~/.codex/prompts/opsx-*.md`，缺失询问就地安装 / 拒绝列清单 / 失败不阻断
- **配置 `~/.ly/config.toml`**：旧 `~/.claude/.ly/config.toml` 首次读写时自动迁移（新位置已有配置不覆盖）
- **旧包迁移路径**：安装位与 ly-workflow 的 codex 分支同构（`~/.codex/prompts/ly-*.md` + `~/.ly/prompts/codex/`），卸载旧包或 `init --force` 覆盖即可迁移

### Changed

- 流程收敛为 Codex 单 Agent：同一会话内 propose → 自审 → apply → 修复编排，`apply` 恒为当前会话本人实施（读 tasks.md 逐任务实施 + 验证 + 勾 checkbox → commit `apply: <change>`）
- `/ly:propose` 保留上游编排语义：创建方案前隔离方式三选一（隔离 worktree【同会话 cd 续跑】/ 本项目切新分支 / 留在当前分支）+ 全自动/手动询问 + 方案自审（四项检查 + 逐项结论清单）+ 每步 commit
- `/ly:init` 生成文件从上游的 CLAUDE.md 改为 AGENTS.md（codex 宿主约定）

### Removed

- **claude 宿主**：`~/.claude/commands/` 安装路径、claude 专属提示词与相关安装/卸载逻辑
- **ly-wrapper / codeagent-wrapper**：TS/Go 审查包装器、Web UI（HTTP+SSE 进度页）、`--lite`/`LITE_MODE_FLAG` 门控全部移除
- **routing 概念**：`routing.reviewer`/`routing.implementer`、可选审查/实施后端（hermes/openclaw）、条件块渲染（`LY:IF:IMPLEMENTER_*`）不再存在
- **上游历史安装产物清理范围调整为 codex 侧**：`legacy-cleanup` 只清理 `~/.codex/AGENTS.md` LY 区块、`~/.codex/config.toml` 旧注释与 `[features.multi_agent_v2]`、`~/.codex/agents/ly-*.toml`
