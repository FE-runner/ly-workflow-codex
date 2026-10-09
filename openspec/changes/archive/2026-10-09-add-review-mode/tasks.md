## 1. 配置层（类型 / 清洗 / 合并保留）

- [x] 1.1 在 `src/types/index.ts` 新增 `ReviewMode = 'full' | 'plan-only' | 'code-only' | 'off'` 类型，并在 `HostSection` 增加可选字段 `reviewMode`；验证 `pnpm typecheck` 通过
- [x] 1.2 在 `src/utils/config.ts` 新增 `sanitizeReviewMode`（非字符串 / 空白 / 非法取值 → `undefined`；trim 后仅接受四个合法值），并让 `createDefaultConfig` / `mergeHostConfig` / `HostExtras` / `sanitizeCodexHostExtras` 携带并保留既有 `reviewMode`；验证 `src/utils/__tests__/config.test.ts` 新增用例（清洗四值 + 非法回退 + 重写保留）通过

## 2. init / 菜单采集与摘要

- [x] 2.1 在 `src/commands/collect-subagent-config.ts` 的 `SubagentConfigCollected` 增加 `reviewMode`，并在采集段开头新增 `reviewMode` 提问（四选一，未配置 / 既有值非法默认 `full`）；验证采集函数单测覆盖默认与既有值回填
- [x] 2.2 让 `reviewMode = off` 时跳过 review 侧执行者 / 模型 / 推理档提问、既有值原样保留，coding 侧照常采集；验证 `src/commands/__tests__/init.test.ts` 与 `menu-config.test.ts` 覆盖 off 跳过与保留
- [x] 2.3 让 `src/commands/init.ts` 的 defaults / 写回与 `src/commands/menu.ts` 的 `configExecutorsAndModels` 带上 `reviewMode`，并在 `printSummary` / 菜单摘要输出 `reviewMode` 行；验证摘要输出包含该行且未触碰字段保留

## 3. doctor 展示与告警

- [x] 3.1 在 `src/hosts/codex/doctor.ts` 与 `src/hosts/claude/doctor.ts` 的配置体检中展示 `reviewMode`（未配置 / 空白等价 `full`），非法取值输出 WARN；验证 doctor 单测覆盖展示与非法 WARN
- [x] 3.2 让 `reviewMode = off` 且 review 侧 `reviewExecutor` / `reviewModel` / `reviewReasoningEffort` 任一非空时输出 WARN（字段不生效）；验证 `src/commands/__tests__/doctor.test.ts` 覆盖该组合

## 4. 模板：propose 流水线门控

- [x] 4.1 改写 `templates/skills/propose.md` 步骤 8（全自动流水线）：按 `reviewMode` 决定执行哪些审查关卡，被跳过的关卡打印显式状态行（形如 `[跳过] review-plan（reviewMode=code-only）`），其节点前置校验一并跳过，`apply` 在任何取值下都执行；验证渲染产物含四个取值的分支与状态行
- [x] 4.2 改写 `templates/skills/propose.md` 步骤 9（手动路径）：`full` / `plan-only` 照常询问 review-plan，`code-only` / `off` 不询问并打印显式状态行；验证渲染产物含该分支
- [x] 4.3 确认模板改动**不**把 `reviewMode` 引入 `templates/skills/review-plan.md` / `review-code.md` / `apply.md` / `archive.md`（直接调用审查命令与 apply / 归档前验证不受影响）；验证 `src/utils/__tests__/host-adapters.test.ts` 断言 review-plan / review-code 模板不读取 `reviewMode`

## 5. i18n 文案

- [x] 5.1 在 `src/i18n/index.ts` 的 zh-CN 与 en 均新增 `reviewMode` 相关文案（采集提问 / 摘要 / doctor 展示与 WARN / 跳过状态行）；验证两语言 key 一一对应且无缺失

## 6. 文档同步

- [x] 6.1 同步 `AGENTS.md` / `CLAUDE.md` / `README.md` / `README.zh-CN.md` 的 `[host]` 字段与 propose 流程段落，写入 `reviewMode` 契约；验证文档段落与 spec 一致
- [x] 6.2 在 `CHANGELOG.md` 顶部新增本次变更条目；验证条目按 Keep a Changelog 分组

## 7. 集成验证

- [x] 7.1 运行 `pnpm typecheck && pnpm build && pnpm test` 全绿；若任一失败，如实报告失败脚本与原始错误输出
