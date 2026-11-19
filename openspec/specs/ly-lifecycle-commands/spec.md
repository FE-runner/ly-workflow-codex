## Purpose

提供五个统一前缀的 `/ly:*` 命令：`explore` 是纯委托（不附加自定义编排逻辑）；`init`/`archive` 各自在 OpenSpec 原生 `init`/`archive` 能力前后串接文件生成与自动提交（`apply` 由当前会话本人实施 tasks，实施完成后立即提交 apply 阶段 commit（CC 前缀 + `Change-Stage: apply` trailer）——无隔离检测、无外部委托，隔离 worktree 由 `/ly:propose` 创建方案前决定）；`propose` 是收尾编排的入口——委托 `opsx:propose` 生成方案之外，还负责创建方案前的隔离方式三选一询问、全自动/手动询问、方案自审、每步 commit（CC 前缀 + `Change-Stage`/`Change-Name` trailer）与全自动流水线（review-plan → apply → review-code）。

## Requirements

### Requirement: init 命令串联 AGENTS.md 生成、OpenSpec 初始化与提交
`/ly:init` 必须（SHALL）按顺序执行三步：（1）由当前会话直接生成/更新项目根目录的项目记忆文件（单 Agent 模式，无外部技能委托）：以 `$ARGUMENTS` 为线索结合当前仓库结构，写清模块职责、入口与启动方式、核心类型、构建/测试命令、关键约定；已存在时增量更新，不推翻既有内容；（2）复用与 `lycx init` / `lycx doctor` 相同的 OpenSpec 依赖检查模型，检查 CLI、skills 与 OpenSpec root，并执行项目级修复：CLI 缺失时先安装 `@fission-ai/openspec@latest`；root 缺失时运行 `openspec init --tools <当前宿主的 tools 取值>`；root 存在但 skills 为 `missing` 时针对缺失技能的宿主运行 `openspec init --tools <该宿主>` 补齐（必要时以 `openspec update --force` 刷新）；仅全局可用时输出 WARN 并继续，不自动固化项目级；修复后复查，若 root 仍不健康或 required skills 仍缺失则停止并报告 `openspec doctor --json` / 缺失清单；（3）若步骤 1-2 产生了实际文件变动，暂存本次实际产出的项目记忆文件与 `openspec/` 并执行一次 commit。前两步都不得静默跳过；如果 `openspec` CLI 未安装，命令必须先安装它再继续。第三步若无可提交内容或 `git commit` 本身失败，SHALL 跳过提交并在汇总中如实报告，SHALL NOT 因此中断或视为命令失败。

**项目记忆产出按宿主（自本 change 起）**：步骤 1 产出的文件集合 SHALL 按当前宿主确定。codex 宿主产出项目根目录的 `AGENTS.md`；claude 宿主在 `AGENTS.md` 之外 SHALL 额外产出或更新导入 `AGENTS.md` 的 `CLAUDE.md`，使该宿主能实际加载项目指令（该宿主仅在项目无 `CLAUDE.md` 时读取 `AGENTS.md`）。目标记忆文件已存在且含用户内容时 SHALL 增量更新，SHALL NOT 覆盖既有章节。步骤 3 的暂存范围与步骤 4 的汇总 SHALL 与本次实际产出的记忆文件集合一致。

**OpenSpec 修复命令按宿主（自本 change 起）**：`--tools` 取值 SHALL 按宿主映射（codex 宿主对应 `codex`，claude 宿主对应 `claude`），SHALL NOT 固定为单一宿主；仅对确实缺少项目级技能的宿主执行补齐，SHALL NOT 因补齐一个宿主而重建或清理另一宿主的 OpenSpec 产物。

**本能力其他 Requirement 的配置载体与命令标识按宿主解读（自本 change 起）**：本能力其余 Requirement 正文中出现的 `~/.codex/lyx/config.toml` 与 `[codexHost]` SHALL 按宿主作用域解读（见 `multi-host-install` 与 `subagent-agent-config`）——claude 宿主对应该宿主的配置文件与宿主配置节，字段语义两宿主一致。正文中以 `@lyx-<command>` 形式出现的命令引用 SHALL 视为命令标识，其宿主调用写法由各宿主定义（见 `multi-host-install` 的命令标识约定）。

#### Scenario: 全新项目, 既无 AGENTS.md 也无 openspec/ 目录
- **WHEN** 用户在既无 AGENTS.md 也无 `openspec/` 目录的项目中运行 `/ly:init`
- **THEN** 命令由当前会话直接生成 AGENTS.md，通过共享检查器确认 CLI 可用后运行 `openspec init --tools <当前宿主对应取值>` 初始化 `openspec/` 与项目级 skills，复查通过后提交这两部分产物

#### Scenario: openspec CLI 未安装
- **WHEN** 用户运行 `/ly:init` 且 PATH 中找不到 `openspec` 命令
- **THEN** 命令先全局安装 `@fission-ai/openspec`，再通过共享检查器确认 CLI 可用，随后运行 `openspec init --tools <当前宿主对应取值>`，完成后提交产物

#### Scenario: 仅全局 skills 可用时 WARN 并继续
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但 required skills 仅能在当前宿主对应的全局技能根中可发现
- **THEN** 命令输出 `global-only` WARN，说明命令可用但未固化到当前项目，然后继续后续步骤，SHALL NOT 自动运行 `openspec update --force`

#### Scenario: 必需 skills 缺失时修复
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 OpenSpec root 已存在，但某个 required skill 在项目级与全局级均缺失
- **THEN** 命令针对当前宿主运行 `openspec init --tools <当前宿主对应取值>` 补齐；若仍缺失则以 `openspec update --force` 刷新；复查仍失败时停止并输出缺失 skill 清单

#### Scenario: OpenSpec root 不健康时阻断
- **WHEN** 用户运行 `/ly:init`，openspec CLI 与 required skills 可用，但 `openspec doctor --json` 返回 root 不健康
- **THEN** 命令输出 `openspec doctor --json` 的错误状态与 fix 建议，停止初始化提交步骤，SHALL NOT 将不健康状态静默通过

#### Scenario: init 无新变动, 跳过提交
- **WHEN** 用户在项目记忆文件与 `openspec/` 均已存在且未发生变化，且共享 OpenSpec 依赖检查通过的项目中运行 `/ly:init`
- **THEN** 命令跳过 commit 步骤，在汇总中如实说明无变动可提交，不视为失败

#### Scenario: claude 宿主额外产出可加载的项目记忆
- **WHEN** 在 claude 宿主下运行 `/ly:init`，项目根目录不存在 `CLAUDE.md`
- **THEN** 命令在生成或更新 `AGENTS.md` 之外产出导入它的 `CLAUDE.md`，步骤 3 的暂存文件集合包含该文件，汇总中一并列出

#### Scenario: 既有 CLAUDE.md 增量更新
- **WHEN** 在 claude 宿主下运行 `/ly:init`，项目根目录已存在含用户内容的 `CLAUDE.md`
- **THEN** 命令增量更新并保留既有章节，SHALL NOT 整体覆盖或删除用户内容

#### Scenario: 补齐宿主技能不重建另一宿主产物
- **WHEN** 在 claude 宿主下运行 `/ly:init` 且项目中已存在 codex 宿主产生的 OpenSpec 技能目录
- **THEN** 命令只为当前缺失技能的宿主执行补齐，既有另一宿主目录保持原样，SHALL NOT 被重建或清理

### Requirement: 生命周期命令自动提交使用增强正文

`/ly:init`、`/ly:apply`、`/ly:archive` 与 `/ly:propose` 生成的自动提交 SHALL 按 `commit-conventions` 的“lyx 生成提交统一复用 `@lyx-commit` 正文规范”生成 message 正文。change 生命周期命令（apply/archive/propose 阶段 commit）SHALL 在正文后追加既有 change trailer；非 change 生命周期提交（init、propose WIP）SHALL 遵守正文规范但不追加 `Change-Stage` / `Change-Name` trailer。

#### Scenario: init 提交包含正文
- **WHEN** `/ly:init` 生成 AGENTS.md 与 `openspec/` 初始化产物并提交
- **THEN** commit message 包含动机、改动、影响正文，且不携带 `Change-Stage` / `Change-Name` trailer

#### Scenario: apply 提交包含实施正文
- **WHEN** `/ly:apply` 完成实施并提交本次实际改动
- **THEN** commit message 在既有 apply trailer 之前包含实施要点、验证或风险说明

#### Scenario: archive 提交包含归档正文
- **WHEN** `/ly:archive` 完成归档并提交 `openspec/` 下文件移动
- **THEN** commit message 在既有 archive trailer 之前包含归档对象与 spec 同步说明

#### Scenario: propose WIP 提交包含正文
- **WHEN** `/ly:propose` 创建 WIP commit 暂存切分支前的工作区改动
- **THEN** commit message 包含动机、改动、影响正文，但不携带 `Change-Stage` / `Change-Name` trailer

### Requirement: apply 使用 lyx 包装的简化 skills

`@lyx-apply` 的 `main` 与 `subagent` 两条实施路径 SHALL 在实施前读取并应用 `lyx-ponytail`，并在全部 tasks 完成任务级验证后、主会话确认前读取并应用 `lyx-code-simplification`。简化收口只覆盖本次 change 已改代码，SHALL 保持行为、错误路径和测试语义不变，且 SHALL NOT 新增独立 commit 或修改范围外文件。

简化若改动代码，实施者 SHALL 重跑受影响的任务级验证并回传“命令 + 退出码 + 结果摘要”。`testMode = "off"` 时不运行测试命令，改用任务指定的 typecheck 或其他非测试验证。任一包装 skill 缺失或不可读时 apply SHALL 停止并报告路径。

#### Scenario: main 路径先最小实施再简化
- **WHEN** `codingExecutor = "main"` 且 tasks 全部通过任务级验证
- **THEN** 主 agent 在提交前只整理本次 change 的 diff，简化后重跑受影响验证，再进入主会话确认

#### Scenario: subagent 路径回传简化证据
- **WHEN** `codingExecutor = "subagent"` 且 coding subagent 完成全部 tasks
- **THEN** subagent 应用两个包装 skill，把简化后的文件清单与新鲜验证证据随结果回传，不自行 commit

### Requirement: 生命周期命令不依赖持久运行账本
propose、apply、review-plan、review-code 与 archive SHALL NOT 创建、读取或更新 `run-state.md`。阶段身份 SHALL 由 Git commit trailer 和当前会话结果确定；任务进度 SHALL 由 `tasks.md` 勾选确定；讨论决策与隔离信息 SHALL 来自 `context.md`；未修审查项 SHALL 来自 `review-findings.md`。命令遇到信息不足时 SHALL 询问用户或根据当前 Git 事实进入保守路径，SHALL NOT 虚构历史阶段。

#### Scenario: apply 识别已完成任务
- **WHEN** 用户重新调用 `@lyx-apply <change-name>`
- **THEN** 命令读取 `tasks.md`、Git diff 与 apply 阶段 commit，不读取 run-state

#### Scenario: review 识别审查基线
- **WHEN** 用户调用 `@lyx-review-plan` 或 `@lyx-review-code`
- **THEN** 命令通过 `Change-Stage` / `Change-Name` trailer 定位对应阶段 commit

### Requirement: apply 按批次执行低风险验证
`@lyx-apply` SHALL 读取 tasks 中每个任务的验证要求，并允许连续、使用相同命令且无独立风险边界的低风险任务共享一次批次验证。行为或契约改动、逻辑缺陷复现、安全或迁移任务，以及 tasks 明确声明为独立验证单元的任务 SHALL 保留自身验证检查点。批次验证通过后 MAY 一次性勾选该批次全部任务；任一任务失败时 SHALL 报告批次中失败的检查点并停止自动勾选后续任务。

#### Scenario: 低风险任务同命令合并
- **WHEN** 连续三个文档或配置任务都要求 `pnpm typecheck`
- **THEN** apply 在批次结束时运行一次 typecheck，并据结果勾选三个任务

#### Scenario: 高风险任务不合并
- **WHEN** 一个任务要求先写失败复现测试
- **THEN** 该任务独立运行测试，不等待其他任务

### Requirement: archive 从当前 Git 与 context 推导分支收尾
`@lyx-archive` 在归档提交成功后 SHALL 根据当前分支、`git worktree list --porcelain` 和 `context.md` 的 `## 执行上下文` 识别开发分支、来源分支与 worktree 候选。当前会话仍保有 propose 隔离选择时 MAY 直接使用该值；新回合信息不足时 SHALL 询问目标分支或跳过收尾，SHALL NOT 默认猜测 `main` / `master`。所有 merge、worktree 删除和分支删除仍须用户确认，并保持现有失败保留现场规则。

#### Scenario: context 含来源分支
- **WHEN** 归档后的 `context.md` 记录来源分支 `main`、开发分支 `feature/login` 和当前 worktree 路径
- **THEN** archive 校验 Git 状态后提示是否合并和清理

#### Scenario: 新回合缺少来源分支
- **WHEN** archive 在新会话运行且 context 与当前会话都没有来源分支
- **THEN** 命令要求用户选择目标分支或跳过收尾

### Requirement: Explore 与 Apply 保持既有委托和实施职责
`@lyx-explore` SHALL 在委托前扫描 active 与 archive 下的 `review-findings.md`；只有存在至少一个未解决 Warning 时才询问是否列出，无命中或全部已解决时不询问；读取失败 SHALL 如实注明，不中断参数转发。之后 SHALL 原样转发参数给 `opsx:explore`，并在收敛时按规模提示 `@lyx-fix` 或 `@lyx-propose`。`@lyx-apply` SHALL 按显式参数中的合法 change 名 → 唯一未归档 change → 无法唯一确定时询问用户的优先级解析目标，按 `codingExecutor` 选择主体，只实施当前工作区 tasks，不调用 wrapper、不做 worktree 切换。

#### Scenario: explore 原样转发
- **WHEN** 用户运行 `@lyx-explore "实时协作"`
- **THEN** 命令先按未解决 Warning 条件决定是否询问，再原样转发参数

#### Scenario: apply 配置为 subagent
- **WHEN** `codingExecutor = "subagent"`
- **THEN** 非 fork coding subagent 读取 tasks 与 context 后实施并回传，不自行 commit

#### Scenario: apply 配置为 main
- **WHEN** `codingExecutor = "main"` 或未配置
- **THEN** 主 agent 直接实施 tasks，不 spawn、不产生回退标记

#### Scenario: apply 目标解析
- **WHEN** 参数未指定 change 且有多个未归档 change
- **THEN** 命令询问目标，不猜测

### Requirement: Archive 保留目标确定、验证与 delta 同步职责
`@lyx-archive` SHALL 先执行 `archive-verification-gate`，全部通过后才委托 `opsx:archive`。显式 change 参数 SHALL 原样转发；未指定时，命令 SHALL 先按 OpenSpec 默认规则确定唯一目标并在需要时询问，再把已确定的 change 名传入，SHALL NOT 让下游二次推断或询问。存在 delta 变更时 SHALL 直接采用 `Sync now (recommended)`，已同步时采用 `Archive now`，不得就同步方式询问。验证失败 SHALL 不移动 change。

#### Scenario: archive 已确定目标
- **WHEN** 用户运行 archive 未带参数且命令确定目标为 `foo`
- **THEN** 以 `foo` 委托 `opsx:archive`，不允许二次询问

#### Scenario: archive 同步 delta
- **WHEN** change 存在 delta 变更
- **THEN** 直接采用 Sync now，不询问同步方式

#### Scenario: archive 验证失败
- **WHEN** 测试或类型检查失败
- **THEN** 停止并保留 active change

### Requirement: Apply 按实际差异统一提交
主会话确认实施结果后 SHALL 按实际文件清单暂存和提交；范围外预存改动 SHALL NOT 被纳入。提交使用 `<cc-type>(<scope>): <subject>`、正文和 `Change-Stage: apply` / `Change-Name` trailer，提交后校验文件集合。无实际变化时 SHALL 跳过，不创建空 commit。验证批次规则 SHALL 遵循 `risk-based-testing-policy`。

#### Scenario: apply 有实际改动
- **WHEN** tasks 通过验证并产生实际文件变化
- **THEN** 主会话只暂存本次文件并创建 apply commit

#### Scenario: apply 无实际改动
- **WHEN** tasks 完成但工作区没有变化
- **THEN** 跳过提交

#### Scenario: 范围外预存改动
- **WHEN** apply 前已有无关 dirty 文件
- **THEN** 提交清单不包含该文件，并在报告说明

### Requirement: Propose 作为无 run-state 编排入口
`@lyx-propose` SHALL 在委托 `opsx:propose` 前询问隔离方式与全自动/手动模式，生成 artifacts 后在 `context.md` 写压缩自审，再提交 propose 阶段 commit。全自动路径 SHALL 按 `reviewMode` 执行 review-plan、apply、review-code；被跳过关卡 SHALL 打印状态行。命令 SHALL NOT 创建或更新 run-state；阶段只由当前未中断全自动回合、commit trailer、tasks 与 Git 事实衔接。手动路径 SHALL 按 `reviewMode` 决定是否询问 review-plan。

#### Scenario: propose 委托前询问
- **WHEN** 用户在非 worktree 工作区运行 propose
- **THEN** 先询问隔离方式，再询问全自动/手动

#### Scenario: propose 全自动
- **WHEN** 用户选择全自动且 reviewMode 为 full
- **THEN** propose commit 后按 review-plan → apply → review-code 在同一回合继续，不写 run-state

#### Scenario: propose 手动
- **WHEN** 用户选择手动且 reviewMode 为 full 或 plan-only
- **THEN** propose commit 后询问是否运行 review-plan，不自动 apply

#### Scenario: 审查范围关闭
- **WHEN** reviewMode 为 off
- **THEN** 打印跳过状态，propose 完成后全自动仅执行 apply，手动路径直接结束
