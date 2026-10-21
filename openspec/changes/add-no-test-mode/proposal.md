## Why

现有工作流默认要求编写和执行测试，但部分交付场景需要明确关闭测试工作：不新增或修改测试文件、不生成测试任务，也不运行测试命令。需要提供显式、可持久化的无测试模式，避免执行者临场绕过既有测试门禁，同时保持类型检查与构建验证。

## What Changes

- 新增每宿主配置 `[host] testMode`，取值 `normal` / `off`；未配置、空白或非法值等价 `normal`。
- `lycx init` 与菜单配置入口采集 `testMode`，配置摘要与 `lycx doctor` 展示当前值；非法值输出 WARN。
- `testMode = "off"` 时，`@lyx-fix`、`@lyx-propose`、`@lyx-apply`、`@lyx-review-plan`、`@lyx-review-code` 与 `@lyx-archive` 均不新增或修改测试文件、不生成测试任务、不执行测试命令。
- `@lyx-propose` 在无测试模式下仍生成行为契约所需的 spec，但不生成测试任务；`@lyx-apply` 遇到测试专用任务时跳过并明确标注。
- 审查关卡在无测试模式下不产生“缺少测试”类 Critical / Warning / Info；核心行为未覆盖、接口或配置契约不一致等非测试问题仍按既有规则处理。
- `@lyx-archive` 在无测试模式下跳过测试类别，仍执行项目提供的类型检查与构建，并显式报告测试被跳过。
- 默认 `normal` 保持现有风险测试策略；无测试模式是显式 opt-in，不改变现有配置用户的行为。

## Capabilities

### New Capabilities

- `test-mode`: 定义每宿主 `testMode` 配置、默认值、采集与 doctor 展示，以及无测试模式对测试文件、测试任务与测试命令的跨流程约束。

### Modified Capabilities

- `lightweight-fix-flow`: `@lyx-fix` 在无测试模式下跳过测试文件与测试命令，同时保留实现、spec、自审和 typecheck。
- `ly-propose-flow`: 无测试模式下 propose 不生成测试任务，apply 跳过测试专用任务。
- `ly-review-gates`: 无测试模式下审查不产生测试相关发现，非测试类问题仍正常判级。
- `archive-verification-gate`: 无测试模式下归档前验证跳过测试类别，仍执行类型检查与构建。

## Impact

- 配置类型与读写：`src/types/index.ts`、`src/utils/config.ts`
- 交互与体检：`src/commands/init.ts`、`src/menu.ts`、`src/commands/collect-subagent-config.ts`、`src/i18n/index.ts`、Codex / Claude doctor
- 工作流模板：`templates/skills/fix.md`、`propose.md`、`apply.md`、`archive.md`、`review-plan.md`、`review-code.md`
- 双宿主角色词与模板断言测试
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`README.zh-CN.md`、`templates/CLAUDE.md`
- 不改变 npm 发布 workflow、项目自身 `package.json` 脚本或默认 `normal` 模式
