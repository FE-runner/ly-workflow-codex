## Why

`@lyx-propose` 的编排链路固定跑 review-plan → apply → review-code，用户无法在配置层关闭审查；手动路径虽能对 "要不要跑 review-plan" 答否，但既不能持久、也无法只关其中一级。同时不同场景的审查诉求不同：有时只想要代码审查、有时只想要方案审查、有时完全不需要。缺一个可配置、可复用的审查范围开关。

## What Changes

- `[host]` 新增可选字段 `reviewMode`，取值 `full` | `plan-only` | `code-only` | `off`；未配置、空白或非法值等价 `full`（存量配置行为不变）。
- `@lyx-propose` 编排（全自动流水线 + 手动路径）按 `reviewMode` 决定跑哪些审查关卡：`plan-only` 跳过 review-code，`code-only` 跳过 review-plan，`off` 两级都跳过；跳过的关卡打印显式状态行，不静默。跳过审查关卡时对应节点前置校验一并跳过。
- **直接调用** `@lyx-review-plan` / `@lyx-review-code` **不受 `reviewMode` 影响，照常审查**。
- `@lyx-apply` 与 `@lyx-archive` 的归档前完整验证不受 `reviewMode` 影响（审查与实施、慢验证解耦）。
- 交互 `lycx init` 与菜单配置入口采集 `reviewMode`（作为子代理配置整段的开头一问）；`reviewMode = off` 时跳过 review 侧执行者 / 模型 / 推理档的提问，既有值原样保留。
- `lycx doctor` 与配置摘要展示 `reviewMode`；`off` 且配置了 review 侧执行者 / 模型 / 推理档字段时输出 WARN（字段不生效）。
- 配置读写链路（类型定义、清洗、合并、重写保留）全链路带上 `reviewMode`。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `subagent-agent-config`: 新增 `[host].reviewMode` 字段契约（取值、默认回退、清洗、重写保留），并在 init 采集与 doctor 体检 Requirement 中加入 `reviewMode` 的处理与 `off` + 不生效字段的 WARN。
- `ly-propose-flow`: 全自动流水线与手动路径按 `reviewMode` 决定执行哪些审查关卡，跳过时打印显式状态行并跳过对应节点前置校验。
- `ly-lifecycle-commands`: `/ly:propose` 全自动路径的审查关卡调用由固定顺序改为受 `reviewMode` 门控。
- `ly-review-gates`: 明确 `@lyx-review-plan` / `@lyx-review-code` 被直接调用时的行为不受 `reviewMode` 影响。

## Impact

- 配置层：`src/types/index.ts`、`src/utils/config.ts`（新增 `sanitizeReviewMode`、`HostSection.reviewMode`、`createDefaultConfig` / `mergeHostConfig` / `HostExtras` 携带该字段）。
- 命令层：`src/commands/collect-subagent-config.ts`（采集新问题与 `off` 跳过）、`init.ts`（摘要）、`menu.ts`（摘要与重装）、`doctor.ts`（展示与 WARN）、`src/i18n/index.ts`（zh-CN / en 文案）。
- 模板层：`templates/skills/propose.md`（两宿主共享正文，渲染产物随之变化）。
- 文档/spec：上述四个能力的主 spec 与根文档 `AGENTS.md` / `CLAUDE.md` / `README.md` / `README.zh-CN.md` 的配置与流程段落；`CHANGELOG.md` 记一条。
- 测试：`src/utils/__tests__/config.test.ts`、`src/commands/__tests__/init.test.ts`、`menu-config.test.ts`、`doctor.test.ts`、`src/utils/__tests__/host-adapters.test.ts`。
- 兼容：`reviewMode` 为新增可选字段，未配置等价 `full`，升级用户不改配置时行为与当前一致。
