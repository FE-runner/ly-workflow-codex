## 1. 摘要文案分流

- [x] 1.1 在 `src/commands/init.ts` 的 `printSummary` 按原因分流 review 侧 `reviewModel` / `reviewReasoningEffort` 的"不生效"标注：`reviewMode=off` → "审查范围 off，不生效"；`reviewExecutor=main` → 既有"主 agent 执行时不生效"；coding 侧判定不变。验证 `pnpm typecheck` 通过
- [x] 1.2 在 `src/i18n/index.ts` 的 zh-CN 与 en 新增对应文案键（review 侧 off-不生效、off-未覆盖）；验证两语言 key 一一对应

## 2. 测试

- [x] 2.1 在 `src/commands/__tests__/init.test.ts` 补 `reviewMode=off` + `reviewExecutor=subagent` + `reviewModel`/`reviewReasoningEffort` 非空的摘要断言：review 两行标注"审查范围 off，不生效"、且不出现"主 agent 执行时不生效"
- [x] 2.2 补 review 推理档未覆盖 + `reviewMode=off` 的摘要断言（"审查范围 off，不生效（未覆盖）"）
- [x] 2.3 补回归断言：`reviewMode` 非 off 且 `reviewExecutor=main` 时仍标注"主 agent 执行时不生效"（既有文案不回退）

## 3. 集成验证

- [x] 3.1 运行 `pnpm typecheck && pnpm build && pnpm test` 全绿；任一失败如实报告失败脚本与原始错误输出
