# context — add-review-mode

## 本 change 解决什么

给 `[host]` 增加 `reviewMode`，让编排入口 `@lyx-propose` 可按配置跳过审查关卡。动机与范围见 `proposal.md`，技术取舍见 `design.md`，本文件只记讨论结论与坑。

## 关键决策与理由

- **D1 用作用域枚举 `reviewMode`（`full` / `plan-only` / `code-only` / `off`）**：方案审查与代码审查价值不同，需要"只关一级"的表达力。未配置 / 空白 / 非法等价 `full`。
- **D2 只门控编排入口，不门控直接调用**：用户显式运行 `@lyx-review-plan` / `@lyx-review-code` 时，配置不得把它静默变成 no-op。`@lyx-apply` 与归档前完整验证同样不受影响。
- **D3 跳过必须显式**：打印 `[跳过] review-plan（reviewMode=<取值>）` 风格状态行，沿用仓库既有 `[回退]` 显式状态口径。
- **D4 关卡跳过时其节点前置校验一并跳过**：前置校验是"上一关卡正常收尾"的门禁，关卡未跑时无判据，必须跟着走，否则按"无终止类型记录"误判阻断。
- **D5 采集 UX**：`reviewMode` 作为子代理配置整段的开头一问；`off` 时跳过 review 侧执行者 / 模型 / 推理档提问，既有值原样保留（不替用户清配置），coding 侧照常采集。
- **D6 doctor/摘要**：展示 `reviewMode`；`off` 且 review 侧字段非空时 WARN，与既有"执行者 = main 却配了 model"同一套口径。

## 已否决的备选

- **布尔 `reviewEnabled`**：无法表达"只关一级"，后续细分要二次改字段与 schema。
- **每轮 `--skip-review` 参数**：不持久、每次都需记得传，且与配置驱动定位不符。
- **把 `reviewMode` 做成"全自动 / 手动"询问的第三个选项**：破坏 propose"只问两次"的不变量。
- **复用 `reviewExecutor` 加 `none`**：把"谁来审"与"审不审"揉进一个字段，`sanitizeExecutor` 需按侧分叉。

## 范围边界

- **做**：配置字段与读写链路、编排门控、采集 / 摘要 / doctor 展示、模板 / 文档 / spec 同步、测试。
- **不做**：不改审查关卡内部机制（执行者、子代理、终止条件、快照格式）；不改 apply / 归档前验证；不为 `reviewMode` 新增交互提问轮次（它是既有采集段开头一问）。

## 已知坑 / 注意

- **MODIFIED delta 场景名必须逐字保留**：`openspec validate` 会报 "omits scenario(s) the current spec still has"。本次首轮把「全自动流水线走到审完代码」改了名而失败，改回原名后通过；改既有 Requirement 时务必保留全部既有场景名，只新增不重命名。
- **不要把 `reviewMode` 引入 review-plan / review-code / apply / archive 模板**：直接调用与 apply / 归档验证必须不受影响（tasks 4.3 守护）。
- **本机安装产物落后**：`~/.agents/skills/lyx-*` 比仓库 `templates/` 旧（用户刚改 explore 尚未重装）。本次改 `templates/skills/propose.md` 后，本地要重装（`lycx init` / update）才按新行为生效测试。

## 实施决策（apply 阶段回写）

- 配置层：`sanitizeReviewMode` + `REVIEW_MODES` 落在 `src/utils/config.ts`；`createDefaultConfig` / `mergeHostConfig` / `HostExtras` / `sanitizeCodexHostExtras` 全链路携带 `reviewMode`。
- `HostAdapterConfig`（`src/utils/host-adapters.ts`）同步加 `reviewMode`（claude doctor 的 `ctx.config` 类型需要）。
- 采集：`collectSubagentConfig` 新增 `pickReviewModeField` 作为整段开头一问；`reviewMode === 'off'` 时以 `reviewSideActive` 门控，review 侧执行者 / 模型 / 推理档跳过并保留既有默认值，coding 侧照常。
- 菜单变更检测对 `reviewMode` 做 `undefined ≡ 'full'` 归一——否则"既有配置没有 reviewMode、用户接受默认 full"会被判成改动而触发写回（破坏既有"未改动不写回"行为）。
- doctor：codex `assessSubagentModelConfig` 新增 `reviewMode` / `reviewModeInvalid` / `reviewOffWarn` 并并入 `status`；claude doctor 同口径展示与两处 WARN。
- 模板：仅 `templates/skills/propose.md` 步骤 8/9 做门控；review-plan / review-code / apply / archive 模板不含 `reviewMode`（由 `host-adapters.test.ts` 断言守护）。
- 验证：`pnpm typecheck`、`pnpm build`、`pnpm test`（370 passed）全绿。
