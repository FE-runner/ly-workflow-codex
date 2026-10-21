## Context

参见 `proposal.md` 的 Why。当前 `[host]` 已有按宿主保存的 `reviewMode`、执行者和模型配置；`lycx init` 与菜单共用 `collectSubagentConfig` 采集配置，Codex / Claude doctor 分别读取宿主配置。工作流模板默认按 `risk-based-testing-policy` 决定测试义务，`@lyx-archive` 再执行测试 / 类型检查 / 构建完整验证。

`@lyx-fix` 当前刻意不读取宿主配置，`@lyx-apply` / `@lyx-review-*` 已按宿主读取执行者字段，`@lyx-archive` 尚无测试模式入口。因此本 change 必须明确增加一个最小配置读取例外，而不是通过环境变量或命令临时参数传递模式。

## Goals / Non-Goals

**Goals:**

- 提供持久化、可审计的每宿主 `testMode = normal | off`。
- 在无测试模式下同时关闭测试文件写入、测试任务生成和测试命令执行。
- 保留类型检查、构建、spec/行为覆盖和安全/契约审查等非测试门禁。
- 保持未配置用户的现有行为不变，并覆盖 Codex / Claude 两个宿主。

**Non-Goals:**

- 不改变项目自身 `package.json` 脚本、npm 发布 workflow 或 CI 中的测试配置。
- 不提供单次命令级 `--no-test` 覆盖；同类模式以宿主配置为唯一来源。
- 不自动删除或改写已有历史测试文件。
- 不因无测试模式放宽核心行为、接口契约、安全或数据完整性要求。

## Decisions

### D1. 使用宿主级 `testMode: normal | off`

`testMode` 与 `reviewMode` 同属 `[host]` 配置，未配置、空白或非法值等价 `normal`。配置清洗、默认配置生成、宿主字段合并与重写均保留合法值；非法值由 doctor 告警。配置文件缺失、不可读或解析失败时按“测试模式未知”停止测试相关动作，避免静默回退 `normal`。相比环境变量，宿主配置可持久化、可展示、可由 init/menu 管理；相比命令级参数，它避免同一次 change 在不同阶段使用不同模式。

### D2. 复用现有配置采集入口，新增模式一问

`collectSubagentConfig` 继续作为 init 与菜单共用的配置采集函数，并在审查范围之前新增 `testMode` 选择。两个宿主的提示与展示使用同一语义，i18n 键在 zh-CN / en 同步。配置摘要与菜单状态行展示当前模式；doctor 在两个宿主分组中展示模式，非法值输出 WARN。

### D3. `@lyx-fix` 只读取 testMode，不读取其他宿主配置

`@lyx-fix` 保持主 agent 执行、不读执行者 / 模型字段的边界，仅新增读取当前宿主 `[host].testMode` 的最小例外。`off` 时不写测试、不跑测试；`normal` 时继续适用风险测试策略。

替代方案是让 fix 完全感知全部 `[host]` 配置；这会改变其“轻量、固定主 agent”的边界，超出本功能需要。

### D4. 无测试模式在生成、实施、审查、归档四处同时生效

- propose：不生成测试文件或测试命令任务，行为契约 spec 仍生成，验证任务限定为非测试检查。
- apply：不执行测试命令；若 tasks 中遗留测试专用任务，跳过并输出 `[跳过] ...（testMode=off）`。混合任务保留非测试实现部分，只跳过测试部分；测试专用任务标记为已跳过，避免 apply 永久停在进行中。
- review-plan / review-code：不产生缺测试、缺测试任务、边界测试或覆盖率类发现；非测试类核心缺口继续判级。
- archive：跳过测试类别，仍执行 typecheck / build，并报告“testMode=off，测试已跳过”。

替代方案只影响 propose 或 archive 单点；那会造成 tasks 仍生成测试、review 仍要求测试或 archive 仍执行测试，模式不完整。

### D5. 双宿主角色词与共享模板继续逐字一致

review-plan / review-code 的无测试模式规则同时写入共享模板、Codex 角色词和 Claude 角色词；现有逐字一致性测试继续守护。fix / propose / apply / archive 的模板文本增加显式 `testMode` 分支，并由 `host-adapters.test.ts` 断言关键行为。

### D6. 正常模式完全保持现状

所有新增规则以 `testMode = "off"` 为前置条件。未配置字段的升级用户默认 `normal`，无需迁移；回滚只需移除字段并重跑安装器或恢复配置与模板。

## Risks / Trade-offs

- **无测试模式掩盖回归风险** → 保持 typecheck、build、核心行为覆盖、契约与安全审查；doctor 与每个命令显式展示当前模式。
- **`@lyx-fix` 的配置边界被扩大** → 仅允许读取 `testMode`，模板与测试继续断言其余执行者 / 模型字段不影响 fix。
- **已有 tasks 含测试步骤时 apply 卡住** → 测试专用步骤显式跳过并标记，混合任务只跳过测试部分、保留实现部分。
- **双宿主文案和配置漂移** → i18n 双语言同步、host-adapters 文本断言、Codex / Claude doctor 测试共同覆盖。
- **用户误以为无测试模式关闭所有验证** → README、AGENTS 与命令输出明确区分“测试”与“类型检查 / 构建 / 审查”。

## Migration Plan

1. 扩展配置类型、清洗、合并与采集展示。
2. 更新 fix / propose / apply / archive / review 模板和双宿主角色词。
3. 更新断言、i18n 与文档。
4. 运行 `pnpm test`、`pnpm typecheck`、`pnpm build` 与 OpenSpec 校验。
5. 归档后按正常发版流程发布；用户未配置 `testMode` 时保持 `normal`。
