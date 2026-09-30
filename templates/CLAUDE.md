# templates (ly-workflow-codex 模板库)

> [根目录](../CLAUDE.md) > **templates**

**Last Updated**: 2026-09-30

---

## 目录总览

模板**正文单源共享**，宿主差异收敛到 `hosts/<id>/`，安装期由各宿主适配器（`src/hosts/<id>/adapter.ts`）渲染。模板不随 TS 宿主包迁入 `src/`：`PACKAGE_ROOT` 解析要求包根存在顶层 `templates/`，`package.json` 的 `files` 也只收录 `templates/hosts/` 与 `templates/skills/`（见 add-claude-host design D15）。

| 目录 | 用途 | 安装目标 |
|------|------|----------|
| `skills/` | 14 个 SKILL.md 共享正文（`name`/`description`/`argument-hint` frontmatter）。宿主差异处以 `{{HOST_FRAGMENT:<片段>}}` 占位，另有 `{{LYX_CONFIG_FILE}}` / `{{HOST_ID}}` 两个宿主变量；正文中的 `@lyx-<command>` 是**命令标识**（codex 原样保留，claude 渲染为 `/lyx-<command>`，`@openspec-<skill>` 渲染为 `openspec-<skill>`） | codex：`~/.agents/skills/lyx-*/SKILL.md`；claude：`~/.claude/skills/lyx-*/SKILL.md` |
| `hosts/codex/fragments/<命令>/` | codex 宿主片段（审查 / 实施子代理的 spawn、`send_input` 复用、模型与推理档、ROLE_FILE 角色词路径、`codex "…"` 兜底续接命令等） | 渲染进 codex 产物 |
| `hosts/codex/prompts/` | 2 个审查角色提示词（plan-reviewer / reviewer），codex 审查命令 ROLE_FILE 以绝对路径引用 | `~/.codex/lyx/prompts/codex/` |
| `hosts/claude/fragments/<命令>/` | claude 宿主片段（`Agent` 工具调用自定义子代理、`SendMessage` 续跑、等待语义如实标注、模型经子代理定义落实、`claude "…"` 兜底续接命令、`@lyx-init` 额外产出 `CLAUDE.md`） | 渲染进 claude 产物 |
| `hosts/claude/agents/` | 3 个子代理定义（`lyx-plan-reviewer` / `lyx-reviewer`：只读，工具含 Bash 但正文限定只读 git / openspec；`lyx-implementer`：只实施 change 范围、不提交）。frontmatter 的 `{{AGENT_MODEL_LINES}}` 按 `[host] reviewModel`/`codingModel` 与对应推理档渲染，未配置为 `model: inherit`；不启用 worktree 隔离 | `~/.claude/agents/lyx-*.md`（始终安装） |

两个宿主的片段集合必须一一对应（测试断言）；片段缺失时安装直接报错，不静默留空。

## skills/（14 个共享正文）

| 命令 | 类型 | 说明 |
|------|------|------|
| `init.md` | 真逻辑 | 生成 AGENTS.md（claude 宿主额外产出导入它的 `CLAUDE.md`）+ `lycx openspec ensure --host <当前宿主>` + 自动 commit |
| `explore.md` | 薄壳委托 | 直接调用 `@openspec-explore skill`，收敛到方案时提示转 `@lyx-propose` |
| `propose.md` | 真逻辑 | 委托 `@openspec-propose skill` + 创建方案前隔离三选一（隔离 worktree【同会话 cd 续跑】/本项目切新分支/留在当前分支）+ 记录 isolation metadata + 全自动/手动两路径 + commit 前方案自审 + context.md 软上下文产出（内容边界自检） |
| `apply.md` | 真逻辑 | 按 `codingExecutor` 实施：`main`（默认）= 主 agent 直接实施；`subagent` = coding subagent（非 fork，经 context.md 获取软上下文）读 tasks.md 逐任务实施+验证+勾 checkbox 后回传。两条路径均由主会话确认后回写 context.md，并按共用 index 隔离协议统一提交 apply 阶段 commit（CC 前缀 + `Change-Stage: apply` trailer）；subagent 路径环境级不可用回退主 agent，业务失败转人工 |
| `archive.md` | 真逻辑 | 委托 `@openspec-archive-change skill` 归档 + 自动 commit + 按 isolation metadata 提示合并回 sourceBranch、清理 worktree/开发分支 |
| `review-plan.md` | 真逻辑 | 按 `reviewExecutor` 审方案：`main`（默认）= 主 agent 直接自审，无逐条裁决/驳回硬线，最多 2 轮；`subagent` = 单审查 subagent（`plan-reviewer.md`，范围点名 + context.md 路径引用；模型 `reviewModel`）+ 主会话逐条裁决 + 驳回硬线 + 全局轮数上限 5。两条路径清零后统一提交 |
| `review-code.md` | 真逻辑 | 按 `reviewExecutor` 审代码（同 review-plan 的执行者分支），Critical/Warning/Info 分级；慢验证已移出循环，统一由 `@lyx-archive` 归档前关卡执行 |
| `commit.md` `rollback.md` `clean-branches.md` | Git 工具 | 不变 |
| `worktree.md` | Git 工具 | 默认 `~/.ly/worktrees/<项目名>/` 单层平铺；`switch` 子命令已移除，隔离切换由 `@lyx-propose` 触发；propose 创建隔离时负责记录 metadata |
| `release.md` | 真逻辑 | GitFlow 四场景（feature/release/hotfix/dev-offline），SemVer + Conventional Commits 自动推导版本号 |
| `changelog.md` | 真逻辑 | Keep a Changelog 格式生成/更新 CHANGELOG.md |
| `publish.md` | 真逻辑 | npm 发布四场景（bmc Nexus/GitHub Packages/npmjs+GitHub Release/CI），前置检查→版本号推导→构建→发布→验证 |

## 角色设定来源（按宿主）

- codex：`hosts/codex/prompts/{plan-reviewer,reviewer}.md`，审查 TASK 指示子代理读取其绝对路径
- claude：`hosts/claude/agents/lyx-*.md` 的定义正文即角色设定（清单与输出格式取自 codex 角色词），不引用 codex 角色词路径

## 模板变量系统

安装期由配置注入，命令模板内剩余的占位符：

| 占位符 | 说明 |
|--------|------|
| `{{REVIEW_MODEL}}` | **历史兼容占位**（subagent 多 Agent 模式已不再使用）：模型与推理档经模板指示 + 宿主 spawn 能力落实（`reviewModel`/`codingModel` 与 `reviewReasoningEffort`/`codingReasoningEffort` 由模板运行时读取，模型未配置回退当前会话模型，推理档空白不传），模板不含模型或推理档渲染占位符；`{{REVIEW_MODEL}}` 处理仅保留给历史模板/旧安装位渲染兼容 |

| `{{HOST_FRAGMENT:<片段>}}` | 宿主片段注入：替换为 `hosts/<宿主>/fragments/<命令>/<片段>.md` 的内容 |
| `{{LYX_CONFIG_FILE}}` | 当前宿主的配置文件（`~/.codex/lyx/config.toml` / `~/.claude/lyx/config.toml`） |
| `{{HOST_ID}}` | 当前宿主 id（`codex` / `claude`） |
| `{{AGENT_MODEL_LINES}}` | 仅 claude 子代理定义：`model` / `effort` frontmatter 行 |

其余旧占位符（`{{REVIEWER_MODEL}}`/`{{IMPLEMENTER_MODEL}}`/`{{LITE_MODE_FLAG}}` 等）只保留兼容渲染，模板正文不再引用。

## 与上游 ly-workflow 的差异

- claude 宿主改为以 `skills/` 共享正文 + `hosts/claude/` 片段渲染，不再维护独立的 `commands/`（slash command）与 `prompts/claude/` 模板副本
