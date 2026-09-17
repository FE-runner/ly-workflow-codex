# CLAUDE.md（精简导航）

> ⚠️ **权威文档是 [AGENTS.md](./AGENTS.md)**：本仓库的开发指导、模块职责、关键设计决策以 AGENTS.md 为准；本文件只做精简导航，内容与 AGENTS.md 对齐，双向漂移时以 AGENTS.md 为准。对外说明见 [README.md](./README.md)。

**Last Updated**: 2026-09-16 (v0.2.0)

---

## 项目定位

**ly-workflow-codex**：Codex 单 Agent 工作流——同一 Codex 会话内自己完成探索 / 方案 / 实施 / 审查编排。审查与实施主体由 `[codexHost] reviewExecutor` / `codingExecutor` 决定：未配置等价 `main`（主 agent 直接执行，默认），显式配置 `subagent` 才 spawn 独立子代理（非 fork spawn + 范围点名；软上下文经 change 目录 `context.md` 到达），模型经 `codexHost.reviewModel`/`codingModel` 指定、非空推理档经 `reviewReasoningEffort`/`codingReasoningEffort` 随对应 spawn 传入（执行者为 `main` 时这些字段不生效，`lycx doctor` 输出 WARN）。慢验证（测试 / 类型检查 / 构建）统一由 `@lyx-archive` 的归档前关卡执行。无 wrapper、无 Web UI、无 routing/implementer 概念；配置单宿主于 `~/.codex/lyx/config.toml`（本包私有目录，与 ly-workflow 彻底解耦，不做任何自动迁移）。它是 ly-workflow（双宿主）的 codex 单宿主独立版，关系与迁移路径见 [README.md](./README.md#与-ly-workflow-的关系)。

## 常用命令

```bash
npx ly-workflow-codex        # 交互式菜单（裸命令）
npx ly-workflow-codex init   # 全量初始化（语言 → API 提供方 → Codex 现状检测 → 模型三连 → 摘要；生成项目 AGENTS.md + openspec init + 安装 14 个命令）
lycx doctor / status         # 体检 / 安装概览
lycx uninstall               # 卸载
```

安装产物：`~/.agents/skills/lyx-*/`（14 个 `@lyx-*` skills）+ `~/.codex/lyx/prompts/codex/`（8 个角色提示词）+ `~/.codex/lyx/config.toml`（配置，本包私有目录、不做任何自动迁移）。

## 14 个 @lyx-* skills

| 命令 | 一句话说明 |
|------|-----------|
| `@lyx-init` | 生成项目 AGENTS.md + `openspec init` + 自动 commit |
| `@lyx-explore` | 委托 `@openspec-explore skill`（纯薄壳） |
| `@lyx-propose` | 编排入口：隔离三选一 → 全自动/手动 → `@openspec-propose skill` → 方案自审 → context.md 产出 → commit `propose:`；全自动 = review-plan → apply → review-code 流水线 |
| `@lyx-apply` | 按 `codingExecutor` 实施（`main` = 主 agent 直接实施；`subagent` = spawn coding subagent，非 fork，经 context.md 获取软上下文）读 tasks.md 逐任务实施 + 验证 + 勾 checkbox，主会话确认后回写 context.md 并 commit `apply:` |
| `@lyx-archive` | 委托 `@openspec-archive-change skill` + 自动 commit |
| `@lyx-review-plan` | 按 `reviewExecutor` 审方案（`main` = 主 agent 直接自审，最多 2 轮；`subagent` = 单审查 subagent + 主会话逐条裁决 + 驳回硬线），清零统一提交 |
| `@lyx-review-code` | 按 `reviewExecutor` 审代码（同上），Critical/Warning/Info 分级 |
| `@lyx-release` | GitFlow 四场景发版 + SemVer 推导 + 上线合并二选一 |
| `@lyx-changelog` | Keep a Changelog 格式生成/更新 CHANGELOG.md |
| `@lyx-publish` | npm 包发布四场景 |
| `@lyx-commit` `@lyx-rollback` `@lyx-clean-branches` `@lyx-worktree` | Git 工具（worktree 无 `switch`） |

## 审查执行模型（速览）

- 审查关卡 = **执行者可切换**：`reviewExecutor = "main"`（默认）= 主 agent 直接自审，无 spawn、无逐条裁决、无驳回硬线，最多 2 轮；`reviewExecutor = "subagent"` = 每关 spawn 1 个审查 subagent（非 fork、只携带 TASK、只审 change 范围），每条 Critical 由主会话逐条裁决——认可即修复，不认可必须附**可核验依据**；subagent 路径第 2 轮起默认 `send_input` 复用同一子代理
- 软上下文 = **change 目录 `context.md`**：propose 产出（内容边界自检：无整段重复、决策可溯源、≤100 行）→ apply 维护（实施决策回写，只增不删）→ review-plan / review-code / coding subagent 消费（TASK 只传路径）
- **驳回硬线**（终止条件）：（a）同一 Critical 复现且再被驳回；（b）连续 2 轮对当轮全部 Critical 均不认可——命中即停转人工
- 实施 = **按 `codingExecutor` 切换**：`main`（默认）= 主 agent 直接实施；`subagent` = spawn coding subagent（非 fork，只实施 change 范围 + context.md），模型 = `codexHost.codingModel`。两条路径均由主会话统一提交 `apply: <change-name>`；subagent 路径环境级不可用回退主 agent，业务失败原样呈报转人工
- 模型与推理档：仅在对应执行者为 `subagent` 时生效（审查 = `reviewModel` + 非空 `reviewReasoningEffort`；实施 = `codingModel` + 非空 `codingReasoningEffort`）；执行者为 `main` 时字段不生效并由 doctor 输出 WARN；模型未配置或空白回退当前会话模型，推理档空白不传、不做枚举强校验；能否 spawn 由宿主实际报错判定（报错含 `Unknown model` / `Available models: ...` 时如实展示）；读取配置失败 → "配置状态未知"提示运行 `lycx doctor`；宿主无 subagent 能力或 spawn 失败 → 环境级不可用回退
- 角色词绝对路径 `~/.codex/lyx/prompts/codex/{reviewer,plan-reviewer}.md` 为行为契约（角色词内容不重写）
- 完整执行约定（spawn 协议、主会话裁决与驳回硬线、修复循环、终止条件、提交时机）内联在各 skill 模板；[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED（历史参考）

## 相关文件

- [AGENTS.md](./AGENTS.md) — 开发权威文档（模块职责 / 常量 / 配置 / 设计决策 / 发版规则）
- [README.md](./README.md) — 对外用户文档（安装 / 命令表 / 架构 / 与 ly-workflow 的关系）
- [docs/codex-exec-contract.md](./docs/codex-exec-contract.md) — codex exec 调用契约（DEPRECATED，历史参考）
- [templates/CLAUDE.md](./templates/CLAUDE.md) — 模板库导航
