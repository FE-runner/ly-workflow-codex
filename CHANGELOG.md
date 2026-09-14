# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> 本文件记录 ly-workflow-codex 自 0.1.0 起的独立版本。0.1.0 之前的版本（ly-workflow 的 1.0.0–2.0.0，双宿主时代）属于上游项目，不在本文件记录范围内；如需追溯请查看上游仓库的 CHANGELOG。

---

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
