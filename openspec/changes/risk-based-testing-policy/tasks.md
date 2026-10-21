## 1. 共享工作流模板

- [ ] 1.1 更新 `templates/skills/fix.md`，把固定先红后绿改为按风险分类的测试与验证规则，并把自审⑤改为“验证充分吗”；验证 `rg -n "纯展示|补充边界|验证充分吗|risk-based-testing-policy" templates/skills/fix.md` 命中对应条款
- [ ] 1.2 更新 `templates/skills/propose.md`，明确纯展示改动可使用空 Capabilities 与 `skip_specs: true`、不生成测试任务，补充边界不构成机械断链；验证对应文本存在且核心 What Change 漏任务仍判机械断链
- [ ] 1.3 更新 `templates/skills/review-code.md`，定义纯展示缺测试不形成发现、补充边界 Warning 使用 `可自动修复：否` 与 `影响落地：否`，并移除测试补齐必须自动修复；验证四象限段与 `review-plan.md` 仍逐字一致
- [ ] 1.4 更新 `templates/skills/review-plan.md`，落实与 `review-code.md` 相同的测试风险处置和 `skip_specs` 边界；验证两份模板四象限段一致且核心行为未覆盖仍为 Critical

## 2. 双宿主角色词

- [ ] 2.1 同步 Codex `reviewer.md` 与 `plan-reviewer.md` 的测试风险判级、补充边界双否标注和测试补齐反向清单；验证与各自共享模板的判级标准逐字一致
- [ ] 2.2 同步 Claude `lyx-reviewer.md` 与 `lyx-plan-reviewer.md` 的相同规则；验证 Codex/Claude 判级标准逐字一致

## 3. 文档与安装说明

- [ ] 3.1 更新 `AGENTS.md`、`CLAUDE.md` 与 `templates/CLAUDE.md` 中 fix、propose、review 流程的测试语义；验证旧“固定先红后绿”“测试补齐自动修”等过期表述不再出现
- [ ] 3.2 同步 `README.md` 与 `README.zh-CN.md` 的命令说明和风险测试策略摘要；验证中英文均描述纯展示豁免、补充边界只记录、archive 完整验证不变

## 4. 回归断言

- [ ] 4.1 更新 `src/utils/__tests__/host-adapters.test.ts` 的 fix/propose/review 文本断言，覆盖纯展示豁免、补充边界双否、测试补齐移除和核心行为缺口不放宽；验证 focused Vitest 用例通过
- [ ] 4.2 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`，确认全量验证通过
- [ ] 4.3 运行 `openspec validate --changes risk-based-testing-policy --strict`，确认 change 结构与 strict 校验通过
