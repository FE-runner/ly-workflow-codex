## 1. 配置、CLI 与展示

- [x] 1.1 在 `src/types/index.ts`、`src/utils/config.ts` 与 `src/utils/host-adapters.ts` 把 `TestMode` / `TEST_MODES` / `sanitizeTestMode` / `HostAdapterConfig.testMode` 扩展为 `normal | off | ask`，并扩展 `src/utils/__tests__/config.test.ts` / `host-adapters.test.ts` 覆盖宿主默认、项目覆盖、适配器配置、非法值与读写保留；运行 focused Vitest
- [x] 1.2 更新 `src/commands/collect-subagent-config.ts`、`src/commands/init.ts`、`src/commands/menu.ts` 与 `src/i18n/index.ts`，让 init/menu 采集三取值并说明 `ask` 的 change 级语义；扩展 `init.test.ts` / `menu-config.test.ts` 并运行 focused Vitest
- [x] 1.3 更新 `src/commands/project.ts` 与 CLI help，使 `lycx project test-mode ask` 可设置、doctor/status 可展示 `ask`；新增 `src/utils/__tests__/project-config.test.ts` 覆盖 ask 项目覆盖命中、非法覆盖回退、宿主非法回退 normal、配置不可读停止，并补充命令/展示测试或用临时 HOME smoke 验证 set/unset/conflict
- [x] 1.4 更新 Codex / Claude doctor 的测试模式检查，明确 `ask` 不是最终决策，且 change 命令由 change 决策决定、fix 在 ask 下每次调用询问；扩展 `doctor.test.ts` 并运行 focused Vitest

## 2. change ask 决策契约

- [x] 2.1 在 `templates/skills/propose.md` 与 `apply.md` 实现“配置 normal/off 优先；配置 ask 时读取/补写 `.openspec.yaml lyx.testModeDecision`；文件缺失按缺失、结构非法或不可读/解析失败或无回答时停止”；成功路径需提交本轮新写或继承的 dirty 决策，并定义 propose/apply 在写入或消费后、commit 前因中断、验证或业务失败停止时保留 dirty 决策；apply 在最终 normal 与 artifacts 测试规划失配时停止，不得临时加范围外测试；更新 `host-adapters.test.ts` 断言并运行 focused Vitest
- [x] 2.2 在 `templates/skills/fix.md` 实现 `ask` 时每次调用询问、不持久化、选择仅本次生效；更新模板断言并运行 focused Vitest
- [x] 2.3 在 `templates/skills/review-plan.md`、`review-code.md` 与 Codex/Claude 四份审查角色词实现最终决策解析；补充“正常清零时新写或继承的 dirty 决策均提交 `.openspec.yaml`”“`--no-commit` / 非清零 / commit 失败保留 dirty 决策”“非清零时编排方自决边界”“YAML 不可读或未回答时停止”契约；更新逐字一致性/模板断言并运行 focused Vitest
- [x] 2.4 在 `templates/skills/archive.md` 实现 `ask` 决策解析、YAML 不可读时停止、补问持久化、继承 dirty 决策时随归档 commit 提交、按最终 normal/off 执行归档门禁，并定义写入/消费后门禁失败时保留 dirty 决策；更新模板断言并运行 focused Vitest

## 3. 文档与交互文案

- [x] 3.1 更新 `AGENTS.md`、`CLAUDE.md` 与 `templates/CLAUDE.md`，说明三取值、决策优先级、`.openspec.yaml lyx.testModeDecision`、fix 例外、未回答停止与阶段 commit 归属；验证命令示例和路径一致
- [x] 3.2 同步 `README.md`、`README.zh-CN.md` 的三取值、`lycx project test-mode ask`、change 级决策示例与兼容迁移说明；验证双语语义一致

## 4. 回归与门禁

- [x] 4.1 运行 `openspec validate --changes add-test-mode-ask --strict`，确认五份 delta spec 与 artifacts 结构合法
- [x] 4.2 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`，确认全部通过
