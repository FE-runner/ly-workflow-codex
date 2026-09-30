# ly-workflow-codex

[English](./README.md) | [简体中文](./README.zh-CN.md)

> **Codex 与 Claude Code** 双宿主单 Agent 工作流：同一会话内自己完成探索 / 方案 / 实施 / 审查编排，两个宿主共享同一套命令流程。审查与实施主体由当前宿主的 `[host] reviewExecutor` / `codingExecutor` 决定——未配置等价 `main`（主 agent 直接执行，默认），显式配置 `subagent` 才 spawn 独立子代理（非 fork + 范围点名；软上下文经 change 目录 `context.md` 到达）。慢验证（测试 / 类型检查 / 构建）统一由 `@lyx-archive` 的归档前关卡执行一次。最大化复用 OpenSpec 原生工作流。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

## 安装

```bash
npx ly-workflow-codex        # 交互式菜单（含 openspec 依赖 preflight 检查）
npx ly-workflow-codex init   # 选择宿主并安装 14 个 skills + 配置；OpenSpec 默认 check-only
npx ly-workflow-codex init --init-openspec  # 宿主确认后，为所选宿主初始化当前项目 OpenSpec root/skills
lycx init --skip-prompt --host claude       # 非交互，只装指定宿主
```

- CLI 二进制名 `lycx`（子命令：`init`/`doctor`/`status`/`uninstall`/`openspec inspect|ensure`，均支持 `--host <codex,claude>`，缺省 = 全部已安装宿主；裸命令进菜单；`update` 在菜单内）
- 安装产物与配置：见下方「宿主」一节
- 配置：每宿主一个文件（`~/.codex/lyx/config.toml` / `~/.claude/lyx/config.toml`，文件存在即该宿主已安装；本包私有目录，不做任何自动迁移）；`[host] spawnableModels`（仅 codex） 声明本机实测可 spawn 的模型清单（仅提示参考、不作候选/校验来源；未配置或空白回退内置默认 gpt-6-astra / gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna / gpt-5.5）；执行者 / 模型 / 推理档已有交互入口（`lycx init` 与菜单"配置执行者与模型"），`spawnableModels` 的维护方式 = 手改配置（尚无交互入口）
- 执行者与推理档：`[host] reviewExecutor` / `codingExecutor`（取值 `main` / `subagent`，未配置等价 `main`）决定审查与实施由谁执行；`reviewReasoningEffort` / `codingReasoningEffort` 分别对应 `reviewModel` / `codingModel`，仅在对应执行者为 `subagent` 且值非空时随 spawn 传入 `reasoning_effort`。执行者为 `main` 时模型与推理档字段不生效，`lycx doctor` 输出 WARN。取值不做枚举强校验；交互 init / 菜单可选择"不覆盖（继承默认）"或覆盖指定档位，非交互 update 保留原值
- 初始化向导采集流程：语言 → **宿主多选**（默认按已安装宿主与 `~/.codex` / `~/.claude` 是否存在勾选）→ 逐宿主采集：**两个宿主同一采集面 = 执行者二连 → 模型二连 → 推理档二连**（模型候选 = **默认继承当前会话模型（留空）** + **自定义输入** + 既有值；推理档候选 = **不覆盖（继承默认）** + 该宿主建议档位 + 自定义输入 + 既有值，codex = minimal/low/medium/high/max、Claude Code = low/medium/high/xhigh/max；不以 provider `/models` 或任何内置/维护清单为候选来源）→ 配置摘要；**Codex 额外前置**：API 提供方（`~/.codex/config.toml` 现有 `[model_providers.*]` / OpenAI 官方 / 自定义）→ **Codex 现状检测（只读**：主会话模型 `~/.codex/config.toml` 顶层 `model` / provider 条目 / `~/.codex/models.json` 注册规模）。Claude Code 侧仍不采集、不写入其自身的 provider / settings 配置
- 菜单"配置执行者与模型"：按宿主选择后走与 `lycx init` 相同的采集面（执行者二连 → 模型二连 → 推理档二连）；未触碰字段保留既有值，写回后按当前配置重渲染产物（Claude Code 同时重渲子代理定义）

## 宿主

| | Codex | Claude Code |
|---|---|---|
| 调用写法 | `@lyx-<command>` | `/lyx-<command>` |
| 命令产物 | `~/.agents/skills/lyx-*/SKILL.md` | `~/.claude/skills/lyx-*/SKILL.md` |
| 角色词 / 子代理 | `~/.codex/lyx/prompts/codex/`（ROLE_FILE） | `~/.claude/agents/lyx-{plan-reviewer,reviewer,implementer}.md`（始终安装） |
| 配置 | `~/.codex/lyx/config.toml` | `~/.claude/lyx/config.toml` |
| 子代理模型 / 推理档 | 按 `[host]` 取值随每次 spawn 传入 | 渲染进子代理定义（未配置 = `model: inherit`）；配置改动后 `lycx doctor` 提示偏差，`lycx update` 重渲染 |

- **两个宿主都有两条审查路径**：`main`（默认）= 主 agent 直接审查 / 实施，保留完整语义（分级、Critical 清零准出、自审最多 2 轮、快照留痕）；`subagent`（可选）= 非 fork 独立子代理。Claude Code 侧用 `Agent` 工具调用自定义子代理、`SendMessage` 续跑；交互模式默认后台运行，"等待"语义为"结果必须被消费并如实报告"，不冒充本轮同步阻塞。子代理不可用时输出 `[回退] subagent 不可用: <原始报错>` 并回退主 agent。
- **宿主边界**：共享安装层只认适配器接口与宿主注册表，宿主专属内容在 `src/hosts/<id>/` 与 `templates/hosts/<id>/`。lyx 不写 Claude Code 自身的 provider / settings；卸载不触碰 OpenSpec 自有产物（`.claude/commands/opsx/`、`.claude/skills/openspec-*`）与共用的 `~/.ly/worktrees/`。
- **Claude Code 下的 `@lyx-init`** 额外产出导入 `AGENTS.md` 的 `CLAUDE.md`（`@AGENTS.md`）——Claude Code 仅在项目无 `CLAUDE.md` 时读取 `AGENTS.md`。
- 下文的 `@lyx-<command>` 是命令标识；在 Claude Code 中请用 `/lyx-<command>`。

## 命令（14 个 `@lyx-*` skills）

| 命令 | 用途 |
|------|------|
| `@lyx-init` | 生成项目 AGENTS.md + 初始化 OpenSpec 目录结构 + 自动 commit |
| `@lyx-explore` | 想清楚再动手（委托 `@openspec-explore skill`）；委托前扫描 `review-findings.md` 审查未修项快照，有命中则**先询问**再列出；收敛到方案时提示转 `@lyx-propose` |
| `@lyx-propose` | 创建方案前问一次隔离方式（三选一：隔离 worktree【从当前分支 HEAD 切出、同会话 cd 续跑，续接命令为异常兜底】/ 本项目切新分支【仅分支隔离，脏改动三选处置】/ 留在当前分支）+ 问"全自动/手动" → 委托 `@openspec-propose skill` → 记录 sourceBranch/developmentBranch/worktreePath metadata → 方案自审（四项检查 + 逐项结论清单；机械断链直接修、业务判断类问用户）→ commit `propose: <change>`；全自动 = review-plan → apply → review-code 流水线，手动 = 逐步确认 |
| `@lyx-apply` | **按 `codingExecutor` 实施**：`main`（默认）= 主 agent 直接读 tasks.md 逐任务实施 + 验证 + 勾 checkbox；`subagent` = spawn coding subagent（非 fork，经 context.md 获取软上下文 + 只实施 change 范围，模型按 `codingModel`）。两条路径均由主会话确认后回写 context.md 并统一 commit `apply: <change>`；subagent 路径环境级不可用回退主 agent，业务失败转人工 |
| `@lyx-archive` | 归档完成的 change（委托 `@openspec-archive-change skill`）+ 自动 commit + 按 isolation metadata 提示合并回 sourceBranch、清理 worktree/开发分支 |
| `@lyx-review-plan` | 审方案：按 `reviewExecutor` 决定主体——`main`（默认）= 主 agent 直接自审，无逐条裁决 / 驳回硬线，最多 2 轮；`subagent` = 单审查 subagent（角色词 `plan-reviewer.md`，非 fork + context.md 路径引用，模型按 `reviewModel`）分级审查 + 主会话逐条裁决，循环直到 Critical 清零或触发终止条件（全局轮数上限 5，清零优先）。清零统一提交修复；循环结束后写 `review-findings.md` 的 `## 方案审查` 节（只收 Warning） |
| `@lyx-review-code` | 审代码：同上（角色词 `reviewer.md`），Critical/Warning/Info 分级；循环结束后写 `review-findings.md` 的 `## 代码审查` 节（只收 Warning） |
| `@lyx-release` | GitFlow 四场景发版（feature/release/hotfix/dev-offline），SemVer 自动推导版本号；上线合并二选一（远端 PR 默认 / 本地直接合并）+ 主分支名检测（master/main） |
| `@lyx-changelog` | 按 commit 前缀分组生成/更新 Keep a Changelog 格式的 CHANGELOG.md |
| `@lyx-publish` | npm 包发布四场景（bmc 私域 Nexus / GitHub Packages / npmjs + GitHub Release / CI 自动发布），前置检查→版本号推导→构建→发布→验证 |
| `@lyx-commit` `@lyx-rollback` `@lyx-clean-branches` `@lyx-worktree` | Git 工具（worktree 只留 `add`/`list`/`remove`/`prune`/`migrate`，`switch` 已移除——隔离切换统一由 `@lyx-propose` 触发） |

审查-修复循环细节（执行者分支、subagent 路径的 `send_input` 复用与增量传递、终止条件、提交时机）内联在各 skill 模板（`@lyx-review-plan` / `@lyx-review-code`）；[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED，仅作历史参考。

## 典型工作流

```
@lyx-init
@lyx-propose "要做什么"    # 隔离三选一 + 全自动/手动
@lyx-review-plan            # 审方案（单审查 subagent，非 fork）
@lyx-apply                  # coding subagent 实施 + 主会话统一 commit
@lyx-review-code            # 审代码（单审查 subagent，非 fork）
@lyx-archive
```

## 架构

- **任一宿主的单 Agent 编排**：当前 Codex 或 Claude Code 会话完成探索 → 方案 → 自审 → 实施 → 修复的全部编排；无 wrapper、无 Web UI、无 routing/implementer 后端选择
- **审查关卡 = 执行者可切换**：`reviewExecutor = "main"`（默认）= 主 agent 直接自审，不 spawn、无逐条裁决与驳回硬线，最多 2 轮；`reviewExecutor = "subagent"` = 每关 spawn 1 个审查 subagent（非 fork、只携带 TASK + 只审 change 范围），软上下文经 `context.md` 到达，每条 Critical 由主会话逐条裁决（不认可须附可核验依据），驳回硬线（同一 Critical 复现再驳回 / 连续 2 轮全驳回）即停转人工；subagent 路径第 2 轮起默认 `send_input` 复用同一子代理，复用失败才重新 spawn
- **审查未修项快照 = `review-findings.md`**（快照式留痕，供事后回看，不是待办台账）：review-plan / review-code 循环结束时按节 upsert 写入最后一轮的 **Warning**（不收 Info / Critical），条目连续编号作为稳定锚点；正常清零时在统一 commit **之后**写入（保持未跟踪），随 `@lyx-archive` 的 `git add -- openspec/` 落库并搬入归档目录。`@lyx-commit --all` 与 propose WIP commit 的全量暂存以 `':/' ':(top,exclude,glob)openspec/changes/*/review-findings.md'` 排除进行中快照；该文件也不进入审查范围与中间提交。`@lyx-explore` 扫描到快照时先询问再列出，并显示已标注解决、未复审、复审未通过的条数。后续 change 解决历史 Warning 时，在 `proposal.md` 的 `## 解决的审查未修项` 声明锚点，由 `@lyx-archive` 追加解决说明（原文不改、幂等、失败不阻断归档）；**同一 change 内**修复的 Warning 在 active 快照就地标注 `- 解决：本 change 内修复（未复审，commit <短 hash>）— …`（审查后同会话修复并提交后标注，或 `@lyx-archive` 归档前核对、用户逐条确认后标注；必带 commit hash、不新增提交）；对已有解决说明的条目做复审时，在 `proposal.md` 的 `## 复审的审查未修项` 声明锚点与结论（`成立` / `不成立`），由 `@lyx-archive` 追加 `- 复审：…` 子项（以最后一条为准）
- **apply = 执行者可切换**：`codingExecutor = "main"`（默认）= 主 agent 直接实施；`codingExecutor = "subagent"` = spawn coding subagent（非 fork + 只实施 change 范围 + 经 context.md 获取软上下文）。两条路径均由主会话统一提交 `apply: <change-name>`
- **agent 模型与推理档需额外配置（不做清单强校验）**：review-plan / review-code / apply 三模板按"模板指示 + 宿主能力"落实模型与推理档——模型 = 对应配置字段，未配置或空白 → 继承当前会话模型；推理档 = `reviewReasoningEffort`/`codingReasoningEffort`，仅在非空时随对应 spawn 传入 `reasoning_effort`，空白不传，取值不做枚举强校验；交互 init / 菜单可显式选择不覆盖（清除字段）或覆盖指定档位，非交互 update 保留原值。能否 spawn 由运行环境实际能力决定，以宿主 spawn 报错为准（报错含 `Unknown model ... Available models: ...` 时如实展示并提示改用可用模型）；读取配置失败 → "配置状态未知"提示运行 `lycx doctor`；宿主无 subagent 能力或初始 spawn 失败 → 按环境级不可用回退。`lycx doctor` 按宿主分组输出，codex 宿主含"Codex 子代理模型配置"提示检查项（模型留空 OK / 已配置 OK；两个推理档展示"未覆盖 / 已覆盖"；`spawnableModels` 格式非法输出 WARN），并附验证某模型是否可 spawn 的示例 prompt
- **发布**：打 tag `v*.*.*` push 触发 GitHub Actions 自动发 npm 包；无独立二进制构建步骤
- **生命周期**：直接委托 OpenSpec 原生 skills（按宿主：`openspec init --tools codex|claude`；skills 在各宿主自己的技能根里判定，只为缺失的宿主补齐）（`@openspec-explore` / `@openspec-propose` / `@openspec-apply-change` / `@openspec-archive-change`）；`lycx init` / `@lyx-init` / `lycx doctor` 共用同一 OpenSpec 三层检查（CLI + 按 profile 推导的 skills + `openspec doctor --json` root 健康）。`lycx init` 默认只诊断、不写当前项目；`--init-openspec` 或 `@lyx-init` 才执行项目级修复。skills 仅全局可用时输出 `global-only` WARN 并继续

## License

MIT
