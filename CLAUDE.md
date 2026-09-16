# CLAUDE.md（精简导航）

> ⚠️ **权威文档是 [AGENTS.md](./AGENTS.md)**：本仓库的开发指导、模块职责、关键设计决策以 AGENTS.md 为准；本文件只做精简导航，内容与 AGENTS.md 对齐，双向漂移时以 AGENTS.md 为准。对外说明见 [README.md](./README.md)。

**Last Updated**: 2026-09-16 (v0.2.0)

---

## 项目定位

**ly-workflow-codex**：Codex 单 Agent 工作流——同一 Codex 会话内自己完成探索 / 方案 / 实施 / 审查编排；方案审查与代码审查两个关卡以 **单审查 subagent**（非 fork spawn + 范围点名 + 主会话逐条裁决异议，软上下文经 change 目录 `context.md` 到达）执行，实施由 **coding subagent**（非 fork）执行，模型经 `codexHost.reviewModel`/`codingModel` 分别指定，非空推理档经 `reviewReasoningEffort`/`codingReasoningEffort` 随对应 spawn 传入（模型或推理档未配置/空白时回退或走宿主默认；agent 模型需额外配置，能否 spawn 由环境实际能力决定，不做清单强校验，`[codexHost] spawnableModels` 仅提示参考；`reviewModelB`/`reviewReasoningEffortB` 弃用不读取、存量值保留）。无 wrapper、无 Web UI、无 routing/implementer 概念；配置单宿主于 `~/.ly/config.toml`。它是 ly-workflow（双宿主）的 codex 单宿主独立版，关系与迁移路径见 [README.md](./README.md#与-ly-workflow-的关系)。

## 常用命令

```bash
npx ly-workflow-codex        # 交互式菜单（裸命令）
npx ly-workflow-codex init   # 全量初始化（语言 → API 提供方 → Codex 现状检测 → 模型三连 → 摘要；生成项目 AGENTS.md + openspec init + 安装 14 个命令）
lycx doctor / status         # 体检 / 安装概览
lycx uninstall               # 卸载
```

安装产物：`~/.agents/skills/lyx-*/`（14 个 `@lyx-*` skills）+ `~/.ly/prompts/codex/`（8 个角色提示词）+ `~/.ly/config.toml`（配置，自动从旧 `~/.claude/.ly/config.toml` 迁移）。

## 14 个 @lyx-* skills

| 命令 | 一句话说明 |
|------|-----------|
| `@lyx-init` | 生成项目 AGENTS.md + `openspec init` + 自动 commit |
| `@lyx-explore` | 委托 `@openspec-explore skill`（纯薄壳） |
| `@lyx-propose` | 编排入口：隔离三选一 → 全自动/手动 → `@openspec-propose skill` → 方案自审 → context.md 产出 → commit `propose:`；全自动 = review-plan → apply → review-code 流水线 |
| `@lyx-apply` | coding subagent（非 fork，经 context.md 获取软上下文）读 tasks.md 逐任务实施 + 验证 + 勾 checkbox → 回传主会话，主会话确认后回写 context.md 并 commit `apply:` |
| `@lyx-archive` | 委托 `@openspec-archive-change skill` + 自动 commit |
| `@lyx-review-plan` | 单审查 subagent（非 fork）审方案（`plan-reviewer.md`），主会话逐条裁决，驳回硬线，审查-修复循环，清零统一提交 |
| `@lyx-review-code` | 单审查 subagent（非 fork）审代码（`reviewer.md`），Critical/Warning/Info 分级，同循环 |
| `@lyx-release` | GitFlow 四场景发版 + SemVer 推导 + 上线合并二选一 |
| `@lyx-changelog` | Keep a Changelog 格式生成/更新 CHANGELOG.md |
| `@lyx-publish` | npm 包发布四场景 |
| `@lyx-commit` `@lyx-rollback` `@lyx-clean-branches` `@lyx-worktree` | Git 工具（worktree 无 `switch`） |

## 审查执行模型（速览）

- 审查关卡 = **单审查 subagent（非 fork）**：每关 spawn 1 个审查 subagent（非 fork、只携带 TASK、点名"只审 change 范围"），无第二个审查 agent、无交换结论/共识环节；每条 Critical 由主会话逐条裁决——认可即修复，不认可必须附**可核验依据**（文件/行/命令输出；泛泛"误报"视为未完成裁决，不能补足则改判认可）
- 软上下文 = **change 目录 `context.md`**：propose 产出（内容边界自检：无整段重复、决策可溯源、≤100 行）→ apply 维护（实施决策回写，只增不删）→ review-plan / review-code / coding subagent 消费（TASK 只传路径）
- **驳回硬线**（终止条件）：（a）同一 Critical 复现且再被驳回；（b）连续 2 轮对当轮全部 Critical 均不认可——命中即停转人工
- 实施 = **coding subagent**（`@lyx-apply`）：非 fork spawn（只实施 change 范围 + context.md），模型 = `codexHost.codingModel`（未配置回退当前会话模型），非空 `codingReasoningEffort` 随 spawn 传入；coding subagent 不自行 commit，实施结果回传主会话，主会话确认后回写 context.md 并统一提交 `apply: <change-name>`；环境级不可用回退当前会话直接执行，业务失败原样呈报转人工
- 模型与推理档：审查 = `codexHost.reviewModel` + 非空 `reviewReasoningEffort`；`reviewModelB`/`reviewReasoningEffortB` 弃用不读取（字段与存量值保留，doctor 输出弃用提示）；模型未配置或空白回退当前会话模型，推理档空白不传、不做枚举强校验；能否 spawn 由宿主实际报错判定（报错含 `Unknown model` / `Available models: ...` 时如实展示）；读取配置失败 → "配置状态未知"提示运行 `lycx doctor`；宿主无 subagent 能力或 spawn 失败 → 环境级不可用回退。`lycx doctor` 第 7 项"Codex 子代理模型配置"附验证某模型是否可 spawn 的示例 prompt
- 角色词绝对路径 `~/.ly/prompts/codex/{reviewer,plan-reviewer}.md` 为行为契约（角色词内容不重写）
- 完整执行约定（spawn 协议、主会话裁决与驳回硬线、修复循环、终止条件、提交时机）内联在各 skill 模板；[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED（历史参考）

## 相关文件

- [AGENTS.md](./AGENTS.md) — 开发权威文档（模块职责 / 常量 / 配置 / 设计决策 / 发版规则）
- [README.md](./README.md) — 对外用户文档（安装 / 命令表 / 架构 / 与 ly-workflow 的关系）
- [docs/codex-exec-contract.md](./docs/codex-exec-contract.md) — codex exec 调用契约（DEPRECATED，历史参考）
- [templates/CLAUDE.md](./templates/CLAUDE.md) — 模板库导航
