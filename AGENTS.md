# ly-workflow-codex

> Codex 单 Agent 工作流：同一 Codex 会话内自己完成聊天 / 分析 / 规划 / 实施。审查与实施主体由 `[codexHost] reviewExecutor` / `codingExecutor` 决定（未配置等价 `main` = 主 agent 直接执行；`subagent` = spawn 独立子代理，非 fork spawn + 主会话逐条裁决异议）；慢验证统一由 `@lyx-archive` 的归档前关卡执行。执行约定内联于各 skill 模板（[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED）。

**Last Updated**: 2026-09-15 (v0.2.0)

---

## 语言

- 始终用中文（zh）回复用户，包括解释性文字、文档、注释；技术术语、代码标识符、命令、报错原文保持原样（可用英文）。

## 项目定位

**ly-workflow-codex** 是 ly-workflow 的 codex 单宿主独立版：无 wrapper、无 Web UI、无 routing/implementer 概念。Codex 单 Agent 模式 = 同一 Codex 会话内自己 propose/review/apply；审查与实施主体由 `[codexHost] reviewExecutor`/`codingExecutor` 决定（未配置等价 `main` = 主 agent 直接执行；`subagent` = 独立子代理，非 fork spawn + 范围点名，软上下文经 change 目录 `context.md` 到达），模型分别由 `codexHost.reviewModel`/`codingModel` 指定且仅在对应执行者为 `subagent` 时生效。执行约定内联于各 skill 模板，命令模板/角色提示词结构见 [templates/CLAUDE.md](./templates/CLAUDE.md)。

## 包级常量（src/utils/package-meta.ts）

| 常量 | 值 | 说明 |
|------|-----|------|
| `PACKAGE_NAME` | `ly-workflow-codex` | npm 包名 |
| `BIN_NAME` | `lycx` | CLI 二进制名 |
| `AGENTS_SKILLS_DIR` | `~/.agents/skills` | codex skills 安装目录，命令安装为 `lyx-*/SKILL.md`（v0.2.0 起） |
| `CODE_PROMPTS_DIR` | `~/.codex/prompts` | 旧安装位（v0.2.0 前），仅用于升级残留清理 |
| `LY_DIR` | `~/.codex/lyx` | ly 配置根目录 |
| `CONFIG_FILE` | `~/.codex/lyx/config.toml` | 配置文件 |
| `PROMPTS_DIR` | `~/.codex/lyx/prompts` | 角色词目录（子目录 `codex/`） |
| `ISSUES_URL` | repo issues | 问题反馈入口 |

## 模块职责

```
bin/lycx.mjs                 CLI 入口（import dist/cli.mjs）
src/cli.ts                   cac CLI 定义：默认菜单 / init / doctor / status / uninstall + help
src/cli-setup.ts             子命令注册、i18n 初始化、preflight 挂钩
src/index.ts                 包公共出口（types + 主入口）

src/commands/
  init.ts                    全量初始化向导：语言 → API 提供方 → 模型三连(reviewModel /
                             codingModel，模型二连逐个选择) → 配置摘要
                             → 写入 ~/.codex/lyx/config.toml → 安装 workflows
  menu.ts                    交互式菜单（update / 修改审查模型 / 重新 init / uninstall / help）
  doctor.ts                  doctor 体检：Node / config / Commands(lyx-* skills) / Roles / OpenSpec CLI / skills
  update.ts                  版本检查 + 以 `init --force --skip-prompt` 覆盖重装

src/utils/
  config.ts                  ~/.codex/lyx/config.toml 读写、createDefaultConfig、sanitizeReviewModel
  installer.ts               安装主流程：模板复制 + 变量注入 + verify + 卸载清单
  installer-data.ts          14 个命令注册（init/git/opsx/review/release 五类，order 0-42）
  installer-template.ts      模板渲染：{{REVIEW_MODEL}} 旧位兼容（历史模板/旧安装位）、
                              codingModel 模型指示透传、{{LITE_MODE_FLAG}} 恒空、条件块折叠
  codex-provider.ts          采集 ~/.codex/config.toml 的 [model_providers.*]（init 向导数据源）
  preflight.ts               入口处 openspec 依赖检查：openspec CLI + openspec-* skills
                             （~/.agents/skills/ 或项目 .agents/skills/，openspec init 产物）
  legacy-cleanup.ts          codex 侧残留清理：~/.codex/AGENTS.md LY 区块、config.toml 旧注释
                             + [features.multi_agent_v2]、agents/ly-*.toml（update/uninstall 时回收）
  host-adapters.ts           codex 单宿主适配器（ADAPTERS 仅注册 codex；ROLE_FILE verify）
  platform.ts / version.ts   Windows/路径工具、版本比较与更新检查
  package-meta.ts            包级常量（见上表）

src/i18n/                    i18next 文案（zh-CN / en）
src/types/                   LyConfig / WorkflowConfig / CLI 类型

templates/skills-codex/      14 个 SKILL.md 模板源（安装目标 ~/.agents/skills/lyx-*/SKILL.md）
templates/prompts/codex/     8 个角色提示词源（安装目标 ~/.codex/lyx/prompts/codex/）
docs/codex-exec-contract.md  审查子会话调用契约（不可改；命令模板的调用方契约）
```

## 入口与启动

```bash
npx ly-workflow-codex        # 一键安装/菜单（默认动作，含 preflight）
npx ly-workflow-codex init   # 全量初始化（i 为别名）
lycx doctor / status         # 体检 / 安装概览
lycx uninstall               # 卸载 ~/.agents/skills/lyx-*（含旧 ~/.codex/prompts/ly-*.md 残留）与 ~/.codex/lyx/ 配置
```

## 配置（~/.codex/lyx/config.toml）

```toml
[general]
version = "0.2.0"          # 记录安装时的包版本
language = "zh-CN"         # zh-CN / en
createdAt = "..."          # ISO 时间

[workflows]
installed = ["init-project", "commit", "rollback", "clean-branches", "worktree", "explore", "propose", "apply", "archive", "review-plan", "review-code", "release", "changelog", "publish"]

installedHosts = ["codex"] # 兼容旧配置；codex 单宿主恒为 ['codex']

[paths]
commands = "~/.codex/lyx/prompts"
prompts  = "~/.codex/lyx/prompts"
backup   = "~/.codex/lyx/backup"

[codexHost]                # codex 宿主专属配置
reviewModel = "..."        # 审查 agent A 的模型名；未配置 = 回退当前会话模型
reviewExecutor = "main"    # 审查执行者：main（主 agent 直接执行，默认/未配置）| subagent（spawn 独立审查 subagent）
codingExecutor = "main"    # 实施执行者：main（主 agent 直接实施，默认/未配置）| subagent（spawn coding subagent）
reviewModel = "..."        # 审查 subagent 模型；仅在 reviewExecutor = "subagent" 时生效，未配置回退当前会话模型
codingModel = "..."        # coding subagent 的模型名（可选）；未配置 = 回退当前会话模型
reviewReasoningEffort = "..."   # 审查 agent A 推理档（可选）；非空时随 reviewModel spawn 传入，空白不传
codingReasoningEffort = "..."   # coding subagent 推理档（可选）；非空时随 codingModel spawn 传入，空白不传
spawnableModels = [...]    # 本机实测可 spawn 的模型清单（可选，仅提示参考）；未配置/空白回退内置默认，不作候选或校验来源
```

`~/.codex/lyx/` 是 ly-workflow-codex 私有目录，与 ly-workflow（双宿主老项目，`~/.claude/.ly/`）彻底解耦，不做任何自动迁移——旧路径下的文件（若存在）不被读取、不被删除，视为无关目录。

## 审查执行模型（核心）

- 审查关卡 = **执行者可切换**：`reviewExecutor = "main"`（默认）= 主 agent 直接自审，无 spawn、无逐条裁决、无驳回硬线，最多 2 轮；`reviewExecutor = "subagent"` = review-plan / review-code 各 spawn 1 个审查 subagent（非 fork spawn、只携带 TASK + 只审 change 范围），每条 Critical 由主会话逐条裁决——认可即修复，不认可必须附**可核验依据**（泛泛"误报"视为未完成裁决）；subagent 路径第 2 轮起默认 `send_input` 复用同一子代理，复用失败才重新 spawn
- 软上下文载体 = **change 目录 `context.md`**：propose 阶段产出（内容边界自检）、apply 阶段维护（实施决策回写）、subagent 路径消费（TASK 只传路径）；执行者为 `main` 时主 agent 保有完整上下文，`context.md` 仅作决策留痕
- 驳回硬线（终止条件，防主会话裁决失效）：（a）逐条口径——同一 Critical 复现且再被驳回；（b）整轮口径——连续 2 轮对当轮全部 Critical 均不认可（零认可零修复）；命中即停转人工
- 实施 = **按 `codingExecutor` 切换**：`main`（默认）= 主 agent 直接读 tasks.md 逐任务实施 + 验证 + 勾选；`subagent` = spawn coding subagent（非 fork + 只实施 change 范围），回传主会话**不自行 commit**。两条路径均由主会话统一提交 `apply: <change-name>`；subagent 路径环境级不可用回退主 agent，业务失败原样呈报转人工
- 模型与推理档：审查 subagent = `codexHost.reviewModel` + 非空 `reviewReasoningEffort`，coding subagent = `codexHost.codingModel` + 非空 `codingReasoningEffort`；**仅在对应执行者为 `subagent` 时生效**，执行者为 `main` 时字段被忽略并由 doctor 输出 WARN；模型未配置或空白回退当前会话模型，推理档未配置或空白不传，经"模板指示 + 宿主 spawn 能力"落实，无 shell 层模型参数；推理档不做枚举强校验，禁止模型名到档位的硬编码映射
- ROLE_FILE：`review-plan` 用 `~/.codex/lyx/prompts/codex/plan-reviewer.md`，`review-code` 用 `~/.codex/lyx/prompts/codex/reviewer.md`——绝对路径为行为契约不可改，角色词内容不重写
- 第 2 轮起优先以 `send_input` 复用同一审查 subagent（实测宿主支持跨轮唤醒并保留其会话上下文）；复用失败才回退重新 spawn（非 fork，只携带 TASK），增量 TASK 附上一轮全部 Critical 逐字原文 + 路径清单，无需 session_id/resume
- 完整执行约定（spawn 协议 / 任务构造 / 主会话裁决与驳回硬线 / 修复循环 / 终止条件 / 提交时机）内联在各 skill 模板；[docs/codex-exec-contract.md](./docs/codex-exec-contract.md) 已 DEPRECATED（历史参考）

## 关键设计决策

1. **`propose` 是编排入口，`apply`/`archive` 各带自动 commit，`explore` 是纯薄壳**：`propose.md` 包含创建方案前的隔离方式三选一询问（隔离 worktree【不在 worktree 内才问，从当前分支 HEAD 用 `git worktree add` 切出，切后同会话 cd 进 worktree 续跑——会话不断链，cd 校验失败即停，续接命令降级为异常兜底】/ 本项目切新分支【`git checkout -b`，无 baseline/无 cd/无兜底】/ 留在当前分支）、全自动/手动询问、commit 前的方案自审（四项检查 + 逐项结论清单，机械断链直接修、业务判断类 AskUserQuestion 问用户）、每步 commit（`propose: <change-name>`）、全自动流水线（review-plan → apply → review-code）。`apply.md` 由 coding subagent 实施 + 主会话统一提交，`archive.md` 委托 opsx 技能后 commit，`explore.md` 只做参数转发 + 一句转向提示。
2. **审查走单审查 subagent（非 fork）而非 wrapper/API/`codex exec` 子会话**：无 ly-wrapper、无 Go 二进制、无 Web UI、无 exec 契约维护面。非 fork spawn（宿主 V1 `fork_context` 默认 false / V2 `fork_turns: none`）不携带对话历史，token 成本约为双审 fork 模型的 1/4~1/6；软上下文经 change 目录 `context.md` 显式到达（可审计、随 commit 留痕），主会话逐条裁决（不认可须附可核验依据）+ 驳回硬线双口径补偿裁决质量；执行约定内联进模板，不随 codex CLI 版本漂移。
3. **实施走 coding subagent 而非本会话自实施**：不存在 routing 概念与外部实施后端；coding subagent 非 fork spawn、只实施 change 范围、可指定模型、经 context.md 获取软上下文，改动回传主会话，由主会话确认后回写 context.md 并统一提交（提交权收归主会话）。
4. **配置单宿主于 `~/.codex/lyx/config.toml`**：installedHosts 仅保留为兼容旧配置读取的字段（恒 `['codex']`）；`codexHost.reviewModel`/`codingModel` 及对应 `reviewReasoningEffort`/`codingReasoningEffort` 由模板运行时读取并落实（模型未配置回退当前会话模型，推理档空白不传；init/update/menu 重写时保留原值，手工维护入口为 `[codexHost]` 且向导不采集推理档）；执行者字段 `reviewExecutor`/`codingExecutor` 决定审查与实施主体（未配置等价 `main`），模型与推理档字段仅在对应执行者为 `subagent` 时生效。
5. **双宿主遗产（claude 宿主、wrapper、Web UI、routing.*）已随拆分移除**：模板/文档/spec 只描述 codex 单宿主行为；与上游 ly-workflow 的关系（v0.2.0 起安装位改为 `~/.agents/skills/lyx-*/`，与 ly-workflow 的 `~/.codex/prompts/ly-*.md` 不再冲突；旧安装位残留由 init/uninstall 自动清理；迁移路径）见 [README.md](./README.md)。

## 相关文件

- 根文档：README（对外）/ CLAUDE.md（精简导航，本文件为权威）→ [CLAUDE.md](./CLAUDE.md)
- 模板导航：→ [templates/CLAUDE.md](./templates/CLAUDE.md)

## 发版规则

1. 更新 `package.json` 版本号（当前 0.2.0）
2. 更新 `CHANGELOG.md`（新条目在顶部）
3. 同步根文档中的版本引用与行为描述
4. `pnpm typecheck && pnpm build && pnpm test` 全绿后 commit
5. 打 tag `v<版本号>` push，`.github/workflows/release.yml` 自动发布 npm 包（不在本地跑 `npm publish`）
