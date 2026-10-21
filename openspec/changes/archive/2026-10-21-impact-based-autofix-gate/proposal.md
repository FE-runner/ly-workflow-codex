## Why

v0.10.0 的自动修复轴按**轮次**决定消费哪些 Warning：只修首轮、次轮新出现的一律落快照、首轮条目次轮仍在即降级。这个规则换来"最多多跑 1 轮"的硬上界，代价是把重要性和出现顺序绑死了——第 2 轮冒出的"接口签名与调用方不一致"与第 1 轮冒出的"README 双语未同步"享受同等待遇；反过来，一条会推翻实施方式的 Warning 只要出现在第 2 轮就永远不会被修。

真正该回答的是"这条不修会不会影响 change 落地"，而不是"它是第几轮冒出来的"。

## What Changes

- 审查发现新增第二根正交标注（Warning 专用）：`影响落地：是 / 否`——不修是否会导致 change 的**实施方式、交付结果或验收标准**发生变化。与既有 `可自动修复：是 / 否` 正交；Critical 与 Info 不标。
- **删除**「自动修只消费首轮」与「未修好即降级为否」两条规则（含其 Requirement）。
- 消费判据改为**四象限**：`可自动修复=是` + `影响落地=是` → 自动修、**不限轮次**、参与正常清零；`是+否` → 不自动修、落快照；`否+是` → **停止流水线转人工**（不得静默落快照）；`否+否` → 落快照。
- **正常清零**重定义为：Critical 数为 0 **且所有 `影响落地=是` 的 Warning 都已解决**（自动修完，或 `否+是` 场景下停止转人工）。
- 审查类型口径：`review-plan` 侧按"影响实施"解读；`review-code` 侧按"影响本次交付"解读——不修会导致交付物不满足 change 目标、验收不过或引入回归。字段名统一为 `影响落地`，判据文本保持两族逐字一致。
- 新收敛刹车（替代原 +1 轮上界）：同一影响项（文件 + 问题类别 + 定位锚点）在相邻两轮仍存在 → **停止**（影响项不接受降级放行）；第 3 轮及以后**新出现** `影响落地=是` 条目 → **停止**；全局轮数上限（5 轮）与"清零优先于轮数上限"不变。
- 标注由审查者产出，当前会话可覆盖任一方向，但 SHALL 在报告中逐条列出被覆盖条目、原标注、覆盖后取值与理由（沿用 `可自动修复` 的既有机制）。
- 快照收录口径**不变**——现有 `review-findings-snapshot` 的"未被自动修复的 Warning"在四象限下天然成立（`是+是` 修完不入；其余三种都入）。实施阶段核对后若发现正文冲突再补 delta。
- 按项目「改动对称清单」同步六处判级标准、断言与根文档。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `ly-review-gates`: 新增「审查发现的影响落地标注」Requirement（字段、四条判据、"必须判是/否"清单、覆盖留痕）；移除「自动修只消费首轮发现且不返工」Requirement；「审查-修复循环与终止条件」改为按影响面消费（四象限）、删除首轮限定与降级、新增两条收敛刹车、重定义正常清零；「循环结束后统一提交」的空 commit 判据改为"没有任何 Critical 或 Warning 被认可修复"。
- `ly-propose-flow`: 「全自动路径 = 自动流水线直到审完代码」两处关卡推进条件中硬编码的旧清零定义（"首轮标注为「可自动修复：是」的 Warning 条目已全部确认修复"）同步为按 `影响落地` 的新定义。

## Impact

- 判级标准六处（SHALL 逐字一致）：`templates/hosts/codex/prompts/reviewer.md`、`plan-reviewer.md`、`templates/hosts/claude/agents/lyx-reviewer.md`、`lyx-plan-reviewer.md`、`templates/skills/review-code.md`、`review-plan.md` 的 `## 判级标准`。
- 模板流程：`review-code.md` / `review-plan.md`（正常清零、四象限消费、删除首轮与降级、新刹车、TASK 增量、OUTPUT 约定、报告模板）；`propose.md`（两处推进条件的括号定义）。
- 预期零改动但需核对并加断言守护：`templates/skills/archive.md`、`templates/skills/explore.md`、`openspec/specs/review-findings-snapshot/spec.md`。
- 断言：`src/utils/__tests__/host-adapters.test.ts`（六处判级标准一致性、四象限与刹车锚点、快照口径零改动）。
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`README.zh-CN.md` 的自动修复轴描述。
- 兼容：v0.10.0 的"只消费首轮"行为被替换；历史快照读取口径不变；无新增配置字段。属行为变更，下一次发版应为 0.11.0。
