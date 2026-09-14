# CLAUDE.md（精简导航）

> ⚠️ **权威文档是 [AGENTS.md](./AGENTS.md)**：本仓库的开发指导、模块职责、关键设计决策以 AGENTS.md 为准；本文件只做精简导航，内容与 AGENTS.md 对齐，双向漂移时以 AGENTS.md 为准。对外说明见 [README.md](./README.md)。

**Last Updated**: 2026-09-14 (v0.1.0)

---

## 项目定位

**ly-workflow-codex**：Codex 单 Agent 工作流——同一 Codex 会话内自己完成探索 / 方案 / 实施 / 审查编排；方案审查与代码审查两个关卡以 `codex exec` 独立子会话执行（调用契约见 [docs/codex-exec-contract.md](./docs/codex-exec-contract.md)）。无 wrapper、无 Web UI、无 routing/implementer 概念；配置单宿主于 `~/.ly/config.toml`。它是 ly-workflow（双宿主）的 codex 单宿主独立版，关系与迁移路径见 [README.md](./README.md#与-ly-workflow-的关系)。

## 常用命令

```bash
npx ly-workflow-codex        # 交互式菜单（裸命令）
npx ly-workflow-codex init   # 全量初始化（生成项目 AGENTS.md + openspec init + 安装 14 个命令）
lycx doctor / status         # 体检 / 安装概览
lycx uninstall               # 卸载
```

安装产物：`~/.agents/skills/lyx-*/`（14 个 `@lyx-*` skills）+ `~/.ly/prompts/codex/`（8 个角色提示词）+ `~/.ly/config.toml`（配置，自动从旧 `~/.claude/.ly/config.toml` 迁移）。

## 14 个 @lyx-* skills

| 命令 | 一句话说明 |
|------|-----------|
| `@lyx-init` | 生成项目 AGENTS.md + `openspec init` + 自动 commit |
| `@lyx-explore` | 委托 `@openspec-explore skill`（纯薄壳） |
| `@lyx-propose` | 编排入口：隔离三选一 → 全自动/手动 → `@openspec-propose skill` → 方案自审 → commit `propose:`；全自动 = review-plan → apply → review-code 流水线 |
| `@lyx-apply` | 当前会话本人读 tasks.md 逐任务实施 + 验证 + 勾 checkbox → commit `apply:` |
| `@lyx-archive` | 委托 `@openspec-archive-change skill` + 自动 commit |
| `@lyx-review-plan` | `codex exec` 独立子会话审方案（`plan-reviewer.md`），审查-修复循环，清零统一提交 |
| `@lyx-review-code` | `codex exec` 独立子会话审代码（`reviewer.md`），Critical/Warning/Info 分级，同循环 |
| `@lyx-release` | GitFlow 四场景发版 + SemVer 推导 + 上线合并二选一 |
| `@lyx-changelog` | Keep a Changelog 格式生成/更新 CHANGELOG.md |
| `@lyx-publish` | npm 包发布四场景 |
| `@lyx-commit` `@lyx-rollback` `@lyx-clean-branches` `@lyx-worktree` | Git 工具（worktree 无 `switch`） |

## 审查执行模型（速览）

- 审查在 `codex exec` **独立子会话**中执行：`codex exec -C "$WORKDIR" --json -m <reviewModel> -`（stdin 传 ROLE_FILE + TASK）；未配置 `codexHost.reviewModel` 时不带 `-m`，回退当前会话模型
- 第 2 轮起 `codex exec resume <session_id>` 续聊；session_id = 首轮 `thread.started` 事件的 `thread_id`
- 角色词绝对路径 `~/.ly/prompts/codex/{reviewer,plan-reviewer}.md` 为行为契约
- 完整契约（终止条件八条、提交时机、升级 codex 复核清单）见 [docs/codex-exec-contract.md](./docs/codex-exec-contract.md)

## 相关文件

- [AGENTS.md](./AGENTS.md) — 开发权威文档（模块职责 / 常量 / 配置 / 设计决策 / 发版规则）
- [README.md](./README.md) — 对外用户文档（安装 / 命令表 / 架构 / 与 ly-workflow 的关系）
- [docs/codex-exec-contract.md](./docs/codex-exec-contract.md) — 审查子会话调用契约（不可改）
- [templates/CLAUDE.md](./templates/CLAUDE.md) — 模板库导航
