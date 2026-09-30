# CLAUDE.md（精简导航）

> ⚠️ **权威文档是 [AGENTS.md](./AGENTS.md)**：本仓库的开发指导、模块职责、关键设计决策以 AGENTS.md 为准；本文件只做精简导航，内容与 AGENTS.md 对齐，双向漂移时以 AGENTS.md 为准。对外说明见 [README.md](./README.md)。

**Last Updated**: 2026-09-30 (v0.6.1 + add-claude-host)

---

## 项目定位

**ly-workflow-codex**：Codex / Claude Code 双宿主单 Agent 工作流——同一会话内自己完成探索 / 方案 / 实施 / 审查编排，两个宿主共享同一套命令流程（codex 调用写法 `@lyx-*`，Claude Code 为 `/lyx-*`）。审查与实施主体由当前宿主配置的 `[host] reviewExecutor` / `codingExecutor` 决定：未配置等价 `main`（主 agent 直接执行，默认），显式配置 `subagent` 才 spawn 独立子代理（非 fork spawn + 范围点名；软上下文经 change 目录 `context.md` 到达），模型经 `[host] reviewModel`/`codingModel` 指定、非空推理档经 `reviewReasoningEffort`/`codingReasoningEffort` 落实（codex 随对应 spawn 传入；Claude Code 渲染进 `~/.claude/agents/lyx-*.md`，未配置为 `model: inherit`）（执行者为 `main` 时这些字段不生效，`lycx doctor` 输出 WARN）。慢验证（测试 / 类型检查 / 构建）统一由 `@lyx-archive` 的归档前关卡执行。无 wrapper、无 Web UI、无 routing/implementer 概念；配置每宿主一个文件（`~/.codex/lyx/config.toml` / `~/.claude/lyx/config.toml`，文件存在即已安装；历史 `[codexHost]` 节兼容读取；本包私有目录，不做任何自动迁移）。代码按宿主包组织：共享层 `src/utils/` 只认适配器接口与注册表，宿主专属内容在 `src/hosts/<id>/` 与 `templates/hosts/<id>/`。对外说明见 [README.md](./README.md) 与 [README.zh-CN.md](./README.zh-CN.md)。

## 常用命令

```bash
npx ly-workflow-codex        # 交互式菜单（裸命令）
npx ly-workflow-codex init   # 选择宿主并安装 14 个 skills + 配置；OpenSpec 默认 check-only（不写当前项目）
npx ly-workflow-codex init --init-openspec  # 宿主确认后为所选宿主初始化当前项目 OpenSpec root/skills
lycx doctor / status [--host <hosts>]       # 体检 / 安装概览（按宿主分组）
lycx openspec inspect --json [--host ...]  # 只读 OpenSpec 三层检查（skills 按宿主判定）
lycx openspec ensure --json [--host ...]   # 修复 OpenSpec CLI/skills/root（按宿主传 --tools）
lycx uninstall [--host <hosts>]             # 按宿主卸载（缺省 = 全部已安装宿主）
```

安装产物（按宿主）：codex = `~/.agents/skills/lyx-*/`（14 个 skills）+ `~/.codex/lyx/prompts/codex/`（审查角色词）+ `~/.codex/lyx/config.toml`；claude = `~/.claude/skills/lyx-*/`（14 个 skills）+ `~/.claude/agents/lyx-*.md`（3 个子代理定义）+ `~/.claude/lyx/config.toml`。本包私有目录，不做任何自动迁移；lyx 不写 Claude Code 自身的 provider / settings，卸载不碰 OpenSpec 自有产物。

## 14 个 @lyx-* skills

| 命令 | 一句话说明 |
|------|-----------|
| `@lyx-init` | 生成项目 AGENTS.md（Claude Code 下额外产出导入它的 `CLAUDE.md`）+ `lycx openspec ensure --host <当前宿主>`（共享 CLI/skills/root 修复）+ 自动 commit |
| `@lyx-explore` | 委托 `@openspec-explore skill`；委托前扫描 `review-findings.md` 审查未修项快照，有命中则先询问是否列出（纯薄壳 + 一次快照询问） |
| `@lyx-propose` | 编排入口：隔离三选一 → 全自动/手动 → `@openspec-propose skill` → 记录 isolation metadata → 方案自审 → context.md 产出 → commit `propose:`；全自动 = review-plan → apply → review-code 流水线 |
| `@lyx-apply` | 按 `codingExecutor` 实施（`main` = 主 agent 直接实施；`subagent` = spawn coding subagent，非 fork，经 context.md 获取软上下文）读 tasks.md 逐任务实施 + 验证 + 勾 checkbox，主会话确认后回写 context.md 并 commit `apply:` |
| `@lyx-archive` | 委托 `@openspec-archive-change skill` + 自动 commit + 按 isolation metadata 提示合并回 sourceBranch、清理 worktree/开发分支 |
| `@lyx-review-plan` | 按 `reviewExecutor` 审方案（`main` = 主 agent 直接自审，最多 2 轮；`subagent` = 单审查 subagent + 主会话逐条裁决 + 驳回硬线），清零统一提交；循环结束后写 `review-findings.md` 的 `## 方案审查` 节（只收 Warning） |
| `@lyx-review-code` | 按 `reviewExecutor` 审代码（同上），Critical/Warning/Info 分级；循环结束后写 `review-findings.md` 的 `## 代码审查` 节（只收 Warning） |
| `@lyx-release` | GitFlow 四场景发版 + SemVer 推导 + 上线合并二选一 |
| `@lyx-changelog` | Keep a Changelog 格式生成/更新 CHANGELOG.md |
| `@lyx-publish` | npm 包发布四场景 |
| `@lyx-commit` `@lyx-rollback` `@lyx-clean-branches` `@lyx-worktree` | Git 工具（worktree 无 `switch`） |

## 审查执行模型（速览）

- 审查关卡 = **执行者可切换**（两个宿主语义一致；子代理机制按宿主：codex = spawn + `send_input`，Claude Code = `Agent` 工具调用 `lyx-*` 自定义子代理 + `SendMessage`，交互模式后台运行时等待语义为"结果被消费并如实报告"）：`reviewExecutor = "main"`（默认）= 主 agent 直接自审，无 spawn、无逐条裁决、无驳回硬线，最多 2 轮；`reviewExecutor = "subagent"` = 每关 spawn 1 个审查 subagent（非 fork、只携带 TASK、只审 change 范围），每条 Critical 由主会话逐条裁决——认可即修复，不认可必须附**可核验依据**；subagent 路径第 2 轮起默认 `send_input` 复用同一子代理
- 软上下文 = **change 目录 `context.md`**：propose 产出（内容边界自检：无整段重复、决策可溯源、≤100 行）→ apply 维护（实施决策回写，只增不删）→ review-plan / review-code / coding subagent 消费（TASK 只传路径）
- 审查未修项快照 = **change 目录 `review-findings.md`**（快照式留痕，非台账）：review-plan / review-code 循环结束时按节 upsert 写入最后一轮 **Warning**（不收 Info / Critical），Warning 条目连续编号；正常清零在统一 commit **之后**写（保持未跟踪），随 `@lyx-archive` 的 `git add -- openspec/` 落库并搬入 `archive/`；`@lyx-explore` 进入时扫描并**先询问后列出**（含已标注解决条数）；该文件被排除在审查范围与中间 commit 之外。历史 Warning 被后续 change 解决时，在新 change 的 `proposal.md` 用 `## 解决的审查未修项` 声明锚点，由 `@lyx-archive` 向已归档快照追加追加式解决说明（原文不改、幂等、失败不阻断归档）
- **驳回硬线**（终止条件）：（a）同一 Critical 复现且再被驳回；（b）连续 2 轮对当轮全部 Critical 均不认可——命中即停转人工
- 实施 = **按 `codingExecutor` 切换**：`main`（默认）= 主 agent 直接实施；`subagent` = spawn coding subagent（非 fork，只实施 change 范围 + context.md），模型 = `[host] codingModel`。两条路径均由主会话统一提交 `apply: <change-name>`；subagent 路径环境级不可用回退主 agent，业务失败原样呈报转人工
- 模型与推理档：仅在对应执行者为 `subagent` 时生效（审查 = `reviewModel` + 非空 `reviewReasoningEffort`；实施 = `codingModel` + 非空 `codingReasoningEffort`）；执行者为 `main` 时字段不生效并由 doctor 输出 WARN；模型未配置或空白回退当前会话模型，推理档空白不传、不做枚举强校验；交互 init / 菜单可选择不覆盖（清除字段）或覆盖指定档位，非交互 update 保留原值；能否 spawn 由宿主实际报错判定（报错含 `Unknown model` / `Available models: ...` 时如实展示）；读取配置失败 → "配置状态未知"提示运行 `lycx doctor`；宿主无 subagent 能力或 spawn 失败 → 环境级不可用回退
- 角色设定来源按宿主：codex 角色词绝对路径 `~/.codex/lyx/prompts/codex/{reviewer,plan-reviewer}.md` 为行为契约（角色词内容不重写）；Claude Code 为子代理定义正文，产物中不出现 codex 角色词路径
- 完整执行约定（spawn 协议、主会话裁决与驳回硬线、修复循环、终止条件、提交时机）内联在各 skill 模板；[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED（历史参考）

## 相关文件

- [AGENTS.md](./AGENTS.md) — 开发权威文档（模块职责 / 常量 / 配置 / 设计决策 / 发版规则）
- [README.md](./README.md) / [README.zh-CN.md](./README.zh-CN.md) — 对外用户文档（安装 / 命令表 / 架构）
- [docs/codex-exec-contract.md](./docs/codex-exec-contract.md) — codex exec 调用契约（DEPRECATED，历史参考）
- [templates/CLAUDE.md](./templates/CLAUDE.md) — 模板库导航（共享正文 `skills/` + 宿主片段 / 角色词 / 子代理定义 `hosts/<id>/`）
