# ly-workflow-codex

> Codex 单 Agent 工作流：同一 Codex 会话内自己完成探索 / 方案 / 实施 / 审查编排；方案审查与代码审查两个关卡由**双审查 subagent**（fork 当前会话上下文 + 范围点名 + 独立审 → 交换 → 共识）执行，实施由 **coding subagent** 执行。最大化复用 OpenSpec 原生工作流。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

## 安装

```bash
npx ly-workflow-codex        # 交互式菜单（含 openspec 依赖 preflight 检查）
npx ly-workflow-codex init   # 全量初始化（生成 AGENTS.md + openspec init）
```

- CLI 二进制名 `lycx`（子命令：`init`/`doctor`/`status`/`uninstall`，裸命令进菜单；`update` 在菜单内）
- 安装产物：14 个 `@lyx-*` skills（`SKILL.md`）→ `~/.agents/skills/lyx-*/`；8 个角色提示词 → `~/.ly/prompts/codex/`
- 配置：`~/.ly/config.toml`——首次读取/写入时自动从旧 `~/.claude/.ly/config.toml` 迁移（新位置已有配置则不覆盖）；`[codexHost] spawnableModels` 声明本机实测可 spawn 的模型清单（仅提示参考、不作候选/校验来源；未配置或空白回退内置默认 gpt-6-astra / gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna / gpt-5.5），维护方式 = 手改配置（编辑交互入口为后续增强）
- 推理档：`[codexHost] reviewReasoningEffort` / `reviewReasoningEffortB` / `codingReasoningEffort` 分别对应 `reviewModel` / `reviewModelB` / `codingModel`；非空时随对应 subagent spawn 传入 `reasoning_effort`，未配置或空白时不传（保持宿主/模型默认档）。取值不做枚举强校验，维护方式 = 手改 `~/.ly/config.toml`；init/update/menu 重写配置时保留原值
- 初始化向导采集流程：语言 → API 提供方（`~/.codex/config.toml` 现有 `[model_providers.*]` / OpenAI 官方 / 自定义）→ **Codex 现状检测（只读**：主会话模型 `~/.codex/config.toml` 顶层 `model` / provider 条目 / `~/.codex/models.json` 注册规模）→ 模型三连（候选 = **默认继承当前会话模型（留空）** + **自定义输入**（可输入任意模型名，不做清单限制） + 既有值（若有，默认该项），不以 provider `/models` 或任何内置/维护清单为候选来源；agent 模型需额外配置，能否 spawn 由环境实际能力决定）→ 配置摘要（三模型各自状态）；推理档不进入向导提问

## 命令（14 个 `@lyx-*` skills）

| 命令 | 用途 |
|------|------|
| `@lyx-init` | 生成项目 AGENTS.md + 初始化 OpenSpec 目录结构 + 自动 commit |
| `@lyx-explore` | 想清楚再动手（委托 `@openspec-explore skill`），收敛到方案时提示转 `@lyx-propose` |
| `@lyx-propose` | 创建方案前问一次隔离方式（三选一：隔离 worktree【从当前分支 HEAD 切出、同会话 cd 续跑，续接命令为异常兜底】/ 本项目切新分支【仅分支隔离，脏改动三选处置】/ 留在当前分支）+ 问"全自动/手动" → 委托 `@openspec-propose skill` → 方案自审（四项检查 + 逐项结论清单；机械断链直接修、业务判断类问用户）→ commit `propose: <change>`；全自动 = review-plan → apply → review-code 流水线，手动 = 逐步确认 |
| `@lyx-apply` | **coding subagent 实施**：spawn coding subagent（fork 当前上下文 + 只实施 change 范围，模型按 `codingModel`、非空推理档按 `codingReasoningEffort` 指定）读 tasks.md 逐任务实施 + 验证 + 勾 checkbox → 回传主会话，主会话确认后统一 commit `apply: <change>`；环境级不可用回退当前会话，业务失败转人工 |
| `@lyx-archive` | 归档完成的 change（委托 `@openspec-archive-change skill`）+ 自动 commit |
| `@lyx-review-plan` | 审方案：**双审查 subagent**（角色词 `plan-reviewer.md`，fork 上下文 + 范围点名，模型按 `reviewModel`/`reviewModelB`、非空推理档按 `reviewReasoningEffort`/`reviewReasoningEffortB` 分别指定）分级审查，独立审→交换→共识，分歧主会话拍板；审查-修复循环直到 Critical 清零或触发终止条件（全局轮数上限 5，清零优先），清零统一提交修复 |
| `@lyx-review-code` | 审代码：同上（角色词 `reviewer.md`），Critical/Warning/Info 分级 |
| `@lyx-release` | GitFlow 四场景发版（feature/release/hotfix/dev-offline），SemVer 自动推导版本号；上线合并二选一（远端 PR 默认 / 本地直接合并）+ 主分支名检测（master/main） |
| `@lyx-changelog` | 按 commit 前缀分组生成/更新 Keep a Changelog 格式的 CHANGELOG.md |
| `@lyx-publish` | npm 包发布四场景（bmc 私域 Nexus / GitHub Packages / npmjs + GitHub Release / CI 自动发布），前置检查→版本号推导→构建→发布→验证 |
| `@lyx-commit` `@lyx-rollback` `@lyx-clean-branches` `@lyx-worktree` | Git 工具（worktree 只留 `add`/`list`/`remove`/`prune`/`migrate`，`switch` 已移除——隔离切换统一由 `@lyx-propose` 触发） |

审查-修复循环细节（增量传递、沿用同一批审查 subagent、终止条件、提交时机）内联在各 skill 模板（`@lyx-review-plan` / `@lyx-review-code`）；[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED，仅作历史参考。

## 典型工作流

```
@lyx-init
@lyx-propose "要做什么"    # 隔离三选一 + 全自动/手动
@lyx-review-plan            # 审方案（双审查 subagent）
@lyx-apply                  # coding subagent 实施 + 主会话统一 commit
@lyx-review-code            # 审代码（双审查 subagent）
@lyx-archive
```

## 架构

- **codex 单 Agent 编排**：当前 Codex 会话完成探索 → 方案 → 自审 → 实施 → 修复的全部编排；无 wrapper、无 Web UI、无 routing/implementer 后端选择
- **审查关卡 = 双审查 subagent**：每关 spawn 2 个审查 subagent（fork 当前会话上下文 + 任务点名"只审 change 范围"），各自独立审 → 交换结论 → 达成共识；意见分歧 → 主会话拍板并显式提示用户，不能确认 → 判定 Critical；模型按 `codexHost.reviewModel`/`reviewModelB` 分别指定（未配置回退当前会话模型）；角色词绝对路径 `~/.ly/prompts/codex/` 为行为契约
- **apply = coding subagent 实施**：spawn 一个 coding subagent（fork 当前上下文 + 只实施 change 范围），模型 = `codexHost.codingModel`；coding subagent 不自行 commit，结果回传主会话，由主会话确认后统一提交 `apply: <change-name>`；环境级不可用回退当前会话直接实施，业务失败原样呈报转人工
- **agent 模型与推理档需额外配置（不做清单强校验）**：review-plan / review-code / apply 三模板按"模板指示 + 宿主能力"落实模型与推理档——模型 = 对应配置字段，未配置或空白 → 继承当前会话模型；推理档 = `reviewReasoningEffort`/`reviewReasoningEffortB`/`codingReasoningEffort`，仅在非空时随对应 spawn 传入 `reasoning_effort`，空白不传，取值不做枚举强校验；能否 spawn 由运行环境实际能力决定，以宿主 spawn 报错为准（报错含 `Unknown model ... Available models: ...` 时如实展示并提示改用可用模型）；读取配置失败 → "配置状态未知"提示运行 `lycx doctor`；宿主无 subagent 能力或初始 spawn 失败 → 按环境级不可用回退。`lycx doctor` 含"Codex 子代理模型配置"提示检查项（模型留空 OK / 已配置 OK；三个推理档仅展示；`spawnableModels` 格式非法输出 WARN），并附验证某模型是否可 spawn 的示例 prompt
- **发布**：打 tag `v*.*.*` push 触发 GitHub Actions 自动发 npm 包；无独立二进制构建步骤
- **生命周期**：直接委托 OpenSpec 原生 skills（`@openspec-explore` / `@openspec-propose` / `@openspec-apply-change` / `@openspec-archive-change`），安装器只负责 preflight（openspec CLI + openspec-* skills 检测）与安装

## 与 ly-workflow 的关系

- **ly-workflow**（上游原仓库）是双宿主工具（claude + codex）；**ly-workflow-codex** 是它的 codex 单宿主独立版：砍掉 claude 宿主、wrapper、Web UI、routing 概念，审查/实施改为 **subagent 多 Agent 模式**（双审查 subagent + coding subagent，执行约定内联在各 skill 模板）
- **安装位与旧包（v0.2.0 前）不再冲突**：本包命令以 `@lyx-*` skills 安装在 `~/.agents/skills/lyx-*/`（Codex 官方 skill 发现目录），与 ly-workflow 的 codex 分支产物（`~/.codex/prompts/ly-*.md`）互不覆盖；`~/.codex/prompts/ly-*.md` 旧残留由本包 init/uninstall 自动清理
- **迁移路径**：先卸载旧包（`npx ly-workflow` 的 uninstall）再安装本包；或直接 `npx ly-workflow-codex init --force` 覆盖安装（同时清理旧安装位残留）。配置 `~/.ly/config.toml` 由本包自动从旧 `~/.claude/.ly/config.toml` 迁移

## License

MIT
