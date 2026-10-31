## Why

`lyx` 已经具备完整的 propose / review / apply / archive 纪律，但流程可靠性仍有三处结构性缺口：skill 模板主要靠文本存在性测试，无法证明 agent 会按规则行动；`propose`、`review-plan`、`review-code` 单文件过大，Claude Code 压缩后存在规则截断风险；审查流水线和任务进度依赖会话记忆，压缩或中断后无法稳定恢复。另有两类可低成本补强的执行纪律：任务计划缺少独立的“他人能否直接实施”检查，bug 修复与完成声明缺少统一的根因调查和新鲜证据格式。

## What Changes

- 新增核心 skill 行为评测基线：为 `propose`、`apply`、`review-plan`、`review-code` 记录触发条件、可见证据、禁止动作和压力场景；评测先不进入普通单测 CI，而作为修改高风险 skill 前的可复跑门禁。
- 将 `propose`、`review-plan`、`review-code` 的长规则拆到 skill 目录下的 `references/`，主 `SKILL.md` 只保留编排入口；安装器按宿主渲染并复制 sidecar references，skill description 收敛为“何时使用”，不再概括完整流程。
- 新增每个活跃 change 的 `run-state.md` 运行账本，记录阶段、基线/提交 SHA、任务进度、审查终止类型、验证证据、机械裁决和下一步；它不替代 `context.md`，作为 change artifact 随各生命周期阶段提交，归档时进入 archive。
- 在 propose 自审与 review-plan 中增加“实施就绪”检查：每个任务需要明确文件/定位锚点、接口、验证命令与预期结果，禁止含糊任务，并验证任务是可独立交付、验证和审查的最小单元。
- 在 `@lyx-fix` 的定位阶段增加系统调试门槛：先复现与确认根因，再修改；一次只验证一个假设；连续 3 次修复失败时停止猜修复并质疑架构。
- 在 apply、fix、review 与 archive 的报告中统一“新鲜证据”格式：完成声明必须引用本轮执行的命令、退出码和关键输出；subagent 自报成功不能代替主会话的 diff/文件清单核对。
- 更新中英文文档、宿主共享模板断言和新增能力的测试，不改变现有 15 个命令数量或命令名。

## Capabilities

### New Capabilities
- `skill-behavior-evals`: 定义核心 lyx skill 的行为评测场景、证据格式和高风险 skill 变更前的基线/压力测试门禁。
- `skill-reference-bundles`: 定义长 skill 的 `SKILL.md` + `references/` 分层契约、按需读取规则、安装渲染与发布包完整性。
- `execution-run-state`: 定义 `run-state.md` 的运行状态、机械裁决、验证证据、恢复语义以及与 context/review-findings 的边界。

### Modified Capabilities
- `ly-propose-flow`: 增加计划实施就绪自审、run-state 初始化、skill 描述收缩和长模板分层后的编排引用。
- `ly-review-gates`: 增加实施就绪审查、run-state 恢复输入和新鲜证据规则，同时保持现有分级、裁决与终止条件不变。
- `lightweight-fix-flow`: 增加系统调试门槛和三振后质疑架构的停止规则。
- `archive-verification-gate`: 把归档前完整验证结果写入 run-state，并在最终报告中引用新鲜证据。
- `multi-host-install`: 安装器扩展为同时渲染和复制 skill sidecar references，发布包与体检覆盖这些文件。

## Impact

- 影响 `templates/skills/`、`templates/hosts/`、安装器共享流程、模板渲染测试、打包测试、根文档与相关 OpenSpec 主 spec。
- 新增本地评测资产 docs 与 cases，不进入普通用户命令面。
- 安装产物会从单个 `SKILL.md` 扩展为 skill 目录内附带 `references/`；这是向后兼容的产物扩展，不要求用户迁移。
- 不改变现有 15 个命令、CLI 主流程、配置字段或提交 trailer 语义。
