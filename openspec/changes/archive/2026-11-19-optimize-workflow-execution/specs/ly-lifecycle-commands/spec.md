## REMOVED Requirements

### Requirement: 生命周期命令以 run-state 作为 lyx 状态源
**Reason**: 新流程删除 run-state，生命周期命令改为从 Git、tasks、context 和 commit trailer 获取事实。
**Migration**: 存量文件保持原样；后续命令不读取其中状态，缺失决策时由当前调用重新询问或使用显式配置。

### Requirement: archive 归档提交后进入分支收尾流程
**Reason**: 原要求绑定归档后 run-state isolation metadata，需替换为不依赖账本的收尾流程。
**Migration**: 归档提交后仍执行分支收尾，但候选分支从当前 Git 与 `context.md` 推导，信息不足时询问用户。

### Requirement: Explore 命令是纯委托；Apply 由当前会话本人实施完成立即提交；Propose 是编排入口
**Reason**: 原要求正文仍规定 propose 自审写入 run-state，与本次无账本流程冲突。
**Migration**: 拆分为无 run-state 的 Explore/Apply、Apply 提交和 Propose 编排要求，保留已有命令职责。

## ADDED Requirements

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
