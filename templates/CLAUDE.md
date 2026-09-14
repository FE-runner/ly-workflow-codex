# templates (ly-workflow-codex 模板库)

> [根目录](../CLAUDE.md) > **templates**

**Last Updated**: 2026-09-14

---

## 目录总览

| 目录 | 用途 | 安装目标 |
|------|------|----------|
| `commands-codex/` | 14 个 slash command（codex 宿主单 Agent 版，argument-hint frontmatter；审查走 `codex exec` 独立子会话 + resume 续聊，apply 当前会话自实施，无 wrapper/OVERALL/条件块） | `~/.codex/prompts/ly-*.md` |
| `prompts/codex/` | 2 个审查角色提示词（plan-reviewer/reviewer），审查命令 ROLE_FILE 引用 | `~/.ly/prompts/codex/` |

## commands-codex/（14 个）

| 命令 | 类型 | 说明 |
|------|------|------|
| `init.md` | 真逻辑 | 生成 AGENTS.md + `openspec init` + 自动 commit |
| `explore.md` | 薄壳委托 | 直接调用 `opsx:explore`，收敛到方案时提示转 `/ly:propose` |
| `propose.md` | 真逻辑 | 委托 `opsx:propose` + 创建方案前隔离三选一（隔离 worktree【同会话 cd 续跑】/本项目切新分支/留在当前分支）+ 全自动/手动两路径 + commit 前方案自审 |
| `apply.md` | 真逻辑 | 当前会话本人读 tasks.md 逐任务实施+验证+勾 checkbox → commit `apply: <change-name>`；无外部委托 |
| `archive.md` | 真逻辑 | 委托 `opsx:archive` 归档 + 自动 commit |
| `review-plan.md` | 真逻辑 | `codex exec` 独立子会话审方案（`plan-reviewer.md`），审查-修复循环（全局轮数上限 5，清零优先），清零后统一提交 |
| `review-code.md` | 真逻辑 | `codex exec` 独立子会话审代码（`reviewer.md`），Critical/Warning/Info 分级，审查-修复循环，清零后统一提交 |
| `commit.md` `rollback.md` `clean-branches.md` | Git 工具 | 不变 |
| `worktree.md` | Git 工具 | 默认 `~/.ly/worktrees/<项目名>/` 单层平铺；`switch` 子命令已移除，隔离切换由 `/ly:propose` 触发 |
| `release.md` | 真逻辑 | GitFlow 四场景（feature/release/hotfix/dev-offline），SemVer + Conventional Commits 自动推导版本号 |
| `changelog.md` | 真逻辑 | Keep a Changelog 格式生成/更新 CHANGELOG.md |
| `publish.md` | 真逻辑 | npm 发布四场景（bmc Nexus/GitHub Packages/npmjs+GitHub Release/CI），前置检查→版本号推导→构建→发布→验证 |

## prompts/codex/（2 个审查角色提示词）

- 审查命令实际使用的两个角色词：`plan-reviewer.md`（方案审查）、`reviewer.md`（代码审查）

## 模板变量系统

安装期由配置注入，命令模板内剩余的占位符：

| 占位符 | 说明 |
|--------|------|
| `{{REVIEW_MODEL}}` | 审查子会话模型（codex exec `-m` 参数）；未配置时不渲染，回退当前会话模型 |

其余旧占位符（`{{REVIEWER_MODEL}}`/`{{IMPLEMENTER_MODEL}}`/`{{LITE_MODE_FLAG}}` 等，双宿主时代的后端路由/条件块语义）已随本次裁剪移除。

## 与上游 ly-workflow 的差异（上游有、本项目无）

- `commands/`（claude 宿主版 14 个 slash command）
- `prompts/claude/`（claude 宿主角色提示词 6 个）
- `commands/agents/`（空目录）
