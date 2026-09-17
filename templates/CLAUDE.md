# templates (ly-workflow-codex 模板库)

> [根目录](../CLAUDE.md) > **templates**

**Last Updated**: 2026-09-14

---

## 目录总览

| 目录 | 用途 | 安装目标 |
|------|------|----------|
| `skills-codex/` | 14 个 SKILL.md 模板（codex 宿主单 Agent 版，`name`/`description`/`argument-hint` frontmatter；审查与实施主体由 `[codexHost] reviewExecutor` / `codingExecutor` 决定——`main`（默认）= 主 agent 直接执行，`subagent` = 独立子代理（非 fork）经 change 目录 `context.md` 到达 + 范围点名；模型与推理档经模板指示 + 宿主能力落实，无 wrapper/OVERALL/条件块） | `~/.agents/skills/lyx-*/SKILL.md` |
| `prompts/codex/` | 2 个审查角色提示词（plan-reviewer/reviewer），审查命令 ROLE_FILE 引用 | `~/.codex/lyx/prompts/codex/` |

## skills-codex/（14 个）

| 命令 | 类型 | 说明 |
|------|------|------|
| `init.md` | 真逻辑 | 生成 AGENTS.md + `openspec init` + 自动 commit |
| `explore.md` | 薄壳委托 | 直接调用 `@openspec-explore skill`，收敛到方案时提示转 `@lyx-propose` |
| `propose.md` | 真逻辑 | 委托 `@openspec-propose skill` + 创建方案前隔离三选一（隔离 worktree【同会话 cd 续跑】/本项目切新分支/留在当前分支）+ 全自动/手动两路径 + commit 前方案自审 + context.md 软上下文产出（内容边界自检） |
| `apply.md` | 真逻辑 | 按 `codingExecutor` 实施：`main`（默认）= 主 agent 直接实施；`subagent` = coding subagent（非 fork，经 context.md 获取软上下文）读 tasks.md 逐任务实施+验证+勾 checkbox 后回传。两条路径均由主会话确认后回写 context.md 并统一 commit `apply: <change-name>`；subagent 路径环境级不可用回退主 agent，业务失败转人工 |
| `archive.md` | 真逻辑 | 委托 `@openspec-archive-change skill` 归档 + 自动 commit |
| `review-plan.md` | 真逻辑 | 按 `reviewExecutor` 审方案：`main`（默认）= 主 agent 直接自审，无逐条裁决/驳回硬线，最多 2 轮；`subagent` = 单审查 subagent（`plan-reviewer.md`，范围点名 + context.md 路径引用；模型 `reviewModel`）+ 主会话逐条裁决 + 驳回硬线 + 全局轮数上限 5。两条路径清零后统一提交 |
| `review-code.md` | 真逻辑 | 按 `reviewExecutor` 审代码（同 review-plan 的执行者分支），Critical/Warning/Info 分级；慢验证已移出循环，统一由 `@lyx-archive` 归档前关卡执行 |
| `commit.md` `rollback.md` `clean-branches.md` | Git 工具 | 不变 |
| `worktree.md` | Git 工具 | 默认 `~/.ly/worktrees/<项目名>/` 单层平铺；`switch` 子命令已移除，隔离切换由 `@lyx-propose` 触发 |
| `release.md` | 真逻辑 | GitFlow 四场景（feature/release/hotfix/dev-offline），SemVer + Conventional Commits 自动推导版本号 |
| `changelog.md` | 真逻辑 | Keep a Changelog 格式生成/更新 CHANGELOG.md |
| `publish.md` | 真逻辑 | npm 发布四场景（bmc Nexus/GitHub Packages/npmjs+GitHub Release/CI），前置检查→版本号推导→构建→发布→验证 |

## prompts/codex/（2 个审查角色提示词）

- 审查命令实际使用的两个角色词：`plan-reviewer.md`（方案审查）、`reviewer.md`（代码审查）

## 模板变量系统

安装期由配置注入，命令模板内剩余的占位符：

| 占位符 | 说明 |
|--------|------|
| `{{REVIEW_MODEL}}` | **历史兼容占位**（subagent 多 Agent 模式已不再使用）：模型与推理档经模板指示 + 宿主 spawn 能力落实（`reviewModel`/`codingModel` 与 `reviewReasoningEffort`/`codingReasoningEffort` 由模板运行时读取，模型未配置回退当前会话模型，推理档空白不传），模板不含模型或推理档渲染占位符；`{{REVIEW_MODEL}}` 处理仅保留给历史模板/旧安装位渲染兼容 |

其余旧占位符（`{{REVIEWER_MODEL}}`/`{{IMPLEMENTER_MODEL}}`/`{{LITE_MODE_FLAG}}` 等，双宿主时代的后端路由/条件块语义）已随本次裁剪移除。

## 与上游 ly-workflow 的差异（上游有、本项目无）

- `commands/`（claude 宿主版 14 个 slash command）
- `prompts/claude/`（claude 宿主角色提示词 6 个）
- `commands/agents/`（空目录）
