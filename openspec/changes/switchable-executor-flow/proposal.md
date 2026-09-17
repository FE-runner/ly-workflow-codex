## Why

当前流程把审查与实施固定为"spawn 独立 subagent"，主 agent 直接执行只作为环境不可用时的回退路径。实际使用暴露出两个问题。

一是子代理路径的可用性不可靠：实测同一个 app 版本、同一个模型与 provider 下，不同会话的工具注册形式不同——一个会话能 spawn 子代理，另一个会话调用直接返回 `unsupported call`。这意味着"独立审查"这个默认承诺在部分环境下并不成立，而流程仍按"有独立审查"的口径产出报告。

二是耗时：审查循环每轮重新 spawn 全新子代理，每轮都要冷启动并全量重建上下文；测试 / 类型检查 / 构建又在审查循环每轮执行一次。两项叠加，使一次完整的 propose → review → apply → review 流水线耗时明显。

同时，实测确认子代理支持跨轮复用：首次任务完成后可用 `send_input` 唤醒同一个子代理，且它保留自己的会话上下文。这直接推翻了模板中"回合结束即失去访问能力"的假设。

## What Changes

- 新增 `[codexHost] reviewExecutor` 与 `codingExecutor`，取值 `main` / `subagent`，未配置等价 `main`。**BREAKING**
- 主 agent 成为默认执行者。升级用户即使不改配置，行为也会从"spawn 子代理"变为"主 agent 直接执行"。**BREAKING**
- 主 agent 执行路径：不 spawn、不进入逐条裁决、不适用驳回硬线 / 熔断，自审循环最多 2 轮。
- 子代理执行路径：保留现有审查-修复循环，但默认以 `send_input` 复用同一子代理；复用失败再回退重新 spawn。
- 测试 / 类型检查 / 构建从审查循环移出，改为归档前执行一次完整验证；`openspec validate` 仍保留在 review-plan 每轮。
- 移除 `reviewModelB` / `reviewReasoningEffortB` 两个弃用字段及其读取、保留、doctor 提示逻辑。**BREAKING**
- 不做 spawn 可用性预探测；配置为 `subagent` 时首次 spawn 失败即按环境级不可用回退主 agent，流程不中断。
- 修正模板中"子 agent 会话随主会话回合结构而存在，回合结束即失去访问能力"的表述。

## Capabilities

### New Capabilities

- `archive-verification-gate`: 归档前的完整验证关卡——`@lyx-archive` 在委托 OpenSpec 归档前执行项目完整验证（测试 / 类型检查 / 构建），验证失败阻断归档，不移动 change 目录。

### Modified Capabilities

- `ly-review-gates`: 审查关卡改为执行者可切换；新增主 agent 路径的分级发现与自审循环；子代理路径默认复用同一子代理；测试 / 类型检查 / 构建移出循环。
- `subagent-agent-config`: 新增 `reviewExecutor` / `codingExecutor` 字段与默认值；移除 `reviewModelB` / `reviewReasoningEffortB`；init 向导采集与 doctor 展示随之调整。
- `ly-propose-flow`: 全自动流水线按新的执行者语义衔接，主 agent 路径下的循环终止与提交时机。
- `ly-lifecycle-commands`: `apply` 的实施主体按执行者字段决定；`archive` 增加归档前验证前置步骤。
- `review-context-artifact`: `context.md` 的角色从"唯一软上下文通道"调整为"子代理路径的软上下文通道 + 全路径的决策留痕"。

## Impact

- 模板：`templates/skills-codex/review-plan.md`、`review-code.md`、`apply.md`、`archive.md`、`propose.md`
- 源码：`src/types/index.ts`、`src/utils/config.ts`、`src/utils/host-adapters.ts`、`src/utils/installer-data.ts`、`src/utils/installer-template.ts`、`src/commands/init.ts`、`src/commands/menu.ts`、`src/commands/doctor.ts`、`src/i18n/index.ts`
- 文档：`README.md`、`CLAUDE.md`、`AGENTS.md`、`templates/CLAUDE.md`、`workflow.md`
- 配置：`~/.codex/lyx/config.toml` 新增两个执行者字段、移除两个弃用字段
- 迁移：升级用户若想保留独立审查 / 独立实施，必须显式配置 `reviewExecutor = "subagent"` / `codingExecutor = "subagent"`
