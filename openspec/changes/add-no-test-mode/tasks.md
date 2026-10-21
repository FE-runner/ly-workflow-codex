## 1. 配置模型

- [ ] 1.1 在 `src/types/index.ts` 新增 `TestMode` 与宿主可选 `testMode` 字段；在 `src/utils/config.ts` 新增 `TEST_MODES`、`sanitizeTestMode`，并让 `createDefaultConfig`、`sanitizeHostExtras`、`HostOverride`、`mergeHostConfig` 保留或清洗该字段；运行 `pnpm exec vitest run src/utils/__tests__/config.test.ts` 验证
- [ ] 1.2 扩展 `src/utils/__tests__/config.test.ts`，覆盖未配置默认 normal、normal/off 合法值、空白与非法值清洗、create/merge/clear/保留语义；运行 focused Vitest 验证

## 2. 采集与展示

- [ ] 2.1 在 `src/i18n/index.ts` 的 zh-CN / en 同步增加 `testMode` 提示、normal/off 标签、摘要与 doctor 文案；验证同一组键存在且无单边缺失
- [ ] 2.2 扩展 `src/commands/collect-subagent-config.ts`，在配置采集开头增加 `testMode = normal | off` 选择并把结果写入 `SubagentConfigCollected`；验证采集默认值与既有值回填
- [ ] 2.3 更新 `src/commands/init.ts` 与 `src/commands/menu.ts` 的 defaults、summary、status 与写回链路；运行 `src/commands/__tests__/init.test.ts`、`menu-config.test.ts`、`menu.test.ts` 验证

## 3. Doctor

- [ ] 3.1 更新 `src/hosts/codex/doctor.ts` 与 `src/hosts/claude/doctor.ts`，展示 `testMode`、非法值 WARN、未配置按 normal；运行 `src/commands/__tests__/doctor.test.ts` 与 `src/commands/__tests__/host-ops.test.ts` 验证

## 4. 工作流模板

- [ ] 4.1 更新 `templates/skills/fix.md`：读取 `testMode`，off 时不写测试文件、不运行测试命令，仍执行 typecheck/build；验证模板包含 normal/off 两路和 `@lyx-fix` 最小配置读取例外
- [ ] 4.2 更新 `templates/skills/propose.md` 与 `templates/skills/apply.md`：off 时不生成测试任务，apply 跳过测试专用步骤并输出 `[跳过] ...（testMode=off）`；验证模板断言
- [ ] 4.3 更新 `templates/skills/review-plan.md`、`review-code.md` 与四份双宿主 reviewer 角色词：off 时抑制全部测试相关发现但保留非测试门禁；验证 shared template / Codex / Claude rubric 逐字一致
- [ ] 4.4 更新 `templates/skills/archive.md`：off 时跳过 test，保留 typecheck/build，并明确报告“testMode=off，测试已跳过”；验证模板断言

## 5. 文档

- [ ] 5.1 更新 `AGENTS.md` 与 `CLAUDE.md` 的配置示例、执行模型和 fix 读取边界；验证 `testMode`、normal/off、默认 normal 与非测试门禁均有说明
- [ ] 5.2 同步 `README.md`、`README.zh-CN.md` 与 `templates/CLAUDE.md` 的无测试模式说明、init/menu/doctor 行为及 archive 例外；验证双语语义一致

## 6. 回归与门禁

- [ ] 6.1 扩展 `src/utils/__tests__/host-adapters.test.ts`，覆盖 fix/propose/apply/archive/review 的 testMode=off 文本规则，以及 `@lyx-fix` 不读取 review/coding 配置的边界；运行 focused Vitest
- [ ] 6.2 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`，确认全部通过
- [ ] 6.3 运行 `openspec validate --changes add-no-test-mode --strict`，确认 change 结构通过
