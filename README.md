# ly-workflow-codex

> Codex 单 Agent 工作流：同一 Codex 会话内自己完成探索 / 方案 / 实施 / 审查编排；方案审查与代码审查两个关卡由 `codex exec` 独立子会话执行（调用契约见 [docs/codex-exec-contract.md](./docs/codex-exec-contract.md)）。最大化复用 OpenSpec 原生工作流。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

## 安装

```bash
npx ly-workflow-codex        # 交互式菜单（含 openspec 依赖 preflight 检查）
npx ly-workflow-codex init   # 全量初始化（生成 AGENTS.md + openspec init）
```

- CLI 二进制名 `lycx`（子命令：`init`/`doctor`/`status`/`uninstall`，裸命令进菜单；`update` 在菜单内）
- 安装产物：14 个 `/ly:*` slash command → `~/.codex/prompts/ly-*.md`；8 个角色提示词 → `~/.ly/prompts/codex/`
- 配置：`~/.ly/config.toml`——首次读取/写入时自动从旧 `~/.claude/.ly/config.toml` 迁移（新位置已有配置则不覆盖）
- 初始化向导四级采集：模式（唯一：单 Agent）→ Agent（唯一：Codex）→ API 提供方（`~/.codex/config.toml` 现有 `[model_providers.*]` / OpenAI 官方 / 自定义）→ 审查模型（存 `codexHost.reviewModel`，未配置时审查回退当前会话模型）

## 命令（14 个 `/ly:*`）

| 命令 | 用途 |
|------|------|
| `/ly:init` | 生成项目 AGENTS.md + 初始化 OpenSpec 目录结构 + 自动 commit |
| `/ly:explore` | 想清楚再动手（委托 `opsx:explore`），收敛到方案时提示转 `/ly:propose` |
| `/ly:propose` | 创建方案前问一次隔离方式（三选一：隔离 worktree【从当前分支 HEAD 切出、同会话 cd 续跑，续接命令为异常兜底】/ 本项目切新分支【仅分支隔离，脏改动三选处置】/ 留在当前分支）+ 问"全自动/手动" → 委托 `opsx:propose` → 方案自审（四项检查 + 逐项结论清单；机械断链直接修、业务判断类问用户）→ commit `propose: <change>`；全自动 = review-plan → apply → review-code 流水线，手动 = 逐步确认 |
| `/ly:apply` | **当前会话本人实施**：读 tasks.md 逐任务实施 + 验证 + 勾 checkbox → commit `apply: <change>`（无外部委托、无 routing/implementer 概念） |
| `/ly:archive` | 归档完成的 change（委托 `opsx:archive`）+ 自动 commit |
| `/ly:review-plan` | 审方案：`codex exec` 独立子会话（角色词 `plan-reviewer.md`）分级审查，审查-修复循环直到 Critical 清零或触发终止条件（全局轮数上限 5，清零优先），清零统一提交修复 |
| `/ly:review-code` | 审代码：同上（角色词 `reviewer.md`），Critical/Warning/Info 分级 |
| `/ly:release` | GitFlow 四场景发版（feature/release/hotfix/dev-offline），SemVer 自动推导版本号；上线合并二选一（远端 PR 默认 / 本地直接合并）+ 主分支名检测（master/main） |
| `/ly:changelog` | 按 commit 前缀分组生成/更新 Keep a Changelog 格式的 CHANGELOG.md |
| `/ly:publish` | npm 包发布四场景（bmc 私域 Nexus / GitHub Packages / npmjs + GitHub Release / CI 自动发布），前置检查→版本号推导→构建→发布→验证 |
| `/ly:commit` `/ly:rollback` `/ly:clean-branches` `/ly:worktree` | Git 工具（worktree 只留 `add`/`list`/`remove`/`prune`/`migrate`，`switch` 已移除——隔离切换统一由 `/ly:propose` 触发） |

审查-修复循环细节（增量传递、resume 续聊、终止条件八条、提交时机）见 [docs/codex-exec-contract.md](./docs/codex-exec-contract.md)，命令模板为其调用方。

## 典型工作流

```
/ly:init
/ly:propose "要做什么"    # 隔离三选一 + 全自动/手动
/ly:review-plan            # 审方案（codex exec 子会话）
/ly:apply                  # 本会话实施 + 立即 commit
/ly:review-code            # 审代码（codex exec 子会话）
/ly:archive
```

## 架构

- **codex 单 Agent 编排**：当前 Codex 会话完成探索 → 方案 → 自审 → 实施 → 修复的全部编排；无 wrapper、无 Web UI、无 routing/implementer 后端选择
- **审查关卡 = `codex exec` 独立子会话**：`codex exec -C "$WORKDIR" --json -m <codexHost.reviewModel> -`，从 stdin 传 ROLE_FILE + TASK；第 2 轮起 `codex exec resume <session_id>` 续聊（模型沿用首轮会话）；未配置审查模型时不带 `-m`，回退当前会话模型；角色词绝对路径 `~/.ly/prompts/codex/` 为行为契约
- **apply 恒为本会话自实施**：带着 propose 阶段上下文直接读 tasks.md 实施，审查独立性由独立子会话保证，实施不再委托第三方
- **发布**：打 tag `v*.*.*` push 触发 GitHub Actions 自动发 npm 包；无独立二进制构建步骤
- **生命周期**：直接委托 OpenSpec 原生技能（`opsx:*`），安装器只负责 preflight（openspec CLI + opsx 技能检测）与安装

## 与 ly-workflow 的关系

- **ly-workflow**（上游原仓库）是双宿主工具（claude + codex）；**ly-workflow-codex** 是它的 codex 单宿主独立版：砍掉 claude 宿主、wrapper、Web UI、routing 概念，审查改为 `codex exec` 独立子会话（内容契约见 [docs/codex-exec-contract.md](./docs/codex-exec-contract.md)）
- **安装位与旧包同构**：`~/.codex/prompts/ly-*.md` 与 `~/.ly/prompts/codex/` 与 ly-workflow 的 codex 分支一致——同一台机器上两者产物会互相覆盖
- **迁移路径**：先卸载旧包（`npx ly-workflow` 的 uninstall）再安装本包；或直接 `npx ly-workflow-codex init --force` 覆盖安装。配置 `~/.ly/config.toml` 由本包自动从旧 `~/.claude/.ly/config.toml` 迁移

## License

MIT
