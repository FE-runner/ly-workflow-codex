# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> 本文件记录 ly-workflow-codex 自 0.1.0 起的独立版本。0.1.0 之前的版本（ly-workflow 的 1.0.0–2.0.0，双宿主时代）属于上游项目，不在本文件记录范围内；如需追溯请查看上游仓库的 CHANGELOG。

---

## [Unreleased]

`lycx init` 与菜单的配置入口统一为同一采集面（执行者二连 → 模型二连 → 推理档二连）：Claude Code 宿主不再只能配执行者，推理档建议档位改为按宿主提供。

### Added

- `lycx init` 的 Claude Code 分支补齐模型二连（`reviewModel` / `codingModel`）与推理档二连（`reviewReasoningEffort` / `codingReasoningEffort`）采集，采集条件、候选语义与清洗规则与 Codex 完全一致（仅在对应执行者为 `subagent` 时采集；候选 = 留空继承当前会话 + 自定义输入 + 既有值）
- 新增共享采集实现 `src/commands/collect-subagent-config.ts`，`lycx init` 与菜单复用同一套执行者 / 模型 / 推理档采集

### Changed

- **BREAKING（交互行为）**：菜单「配置审查模型」改为「配置执行者与模型」，两个宿主统一为 执行者二连 → 模型二连 → 推理档二连。Codex 菜单因此新增编码侧的执行者 / 模型 / 推理档提问；Claude Code 菜单新增审查侧模型与推理档提问，并保留其原有的执行者二连
- 推理档建议档位清单改由宿主适配层提供：Claude Code = `low` / `medium` / `high` / `xhigh` / `max`（无 `minimal`，含 `xhigh`），Codex 保持 `minimal` / `low` / `medium` / `high` / `max`；清单仍只作候选提示，不做枚举强校验，既有值不在清单内时照常保留并默认选中
- `README.md` / `README.zh-CN.md` / `AGENTS.md` 同步"Claude Code 只采集执行者"的旧表述；不涉及配置格式变更，此前手工写入 Claude Code 配置的模型与推理档被读取为既有值默认项，语义不变

## [0.7.0] - 2026-09-30

本版新增 **Claude Code 宿主**：同一套 14 个 `lyx-*` 命令流程可安装到 Codex 与 Claude Code 两个宿主（Claude 侧调用写法为 `/lyx-*`），安装器改为宿主包架构、每宿主一个配置文件。审查未修项快照同时补上"本 change 内修复"的就地标注路径。

### Added

- **Claude Code 宿主**：命令安装到 `~/.claude/skills/lyx-*/`，审查 / 实施子代理定义安装到 `~/.claude/agents/lyx-*.md`（未配置模型时 `model: inherit`）；子代理路径用 `Agent` 工具调用自定义子代理、`SendMessage` 续跑
- `lycx init` 支持选择宿主（按 `~/.codex` / `~/.claude` 探测默认勾选）；`uninstall` / `doctor` / `status` / `update` 支持 `--host` 按宿主操作，`doctor` 按宿主分组输出
- OpenSpec 集成按宿主：技能扫描补 `.claude/skills`，项目级修复按缺失宿主传 `--tools <host>`
- `@lyx-init` 在 Claude 宿主下额外产出导入 `AGENTS.md` 的 `CLAUDE.md`
- `review-findings-snapshot`：新增「本 change 内修复标注」——同一 change 内修复的 Warning 可在 active 快照追加 `- 解决：本 change 内修复（未复审，commit <短 hash>）— <说明>`；触发点为审查后同会话修复并提交后（标注前确认一次），以及 `@lyx-archive` 归档前核对未标注条目（候选 commit 逐条确认，默认跳过，失败不阻断归档）
- `@lyx-explore` 列出快照时额外显示已解决条目中"未复审"的条数

### Changed

- **BREAKING（配置结构）**：配置改为每宿主一个文件——`~/.codex/lyx/config.toml`（路径不变）与 `~/.claude/lyx/config.toml`；移除 `installedHosts`（配置文件存在即已安装）；宿主配置节 `[codexHost]` 归一为 `[host]`，旧键兼容读取、下次 init 重写
- 代码按宿主包组织：共享层 `src/utils/` 只认适配器接口与注册表，宿主专属内容位于 `src/hosts/<id>/` 与 `templates/hosts/<id>/`；Codex 宿主行为保持不变，`src/index.ts` 三个路径函数保留无参签名（内部默认 codex，标注 deprecated）
- 审查未修项快照：「不改写 active 快照」收窄为只约束跨 change 回写；审查后修复提交须按路径暂存、不纳入快照
- 快照条目最小结构、旧快照按顶层条目顺序定位、归档回写从归档后目录读取 `proposal.md` 等口径收紧
- README / AGENTS.md / CLAUDE.md 同步双宿主与快照行为说明

### Fixed

- `doctor` / `status` 在目录枚举遇到权限 / IO 错误时输出该宿主体检失败，不再中断并打印堆栈
- codex 卸载清理旧版 `ly-*` 残留失败时正确标记卸载失败
- 菜单卸载确认按所选宿主列出实际删除 / 修改范围（此前只列 codex 路径）

## [0.6.1] - 2026-09-29

本版补齐"审查未修项快照"的闭环：历史 Warning 被后续 change 解决后，可在新 change 的 `proposal.md` 声明锚点，由 `@lyx-archive` 向已归档快照追加解决说明——原文不改、幂等、锚点失败不阻断归档。

### Added

- `ly-propose-flow`：`proposal.md` 新增可选小节 `## 解决的审查未修项`，以 `<归档快照路径>#<节名>#<序号>` 引用历史 Warning 并附一句解决说明
- `review-findings-snapshot`：新增「追加式解决说明」能力——`@lyx-archive` 归档时向已归档快照对应 Warning 条目追加 `- 解决：<change-name>（归档于 <日期>）— <说明>`；只允许引用已归档快照，同 change 幂等，锚点解析失败逐条跳过且不阻断归档
- `@lyx-explore` 列出快照时显示各节"已标注解决 N 条"（按 Warning 条目计，不按解决说明行数累加）

### Changed

- `review-findings.md` 两节内 Warning 条目改为连续编号，支撑稳定锚点；快照仍不引入 open/closed 状态字段，解决说明只增不改
- `@lyx-archive` 的解决说明回写复用既有 `git add -- openspec/` 与归档 commit，不新增独立提交或归档步骤
- README / CLAUDE.md 同步解决说明行为摘要

### Fixed

- `@lyx-explore` 解决计数口径改为按 Warning 条目统计，避免同一 Warning 被多个 change 解决时重复计入

## [0.6.0] - 2026-09-23

本版新增"审查未修项快照"：审查产生的未修复 Warning 不再随对话消失——按节写入 change 目录下的 `review-findings.md`，随归档落库，并可由 `@lyx-explore` 先询问后列出。

### Added

- 新能力 `review-findings-snapshot`：change 目录下 `review-findings.md` 单文件两节（`## 方案审查` / `## 代码审查`）快照，只收最后一轮 Warning（不收 Info / Critical）
- `@lyx-review-plan` / `@lyx-review-code` 在审查循环结束时按节 upsert 写入快照：正常清零在统一 commit **之后**写（保持未跟踪），非正常终止、`--no-commit`、commit 失败等场景照写
- `@lyx-explore` 进入时扫描 active 与 archive 下的快照，有命中则**先询问**是否列出，用户同意后才按 change 分组展示

### Changed

- 审查命令的未跟踪（`??`）清单显式排除 `review-findings.md`，且在 `main` / `subagent` 两条执行者路径下同样生效；该文件不会被当作审查对象，也不会被中间 commit 提前纳入
- `@lyx-archive` 随既有 `git add -- openspec/` 把快照落库并搬入 `archive/`，不新增归档专门步骤
- `@lyx-explore` 由"纯委托"调整为"纯委托为主 + 委托前一次快照询问"，参数转发仍原样
- README / CLAUDE.md 同步快照行为摘要

## [0.5.1] - 2026-09-20

本版补充英文 README，并支持中英文切换；默认入口改为英文，中文文档保留为独立文件。

### Changed

- 新增英文 `README.md`，原中文 README 调整为 `README.zh-CN.md`
- 两份 README 顶部增加 `English | 简体中文` 切换链接
- npm 包文件清单包含 `README.zh-CN.md`，发布包同时携带中英文 README
- README 中移除与 ly-workflow 的关系说明

## [0.5.0] - 2026-09-18

本版统一了 lyx 生成提交的 message 正文规范，并补齐归档后的隔离环境收尾：propose 记录来源分支与 worktree metadata，archive 完成后可提示合并回来源分支并清理 worktree / 开发分支。

### Added

- 新能力 `archive-branch-cleanup`：归档提交完成后按 isolation metadata 提示合并回 `sourceBranch`，并清理 worktree 与开发分支
- `@lyx-propose` 记录 `sourceBranch` / `isolation` / `developmentBranch` / `worktreePath` metadata 到 change `.openspec.yaml`
- `@lyx-commit` 正文规范：所有 lyx 显式生成 message 的提交使用动机/改动/影响正文

### Changed

- propose / apply / archive / review 修复自动提交复用统一正文规范，并保留 `Change-Stage` / `Change-Name` trailer
- init / release / changelog / publish / WIP / worktree `.gitignore` 等非 change 生命周期提交补齐正文，但不追加 Change trailer
- 提交 message 文件路径改用 `git rev-parse --git-path COMMIT_EDITMSG`，兼容 linked worktree
- `@lyx-publish` 版本 bump 改为 `npm version --no-git-tag-version` 后按规范提交，并补 annotated tag，确保 `git push --follow-tags` 可触发 CI
- README / CLAUDE / templates 导航同步归档后分支收尾与提交正文规范说明

### Fixed

- 归档后收尾在展示确认提示前完成 branch/worktree 状态校验，失败时保留 worktree 与开发分支
- worktree 模式收尾从 `sourceBranch` 所在 worktree 执行，避免在开发 linked worktree 中 checkout 被占用的目标分支
- 修正 host-adapters 模板断言，覆盖 isolation cleanup 与 `-C` 路径引用命令

## [0.4.0] - 2026-09-18

本版把子代理推理档从"只能手改配置"升级为交互可配置：`lycx init` 与菜单现在可以显式选择覆盖某个档位，或选择不覆盖以继承模型/宿主默认。

### Added

- `lycx init` 在对应执行者为 `subagent` 时采集 `reviewReasoningEffort` / `codingReasoningEffort`：候选为不覆盖、常见档位建议、自定义输入与既有值
- `lycx` 菜单"配置审查模型"支持编辑 review 推理档覆盖选择
- 交互配置摘要展示推理档状态（未覆盖 / 已覆盖: 值），执行者为 `main` 时标注不生效

### Changed

- 推理档字段语义统一为"覆盖 / 不覆盖"：不覆盖等价于不传 `reasoning_effort`，继承模型/宿主默认
- `lycx doctor` 的推理档展示文案改为"未覆盖（继承模型/宿主默认）"与"已覆盖: 值"
- README / CLAUDE / AGENTS 与 `subagent-agent-config` spec 同步推理档配置入口与保留/清除边界

### Fixed

- 菜单仅修改推理档时不再被"模型与执行者未变化"的早退判定忽略
- 交互选择不覆盖时会真正清除既有推理档字段；非交互 update 与未触碰字段继续保留原值

## [0.3.0] - 2026-09-18

本版完成三件主要工作：审查 / 实施改为"执行者可切换"（默认由主 agent 直接执行）；私有配置目录迁移到 `~/.codex/lyx/`；commit message 约定统一为 Conventional Commits 前缀 + git trailer，并统一 propose / apply 的 index 隔离协议。

### Added

- `[codexHost] reviewExecutor` / `codingExecutor`：取值 `main` / `subagent`，未配置等价 `main`
- 新能力 `archive-verification-gate`：`@lyx-archive` 在归档前执行一次项目完整验证（测试 / 类型检查 / 构建），失败阻断归档
- `@lyx-review-plan` / `@lyx-review-code` / `@lyx-apply` 的执行者分支：主 agent 路径无 spawn、无逐条裁决 / 驳回硬线，自审循环最多 2 轮
- **新能力 `commit-conventions`**：change 生命周期 commit 统一为 CC 前缀 + `Change-Stage` / `Change-Name` trailer；审查对象定位改为 trailer 优先（`--all-match`），旧前缀保留为 DEPRECATED 兼容通道；propose / apply 共用同一套 index 隔离协议
- `[codexHost] reviewReasoningEffort` / `codingReasoningEffort`：可选推理档字段，非空时随对应 subagent spawn 传入 `reasoning_effort`
- `[codexHost] spawnableModels`：显式声明本机可 spawn 的模型清单，作为 init / doctor 的候选与校验来源
- change 目录固定软上下文 artifact `context.md`：propose 产出、apply 维护、review-plan / review-code / coding subagent 消费
- 私有配置目录 `~/.codex/lyx/`（`config.toml` + `prompts/codex/` 下的 8 个角色提示词）
- 共享 OpenSpec 依赖检查模型（CLI / skills / root 三层），`lycx init` / `@lyx-init` / `lycx doctor` 复用
- `lycx init --init-openspec` 显式逃生口：默认 check-only，只有主动传入才执行项目级修复

### Changed

- **BREAKING 默认执行者变更**：`reviewExecutor` / `codingExecutor` 未配置等价 `main`，升级用户即使不改配置，行为也会从"spawn 子代理"变为"主 agent 直接执行"
- **BREAKING 配置目录迁移**：`~/.ly/` → `~/.codex/lyx/`，旧目录不读取、不迁移、不删除；worktree 目录仍沿用共享的 `~/.ly/worktrees/`
- **BREAKING 审查执行模型**：每个审查关卡由"2 个并行 fork subagent + 交换结论共识"改为"1 个审查 subagent（非 fork，只携带 TASK）+ 主会话逐条裁决"；新增驳回硬线终止条件；subagent 不再 fork 父线程历史，软上下文经 `context.md` 到达
- **BREAKING commit message 约定**：change 生命周期 commit 改为 CC 前缀 + trailer；`apply` 的 CC type 由主会话按实际改动判断
- **BREAKING propose index 口径**：遇到 change 目录外已暂存内容不再直接停止，改为与 apply 一致的 `--only` 隔离协议
- **BREAKING 模型配置采集**：init 模型三连改二连（不再采集 `reviewModelB`）；模型候选改为 `spawnableModels`，移除自由输入与 `/models` 拉取依赖
- **BREAKING 子代理默认复用**：subagent 路径第 2 轮起默认用 `send_input` 复用同一子代理（实测宿主支持跨轮唤醒并保留上下文），复用失败才回退重新 spawn；"回合结束即失去访问能力"的旧表述废止
- 测试 / 类型检查 / 构建不再在审查循环每轮执行；`openspec validate` 仍保留在 review-plan 每轮
- `lycx init` 默认只检查 OpenSpec 依赖、不写当前项目；skills 检查按 profile 推导必需 skill，并同时扫描项目级与全局级（仅全局可用时输出 `global-only` WARN）
- `lycx init` 向导新增执行者二连采集；执行者为 `main` 时不采集对应模型字段并在摘要标注"不生效"
- `lycx doctor` 展示执行者字段；执行者为 `main` 时对非空模型 / 推理档字段输出 WARN
- 审查关卡补轮内纪律（同轮 wait、禁止口头分发、消费完即关闭）、返回有效性判定与基线锚定（首轮固定 SHA，循环期间不重算）
- apply 提交前补文件清单核对：实施前 `git status` 快照、partial apply 检测、快照差集比对、index 隔离与 `git show --name-only` 校验
- propose 全自动路径补节点前置校验：review-plan 必须正常清零才进 apply；apply 阶段 commit SHA 必须等于本次记录才进 review-code

### Removed

- **BREAKING `[codexHost] reviewModelB` / `reviewReasoningEffortB`**：字段与类型定义移除，不再读取或保留写回；存量配置中的这两个键可自行删除
- 审查循环内的慢验证步骤（review-code 的"本轮验证"与对应终止条件）
- 旧配置路径迁移 / 共存检测逻辑（`migrateLegacyConfig`、`hasCoexistingLegacyLyProducts`、`migrateLegacyPrompts`）
- 审查 subagent 的 fork 全量上下文传递（改为非 fork + `context.md`）

### Fixed

- worktree 目录回归共享 `~/.ly/worktrees/`；`lycx uninstall` 不再删除其中存活的 git worktree（避免 git 元数据孤儿引用）
- 清理 `reviewModelB` 相关残留表述

### Migration

- 依赖独立审查 / 独立实施的用户需显式配置 `reviewExecutor = "subagent"` / `codingExecutor = "subagent"`（旧配置中留空的 `reviewModel` 不再隐含"spawn 子代理"）
- `~/.ly/config.toml` 中的模型配置需在 `~/.codex/lyx/config.toml` 重新配置（不自动迁移）；旧目录原样保留
- 存量 `reviewModelB` / `reviewReasoningEffortB` 可删除；`lycx doctor` 会提示这两个字段已移除
- 旧格式 `propose:` / `apply:` commit 在一个版本周期内仍可被定位（命中时报告 DEPRECATED 兼容通道提示）；新提交一律使用 CC 前缀 + trailer

## [0.2.0] - 2026-09-14

命令形态从「斜杠命令」迁移为 Codex 官方 skill 机制：Codex CLI 的 `/` 命令为内置硬编码，不支持从文件系统加载自定义命令，因此 14 个命令模板由 slash command 格式改造为 `SKILL.md`（frontmatter：`name`/`description`/`argument-hint`），安装位移位到 Codex 官方 skill 发现目录；命令前缀统一为 `lyx`，与上游 ly-workflow 的 `ly` 命令区分。

### Changed

- **命令调用形态 `/ly:*` → `@lyx-*`**：14 个命令以 `@lyx-<cmd>` mention 调用（`~/.agents/skills/lyx-<cmd>/SKILL.md`），参数为 mention 后跟随的自然语言；`/ly:*` 旧形态不再可用
- **安装位 `~/.codex/prompts/ly-*.md` → `~/.agents/skills/lyx-*/SKILL.md`**：`~/.codex/prompts/` 为死目录（Codex CLI 不读取），`~/.agents/skills/<name>/SKILL.md` 为 skill 发现目录（用户级 + 项目级 `.agents/skills/`）
- **模板源 `templates/commands-codex/` → `templates/skills-codex/`**：每份模板增加 `name: lyx-<cmd>` frontmatter 与调用方式说明
- **openspec 依赖检测改为 openspec-* skills**：preflight/doctor 检测 `~/.agents/skills/` 或项目 `.agents/skills/` 下的 `openspec-*` SKILL.md（旧 `~/.codex/prompts/opsx-*.md` 检测移除）
- **卸载/更新兼容旧安装位**：`uninstall` 与 `update` 在清理/备份新安装位 `~/.agents/skills/lyx-*` 的同时回收旧安装位残留（`~/.agents/skills/ly-*` 目录与 `~/.codex/prompts/ly-*.md`）

### Fixed

- 修复「`/ly` no matches」根因：Codex CLI 的斜杠命令为内置硬编码，无法从文件系统加载自定义 `/` 命令；现改为官方 `@mention skills` 机制

### Removed

- 旧迁移产物 `source-command-opsx-*` skills（`@opsx-*` 已由 openspec CLI 生成的 `openspec-*` skills 取代）

## [0.1.0] - 2026-09-14

首个版本：从 ly-workflow 拆分，codex 单宿主化——砍掉 claude 宿主、wrapper、Web UI 与 routing/implementer 概念，审查关卡改为 `codex exec` 独立子会话。

### Added

- **14 个 `/ly:*` 命令（codex 单宿主版）**：`init`/`explore`/`propose`/`apply`/`archive`/`review-plan`/`review-code`/`release`/`changelog`/`publish`/`commit`/`rollback`/`clean-branches`/`worktree`，模板源 `templates/commands-codex/`，安装到 `~/.codex/prompts/ly-*.md`
- **审查执行模型 = `codex exec` 独立子会话**：`codex exec -C "$WORKDIR" --json -m <reviewModel> -` + 第 2 轮起 `codex exec resume <session_id>` 续聊；模型由 `codexHost.reviewModel` 渲染，未配置回退当前会话模型；调用契约见 `docs/codex-exec-contract.md`
- **8 个共享角色提示词**：`templates/prompts/codex/` → `~/.ly/prompts/codex/`（审查实际使用 `plan-reviewer.md`/`reviewer.md`，绝对路径为行为契约）
- **CLI + 安装器**：bin `lycx`，子命令 `init`/`doctor`/`status`/`uninstall` + 交互式菜单；init 向导四级采集（模式 → Agent → API 提供方 → 审查模型）；`doctor` 体检 OpenSpec CLI 与 skills
- **openspec 依赖 preflight**：安装器入口（裸命令 / init）检查 openspec CLI 与 `~/.codex/prompts/opsx-*.md`，缺失询问就地安装 / 拒绝列清单 / 失败不阻断
- **配置 `~/.ly/config.toml`**：旧 `~/.claude/.ly/config.toml` 首次读写时自动迁移（新位置已有配置不覆盖）
- **旧包迁移路径**：安装位与 ly-workflow 的 codex 分支同构（`~/.codex/prompts/ly-*.md` + `~/.ly/prompts/codex/`），卸载旧包或 `init --force` 覆盖即可迁移

### Changed

- 流程收敛为 Codex 单 Agent：同一会话内 propose → 自审 → apply → 修复编排，`apply` 恒为当前会话本人实施（读 tasks.md 逐任务实施 + 验证 + 勾 checkbox → commit `apply: <change>`）
- `/ly:propose` 保留上游编排语义：创建方案前隔离方式三选一（隔离 worktree【同会话 cd 续跑】/ 本项目切新分支 / 留在当前分支）+ 全自动/手动询问 + 方案自审（四项检查 + 逐项结论清单）+ 每步 commit
- `/ly:init` 生成文件从上游的 CLAUDE.md 改为 AGENTS.md（codex 宿主约定）

### Removed

- **claude 宿主**：`~/.claude/commands/` 安装路径、claude 专属提示词与相关安装/卸载逻辑
- **ly-wrapper / codeagent-wrapper**：TS/Go 审查包装器、Web UI（HTTP+SSE 进度页）、`--lite`/`LITE_MODE_FLAG` 门控全部移除
- **routing 概念**：`routing.reviewer`/`routing.implementer`、可选审查/实施后端（hermes/openclaw）、条件块渲染（`LY:IF:IMPLEMENTER_*`）不再存在
- **上游历史安装产物清理范围调整为 codex 侧**：`legacy-cleanup` 只清理 `~/.codex/AGENTS.md` LY 区块、`~/.codex/config.toml` 旧注释与 `[features.multi_agent_v2]`、`~/.codex/agents/ly-*.toml`
