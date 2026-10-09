# context — fix-review-mode-summary-label

## 本 change 解决什么

上一个 change（`add-review-mode`，已归档）引入的摘要文案缺陷：当 `reviewMode = "off"` 且 `reviewExecutor = "subagent"`（既有值被 off 保留）时，review 侧模型 / 推理档的"不生效"理由被错写成"主 agent 执行时不生效"——真实原因是审查范围被关闭。动机见 `proposal.md`。

## 关键决策与理由

- **按原因分流，而非泛化文案**：review 侧"不生效"只有两种真实原因——`reviewMode=off`（审查范围关闭）与 `reviewExecutor=main`（执行者为主 agent）。摘要须按原因选文案，否则用户无法判断该改哪个字段。
- **只改文案，不改判定**：生效性判定仍由 `reviewMode` 与 `reviewExecutor` 决定（沿用上个 change 的 `reviewEffective && reviewActive` 语义），不引入新状态、不改配置写入。
- **复用现有 `printSummary`**：不新增字段、不改数据模型；只在标注处按原因选 i18n key。
- **不动 doctor**：`lycx doctor` 已正确输出 `reviewMode=off：review 侧字段不生效`，无需改动。

## 已否决的备选

- **只把文案泛化成"不生效"（去掉原因）**：信息量下降，用户失去"该改哪个字段"的线索。
- **在 `reviewMode=off` 时清空 review 侧配置**：与既有"未触碰字段保留既有值"口径冲突，且会让用户丢失配置。
- **改 doctor 文案**：doctor 本来就是对的口径，改了反而引入回归。

## 范围边界

- **做**：`src/commands/init.ts` 的 `printSummary` 原因分流、zh-CN / en 文案、测试；在 `subagent-agent-config` 加一条 ADDED Requirement。
- **不做**：不动 doctor 文案与判定、不改菜单输出结构（菜单只展示取值 / 未配置，本就没有"不生效"标注）、不改配置写入与审查门控。

## 已知坑 / 注意

- `i18n/index.ts` 有 zh-CN 与 en 两处，需成对新增文案键。
- 推理档有独立的"未覆盖"文案（`reasoningIneffectiveUnset`），`off` 场景需要单独的"未覆盖"变体，不能只改"已覆盖"那一支。
- 本机 `~/.agents/skills/lyx-*` 与 `~/.codex/lyx/prompts/codex/*` 仍落后于仓库 `templates/`；本次改 `propose.md` / `review-*.md` 后需重装才在本地生效。

## 实施决策（apply 阶段回写）

- `printSummary` 用 `Effectiveness = 'effective' | 'executorMain' | 'reviewModeOff'` 表达不生效原因；review 侧按 `reviewMode === 'off'` 优先判定（关闭审查时与执行者无关），否则由 `reviewExecutor` 决定；coding 侧仍只由 `codingExecutor` 决定。
- 新增 3 个 i18n 文案键（zh-CN / en 成对）：`summary.modelInactiveReviewMode`、`summary.reasoningInactiveReviewMode`、`summary.reasoningInactiveReviewModeUnset`。
- 未改动 doctor、菜单输出、配置写入与门控。
- 验证：`pnpm typecheck`、`pnpm build`、`pnpm test`（373 passed）全绿。
