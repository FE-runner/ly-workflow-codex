## Why

当前工作流在 `@lyx-fix`、`@lyx-propose`、`@lyx-review-plan` 与 `@lyx-review-code` 中会把补充边界用例和测试补齐机械升级为必做项，导致纯 UI、文案、样式改动以及非关键边界覆盖产生额外测试、重复审查轮次和快照噪声。需要统一改为按风险决定测试义务，同时保留逻辑 bug、行为契约和核心验收场景的测试底线。

## What Changes

- 新增按风险分级的测试策略：展示型改动、行为或契约改动、缺陷修复、补充边界覆盖分别采用不同的测试与验证要求。
- `@lyx-fix` 仅对逻辑、行为或契约改动强制复现测试；纯 UI、文案、样式允许不新增测试，但必须执行与改动相称的验证并记录原因。
- `@lyx-propose` 按同一策略生成 spec 与 tasks：纯展示改动允许不新增 delta spec、使用 `skip_specs: true`、不生成测试任务；补充边界覆盖不得被自动扩为实施任务。
- `@lyx-review-plan` 与 `@lyx-review-code` 不再把额外边界或测试补齐作为必须自动修复项；纯展示改动缺测试不形成发现，补充边界覆盖只记 Warning 快照，分别标注 `可自动修复：否` 与 `影响落地：否`。
- 保留核心行为未覆盖、逻辑 bug 缺复现测试、接口或配置契约不一致等原有阻断规则。
- 同步双宿主 reviewer 角色词、权威文档与模板断言测试；`@lyx-archive` 的完整验证门禁保持不变。

## Capabilities

### New Capabilities

- `risk-based-testing-policy`: 定义改动分类、测试义务、展示型改动的验证替代项，以及补充边界覆盖的记录口径。

### Modified Capabilities

- `lightweight-fix-flow`: 将固定先红后绿改为按风险分流，并调整自审中的验证检查。
- `ly-propose-flow`: 规定 propose 产出的 spec 与 tasks 如何落实测试策略。
- `ly-review-gates`: 规定 review-plan 与 review-code 对展示型改动、补充边界和测试补齐的发现与标注处置。

## Impact

- 模板：`templates/skills/fix.md`、`templates/skills/propose.md`、`templates/skills/review-plan.md`、`templates/skills/review-code.md`
- 双宿主角色词：Codex `reviewer.md` / `plan-reviewer.md`，Claude `lyx-reviewer.md` / `lyx-plan-reviewer.md`
- 主 spec：`lightweight-fix-flow`、`ly-propose-flow`、`ly-review-gates`，并新增 `risk-based-testing-policy`
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`README.zh-CN.md`、`templates/CLAUDE.md`
- 测试：模板文本与角色词一致性断言、纯展示豁免和补充边界记录规则断言
- 不改变：`@lyx-archive` 的测试、类型检查与构建完整验证；逻辑 bug 的复现测试要求；行为或契约缺口仍按 Critical 处理
