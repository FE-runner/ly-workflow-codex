## Why

`lycx init` 的配置摘要把 review 侧字段"不生效"的理由一律渲染为"主 agent 执行时不生效"。当 `reviewMode = "off"` 而 `reviewExecutor = "subagent"`（既有值被 off 保留）时，摘要把不生效的原因错记成执行者，实际原因是审查范围被关闭——用户看到"审查执行者：spawn 独立子代理"紧邻"审查 agent A 模型 gpt-6-sol（主 agent 执行时不生效）"，会被误导。（菜单配置入口不渲染"不生效"标注，不涉及该缺陷。）

## What Changes

- 交互 `lycx init` 配置摘要中，review 侧模型 / 推理档的"不生效"标注按**真实原因**分流：`reviewMode = "off"` 时标注"审查范围 off，不生效"；否则沿用既有"主 agent 执行时不生效"（`reviewExecutor = "main"`）。菜单配置入口不渲染"不生效"标注，不在本次范围内。
- 未覆盖的 review 推理档同样按原因分流：`off` 时显示"审查范围 off，不生效（未覆盖）"，而非"主 agent 执行时不生效（未覆盖）"。
- 新增 zh-CN / en 文案键；`subagent-agent-config` 主 spec 补"摘要不生效理由按原因分流"契约。
- 补测试覆盖 `reviewMode=off` + `reviewExecutor=subagent` 的摘要文案。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `subagent-agent-config`: 交互 `lycx init` 配置摘要中，review 侧模型与推理档字段的"不生效"标注须按原因分流（`reviewMode=off` → 审查范围 off；`reviewExecutor=main` → 主 agent 执行），不得把两类原因混用同一文案。

## Impact

- 代码：`src/commands/init.ts`（`printSummary` 的模型 / 推理档标注分流）、`src/i18n/index.ts`（zh-CN / en 新增文案键）。
- 测试：`src/commands/__tests__/init.test.ts`（`off` + `subagent` 组合的摘要断言）。
- 兼容：仅影响摘要文案；配置写入、门控行为、doctor 输出均不变。
