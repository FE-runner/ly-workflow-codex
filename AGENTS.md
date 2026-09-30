# ly-workflow-codex

> 多宿主（Codex / Claude Code）单 Agent 工作流：同一会话内自己完成聊天 / 分析 / 规划 / 实施，两个宿主共享同一套命令流程。审查与实施主体由当前宿主配置文件的 `[host] reviewExecutor` / `codingExecutor` 决定（未配置等价 `main` = 主 agent 直接执行；`subagent` = spawn 独立子代理，非 fork spawn + 主会话逐条裁决异议）；慢验证统一由 `@lyx-archive` 的归档前关卡执行。执行约定内联于各 skill 模板（[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED）。

**Last Updated**: 2026-09-30 (v0.7.0)

---

## 语言

- 始终用中文（zh）回复用户，包括解释性文字、文档、注释；技术术语、代码标识符、命令、报错原文保持原样（可用英文）。

## 项目定位

**ly-workflow-codex** 是 ly-workflow 的单 Agent 独立版，支持 **codex** 与 **claude**（Claude Code）两个宿主：无 wrapper、无 Web UI、无 routing/implementer 概念。单 Agent 模式 = 同一会话内自己 propose/review/apply；审查与实施主体由当前宿主配置的 `[host] reviewExecutor`/`codingExecutor` 决定（未配置等价 `main` = 主 agent 直接执行；`subagent` = 独立子代理，非 fork + 范围点名，软上下文经 change 目录 `context.md` 到达），模型字段 `reviewModel`/`codingModel` 仅在对应执行者为 `subagent` 时生效。执行约定内联于各 skill 模板，命令模板 / 宿主片段 / 子代理定义结构见 [templates/CLAUDE.md](./templates/CLAUDE.md)。

**宿主边界**：共享层（`src/utils/` 的安装、配置读写、前置检查）只认适配器接口与宿主注册表，不出现任何宿主名与宿主路径；宿主专属知识（路径、模板渲染、附加产物、体检项、卸载清单）全部在 `src/hosts/<id>/`。新增宿主 = 新增宿主包 + 模板片段 + 注册表登记。

## 包级常量

`src/utils/package-meta.ts` 只保留包级常量：`PACKAGE_NAME`（`ly-workflow-codex`）、`BIN_NAME`（`lycx`）、`ISSUES_URL`。宿主路径常量在各宿主包：

| 宿主 | 常量（文件） | 值 |
|------|-------------|-----|
| codex | `AGENTS_SKILLS_DIR`（`src/hosts/codex/paths.ts`） | `~/.agents/skills`（命令安装为 `lyx-*/SKILL.md`） |
| codex | `LY_DIR` / `CONFIG_FILE` / `PROMPTS_DIR` | `~/.codex/lyx` / `~/.codex/lyx/config.toml` / `~/.codex/lyx/prompts`（角色词子目录 `codex/`） |
| codex | `CODE_PROMPTS_DIR` | `~/.codex/prompts`（v0.2.0 前旧安装位，仅用于升级残留清理） |
| claude | `CLAUDE_SKILLS_DIR`（`src/hosts/claude/paths.ts`） | `~/.claude/skills`（命令安装为 `lyx-*/SKILL.md`） |
| claude | `CLAUDE_AGENTS_DIR` | `~/.claude/agents`（子代理定义 `lyx-*.md`） |
| claude | `CLAUDE_LY_DIR` / `CLAUDE_CONFIG_FILE` | `~/.claude/lyx` / `~/.claude/lyx/config.toml` |

## 模块职责

```
bin/lycx.mjs                 CLI 入口（import dist/cli.mjs）
src/cli.ts                   cac CLI 定义
src/cli-setup.ts             子命令注册（默认菜单 / init / doctor / status / uninstall / openspec，
                             均支持 --host）、i18n 初始化、preflight 挂钩
src/index.ts                 包公共出口（types + 主入口；getConfigPath/getLyDir/getLyPromptsDir 为
                             deprecated 无参形态，固定指向 codex；新增按宿主取值的 getHost* 函数）

src/commands/
  init.ts                    初始化向导：语言 → 宿主多选（默认 = 已安装 ∪ 探测到）→ 逐宿主采集
                             （codex：API 提供方 → 现状检测 → 执行者二连 → 模型/推理档；
                              claude：只采集执行者二连）→ 摘要 → 逐宿主写配置 + 安装；
                             非交互按"已安装 → 探测 → 兜底 codex"决定宿主；--init-openspec 的
                             写入型修复在宿主确认之后执行
  menu.ts                    交互式菜单（按宿主展示；更新 / 配置执行者与模型 / 卸载可选宿主）
  doctor.ts                  doctor / status：通用项 + 按宿主分组的适配器体检项
  update.ts                  按宿主决策：版本落后重装 / 定义偏差本地重渲染 / 跳过；按宿主备份回滚
  uninstall.ts               卸载宿主集合解析、确认范围描述、结果输出
  openspec.ts                lycx openspec inspect|ensure --host

src/hosts/                   宿主包（代码侧自包含；模板在顶层 templates/hosts/<id>/）
  codex/  adapter.ts         适配器：片段注入 + 历史占位符兼容渲染、角色词安装与 ROLE_FILE 校验、
                             旧安装位残留清理、update 备份清单
          doctor.ts          命令 / 角色词 / 子代理模型配置体检（assessSubagentModelConfig）
          paths.ts schema.ts 路径常量；历史配置节名 codexHost、SPAWNABLE_MODELS_DEFAULT
          provider.ts        采集 ~/.codex/config.toml 的 [model_providers.*]（init 向导数据源）
          legacy-cleanup.ts  codex 侧旧包残留清理（AGENTS.md LY 区块、config.toml 旧区块、旧 agents）
  claude/ adapter.ts         适配器：片段注入 + @lyx-→/lyx-、@openspec-→openspec- 改写、
                             子代理定义安装（始终安装，按配置渲染 model/effort）
          doctor.ts          命令 / 子代理定义体检、执行者与模型来源展示、定义偏差检测
          paths.ts           路径常量

src/utils/                   共享层（不出现宿主名与宿主路径）
  host-adapters.ts           HostAdapter 接口 + 宿主注册表（唯一登记处；惰性求值避免模块循环）
  host-selection.ts          宿主集合解析：探测、非交互集合、交互默认勾选、--host 解析、运维目标
  config.ts                  每宿主配置文件读写（[host] 节归一、历史节名兼容、installedHosts 丢弃）、
                             listInstalledHosts（配置文件存在即已安装）、字段清洗与合并
  installer.ts               安装 / 卸载主流程：按宿主遍历适配器，结果按宿主记录
  installer-template.ts      PACKAGE_ROOT 解析、宿主片段注入、~/ 展开、共享变量
  installer-data.ts          14 个命令注册
  preflight.ts               OpenSpec 三层检查（CLI + skills + root）：skills 按宿主判定、整体取最差；
                             修复按宿主传 --tools；无宿主配置时只读诊断
  fs-helpers.ts platform.ts version.ts package-meta.ts

src/i18n/                    i18next 文案（zh-CN / en）
src/types/                   LyConfig（host 节）/ WorkflowConfig / CLI 类型

templates/skills/            14 个 SKILL.md 共享正文
templates/hosts/codex/       codex 片段 + 角色词（→ ~/.codex/lyx/prompts/codex/）
templates/hosts/claude/      claude 片段 + 子代理定义（→ ~/.claude/agents/lyx-*.md）
docs/codex-exec-contract.md  审查子会话调用契约（DEPRECATED，历史参考）
```

## 入口与启动

```bash
npx ly-workflow-codex        # 一键安装/菜单（默认动作，含 preflight）
npx ly-workflow-codex init   # 选择宿主并安装 14 个 skills + 配置；OpenSpec 默认 check-only（i 为别名）
npx ly-workflow-codex init --init-openspec  # 宿主确认后，为所选宿主初始化当前项目 OpenSpec root/skills
lycx init --skip-prompt [--host codex,claude]  # 非交互：已安装宿主 → 探测宿主 → 兜底 codex
lycx doctor / status [--host <hosts>]          # 体检 / 安装概览（按宿主分组）
lycx openspec inspect|ensure [--host <hosts>] --json  # OpenSpec 依赖检查 / 按宿主修复
lycx uninstall [--host <hosts>]                # 按宿主卸载（缺省 = 全部已安装宿主）
```

## 配置（每宿主一个文件）

codex：`~/.codex/lyx/config.toml`；claude：`~/.claude/lyx/config.toml`。**配置文件存在即该宿主已安装**，不再持久化已安装宿主集合。两个文件字段语义一致：

```toml
[general]
version = "0.6.1"          # 该宿主那次安装的包版本（update 据此只刷新落后的宿主）
language = "zh-CN"         # zh-CN / en
createdAt = "..."          # ISO 时间

[workflows]
installed = ["init-project", "commit", ...]

[paths]                    # 取值按宿主（codex：~/.codex/lyx/...；claude：~/.claude/lyx/...）
commands = "..."
prompts  = "..."
backup   = "..."

[host]                     # 宿主配置节（历史节名 [codexHost] 兼容读取，下次写入归一为 [host]）
reviewExecutor = "main"    # main（主 agent 直接执行，默认/未配置）| subagent
codingExecutor = "main"
reviewModel = "..."        # 仅 reviewExecutor = "subagent" 时生效；未配置回退当前会话模型
codingModel = "..."
reviewReasoningEffort = "..."   # 空白不传 / 不写
codingReasoningEffort = "..."
spawnableModels = [...]    # 仅 codex：本机实测可 spawn 的模型清单（提示参考，不作候选或校验来源）
```

- codex 宿主：模型与推理档经"模板指示 + 宿主 spawn 能力"按次传入。
- claude 宿主：向导只采集执行者；模型与推理档（可手改配置）在安装 / 更新时写入 `~/.claude/agents/lyx-*.md` 的 `model` / `effort`，未配置为 `model: inherit`；配置改动后未重装时 `lycx doctor` 提示偏差，`lycx update` 按当前配置重渲染。lyx **不写** Claude Code 自身的 provider / settings 配置。
- 历史字段（`installedHosts`、`routing`、`performance`、历史节名）读取时丢弃，不写回。

本包私有目录与 ly-workflow（老项目，`~/.claude/.ly/`）彻底解耦，不做任何自动迁移。

## 审查执行模型（核心）

- 审查关卡 = **执行者可切换**（两个宿主语义一致；子代理机制按宿主落实：codex = 宿主 spawn + `send_input` 复用；claude = `Agent` 工具调用 `~/.claude/agents/lyx-*` 自定义子代理 + `SendMessage` 续跑，交互模式默认后台运行，等待语义表述为"结果必须被消费并如实报告"，不声称本轮同步阻塞）：`reviewExecutor = "main"`（默认）= 主 agent 直接自审，无 spawn、无逐条裁决、无驳回硬线，最多 2 轮；`reviewExecutor = "subagent"` = review-plan / review-code 各 spawn 1 个审查 subagent（非 fork spawn、只携带 TASK + 只审 change 范围），每条 Critical 由主会话逐条裁决——认可即修复，不认可必须附**可核验依据**（泛泛"误报"视为未完成裁决）；subagent 路径第 2 轮起默认 `send_input` 复用同一子代理，复用失败才重新 spawn
- 软上下文载体 = **change 目录 `context.md`**：propose 阶段产出（内容边界自检）、apply 阶段维护（实施决策回写）、subagent 路径消费（TASK 只传路径）；执行者为 `main` 时主 agent 保有完整上下文，`context.md` 仅作决策留痕
- 审查未修项快照 = **change 目录 `review-findings.md`**（快照式留痕，非台账）：review-plan / review-code 循环结束时按节 upsert 写入最后一轮 **Warning**（不收 Info / Critical），Warning 条目连续编号；正常清零在统一 commit **之后**写（保持未跟踪），随 `@lyx-archive` 的 `git add -- openspec/` 落库并搬入 `archive/`；`@lyx-explore` 进入时扫描并**先询问后列出**（含已标注解决条数）；该文件被排除在审查范围与中间 commit 之外。历史 Warning 被后续 change 解决时，在新 change 的 `proposal.md` 用 `## 解决的审查未修项` 声明锚点，由 `@lyx-archive` 向已归档快照追加追加式解决说明（原文不改、幂等、失败不阻断归档）；同一 change 内修复的 Warning 在 active 快照就地标注 `- 解决：本 change 内修复（未复审，commit <短 hash>）— …`（审查后同会话修复并提交后标注，或 `@lyx-archive` 归档前核对未标注条目、用户逐条确认后标注；必带 commit hash、按 hash 幂等、不新增提交），`@lyx-explore` 列出时额外显示其中未复审条数
- 驳回硬线（终止条件，防主会话裁决失效）：（a）逐条口径——同一 Critical 复现且再被驳回；（b）整轮口径——连续 2 轮对当轮全部 Critical 均不认可（零认可零修复）；命中即停转人工
- 实施 = **按 `codingExecutor` 切换**：`main`（默认）= 主 agent 直接读 tasks.md 逐任务实施 + 验证 + 勾选；`subagent` = spawn coding subagent（非 fork + 只实施 change 范围），回传主会话**不自行 commit**。两条路径均由主会话统一提交 `apply: <change-name>`；subagent 路径环境级不可用回退主 agent，业务失败原样呈报转人工
- 模型与推理档：审查 subagent = `[host] reviewModel` + 非空 `reviewReasoningEffort`，coding subagent = `[host] codingModel` + 非空 `codingReasoningEffort`（claude 侧写入子代理定义，见上）；**仅在对应执行者为 `subagent` 时生效**，执行者为 `main` 时字段被忽略并由 doctor 输出 WARN；模型未配置或空白回退当前会话模型，推理档未配置或空白不传，经"模板指示 + 宿主 spawn 能力"落实，无 shell 层模型参数；推理档不做枚举强校验，禁止模型名到档位的硬编码映射
- 角色设定来源按宿主：codex 的 ROLE_FILE——`review-plan` 用 `~/.codex/lyx/prompts/codex/plan-reviewer.md`，`review-code` 用 `~/.codex/lyx/prompts/codex/reviewer.md`（绝对路径为行为契约不可改，角色词内容不重写）；claude 用子代理定义正文（`lyx-plan-reviewer` / `lyx-reviewer`），产物中不出现 codex 角色词路径
- 第 2 轮起优先以 `send_input` 复用同一审查 subagent（实测宿主支持跨轮唤醒并保留其会话上下文）；复用失败才回退重新 spawn（非 fork，只携带 TASK），增量 TASK 附上一轮全部 Critical 逐字原文 + 路径清单，无需 session_id/resume
- 完整执行约定（spawn 协议 / 任务构造 / 主会话裁决与驳回硬线 / 修复循环 / 终止条件 / 提交时机）内联在各 skill 模板；[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED（历史参考）

## 关键设计决策

1. **`propose` 是编排入口，`apply`/`archive` 各带自动 commit，`explore` 是纯薄壳**：`propose.md` 包含创建方案前的隔离方式三选一询问（隔离 worktree【不在 worktree 内才问，从当前分支 HEAD 用 `git worktree add` 切出，切后同会话 cd 进 worktree 续跑——会话不断链，cd 校验失败即停，续接命令降级为异常兜底】/ 本项目切新分支【`git checkout -b`，无 baseline/无 cd/无兜底】/ 留在当前分支）、全自动/手动询问、commit 前的方案自审（四项检查 + 逐项结论清单，机械断链直接修、业务判断类 AskUserQuestion 问用户）、每步 commit（`propose: <change-name>`）、全自动流水线（review-plan → apply → review-code）。`apply.md` 由 coding subagent 实施 + 主会话统一提交，`archive.md` 委托 opsx 技能后 commit，`explore.md` 只做参数转发 + 一句转向提示。
2. **审查走单审查 subagent（非 fork）而非 wrapper/API/`codex exec` 子会话**：无 ly-wrapper、无 Go 二进制、无 Web UI、无 exec 契约维护面。非 fork spawn（宿主 V1 `fork_context` 默认 false / V2 `fork_turns: none`）不携带对话历史，token 成本约为双审 fork 模型的 1/4~1/6；软上下文经 change 目录 `context.md` 显式到达（可审计、随 commit 留痕），主会话逐条裁决（不认可须附可核验依据）+ 驳回硬线双口径补偿裁决质量；执行约定内联进模板，不随 codex CLI 版本漂移。
3. **实施走 coding subagent 而非本会话自实施**：不存在 routing 概念与外部实施后端；coding subagent 非 fork spawn、只实施 change 范围、可指定模型、经 context.md 获取软上下文，改动回传主会话，由主会话确认后回写 context.md 并统一提交（提交权收归主会话）。
4. **每宿主一个自包含配置文件**：`~/.codex/lyx/config.toml` 与 `~/.claude/lyx/config.toml`，配置文件存在即已安装（部分卸载 = 删该宿主配置与产物），`general.version` 按宿主记录；宿主配置节归一为 `[host]`（历史 `[codexHost]` 兼容读取）；执行者字段决定审查与实施主体（未配置等价 `main`），模型与推理档仅在对应执行者为 `subagent` 时生效；交互 init / 菜单可选择"不覆盖（清除字段）"或覆盖指定档位，非交互 update 与未触碰字段保留原值。
5. **宿主包 + 共享正文 + 渲染期差异**：共享层只认适配器接口与注册表；模板正文单源（`templates/skills/`），宿主差异只在 `templates/hosts/<id>/` 片段与渲染阶段（命令前缀改写、`@openspec-*` 委托改写、配置路径与宿主 id 注入）产生，正文不写宿主条件块。多宿主共有的行为不变量由一组遍历注册表的测试断言守护；上游 ly-workflow 的 wrapper、Web UI、routing.* 不在本项目内。与上游的关系（v0.2.0 起 codex 安装位改为 `~/.agents/skills/lyx-*/`；旧安装位残留由 init/uninstall 自动清理）见 [README.md](./README.md)。
6. **OpenSpec 依赖检查统一为共享三层模型，按宿主判定与修复**：`lycx init` / `@lyx-init` / `lycx doctor` 共用 CLI、skills、root 三层检查；skills 按 OpenSpec profile 推导，每个宿主只在自己的技能根里判定（codex：项目/全局 `.agents`、`.codex`；claude：项目/全局 `.claude/skills`），整体取最差；项目级修复按缺失技能的宿主执行 `openspec init --tools <宿主>`，不重建另一宿主产物；无任何宿主配置文件时只读诊断，写入型修复延后到宿主确认之后；`global-only` WARN 并继续，不自动固化。
7. **Claude 侧以 main 为基线，子代理为可选增强**：子代理定义始终安装（执行者只决定是否使用），不启用 worktree 隔离（实施改动须留在主检出由主会话统一提交），审查子代理工具含 Bash 但正文限定只读 git / openspec；`@lyx-init` 在 Claude 宿主下额外产出导入 `AGENTS.md` 的 `CLAUDE.md`。

## 相关文件

- 根文档：README（对外）/ CLAUDE.md（精简导航，本文件为权威）→ [CLAUDE.md](./CLAUDE.md)
- 模板导航：→ [templates/CLAUDE.md](./templates/CLAUDE.md)

## 发版规则

1. 更新 `package.json` 版本号（当前 0.4.0）
2. 更新 `CHANGELOG.md`（新条目在顶部）
3. 同步根文档中的版本引用与行为描述
4. `pnpm typecheck && pnpm build && pnpm test` 全绿后 commit
5. 打 tag `v<版本号>` push，`.github/workflows/release.yml` 自动发布 npm 包（不在本地跑 `npm publish`）
