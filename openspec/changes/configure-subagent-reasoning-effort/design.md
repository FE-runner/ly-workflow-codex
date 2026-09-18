## Context

当前 `[codexHost]` 已有 `reviewReasoningEffort` / `codingReasoningEffort` 两个可选字符串字段，模板只在字段非空时把值作为宿主 spawn 的 `reasoning_effort` 传入；字段空白等价未覆盖。缺口只在配置入口：`lycx init` 交互向导和菜单都不采集该字段，用户必须手改 `~/.codex/lyx/config.toml`。相关现状见 proposal.md - Why。

## Goals / Non-Goals

**Goals:**

- 在交互配置入口为每个 subagent 提供"不覆盖（继承模型/宿主默认）"或"覆盖并指定档位"的选择。
- 复用既有字段，不新增布尔字段或新配置通道。
- 保持"取值不做枚举强校验"的既有约束，候选只是建议。
- 保留非交互 update 与未触碰字段的既有值，避免重装丢配置。

**Non-Goals:**

- 不把"不覆盖"解释为"关闭模型思考"；它只表示不显式传 `reasoning_effort`。
- 不新增 coding 模型/推理档的菜单编辑入口。
- 不改变 `review-plan` / `review-code` / `apply` 模板的 spawn 传递契约。
- 不提供模型名到推理档的硬编码映射。

## Decisions

### 决策 1：单字段三态复用，不新增布尔字段

`reviewReasoningEffort` / `codingReasoningEffort` 继续承担唯一配置载体：

```text
不覆盖  -> 字段省略 -> spawn 不传 reasoning_effort
覆盖    -> 字段有值 -> spawn 传该值
```

**理由**：字段语义已经与宿主参数一一对应；新增 `*ReasoningEnabled` 会引入两个字段间的优先级和兼容矩阵，却仍无法保证"关闭思考"（部分模型始终开启推理）。**备选**：新增布尔字段 + 档位字段；否决，因为本需求明确只控制是否显式覆盖。

### 决策 2：候选构造复用现有模型字段模式

新增推理档候选构造器（可与 `buildModelFieldChoices` 并列）：

- `不覆盖（继承模型/宿主默认）` 哨兵项
- `minimal` / `low` / `medium` / `high` / `max` 建议项
- `自定义输入…`
- 既有值非空时附加为候选项并默认选中

**理由**：与现有模型候选的"留空 + 自定义 + 既有值默认"语义同构，降低交互认知成本，也避免把建议清单误当白名单。**备选**：固定枚举 list；否决，因为档位随模型/宿主漂移，且已有 spec 明确禁止枚举强校验。

### 决策 3：显式不覆盖才清除，未触碰与 update 保留

交互路径中，用户选择"不覆盖"时构造写回配置必须真正移除对应字段。实现上不能只传 `undefined` 给 `createDefaultConfig`，因为 init 会把 `sanitizeCodexHostExtras(existingConfig.codexHost)` 展开进 `codexHost`，旧值会残留；需要在构造 `codexHost` 时显式排除被清除的推理档字段，或增加一个"清空字段"辅助函数。

非交互 `update` 与用户未触碰该选择的路径继续走既有保留语义。菜单"配置审查模型"同步提供 review 推理档覆盖选择；coding 推理档仍由 init 采集。

菜单写回路径现有"模型与执行者都没变就提前 return"的判定必须把推理档覆盖选择纳入比较；否则用户只清空/修改 `reviewReasoningEffort` 时会被静默忽略，无法通过菜单回到不覆盖状态。自定义输入 trim 后为空时等价于"不覆盖"，避免出现空字符串写入。

**理由**：用户显式选择"不覆盖"必须产生可观察结果，否则无法用配置入口回到继承默认。**备选**：向导从不删除已有值，只允许覆盖；否决，因为无法回到不覆盖状态。

### 决策 4：交互摘要与 doctor 统一文案，不改判定

交互配置摘要与 `lycx doctor` 使用同一组用语展示推理档：从"未配置（不传推理档参数）"改为"未覆盖（继承模型/宿主默认）"，非空值展示为"已覆盖: <值>"。doctor 继续把推理档作为提示项展示，不判合法性。

**理由**：与向导用语统一，避免用户把"不覆盖"误解为"关闭推理"。

## Risks / Trade-offs

- [用户把"不覆盖"误解为"关闭推理"] → 所有 UI 与 doctor 文案统一使用"不覆盖（继承模型/宿主默认）"，并在现状检测提示中保留"合法档位由宿主/上游实际报错判定"的说明。
- [清除逻辑因 extras 展开而失效] → 在 tasks 与测试中显式覆盖"已有值 + 选择不覆盖 → 字段被移除"的场景，并检查 init 与 menu 两条写回路径。
- [建议档位被误当白名单] → 保留自定义输入入口与既有值候选；不改动 `sanitizeReasoningEffort` 的不做枚举校验口径。
- [菜单改动误删 coding 配置] → 菜单写回继续使用 `sanitizeCodexHostExtras` 保留其他字段，只显式处理 `reviewReasoningEffort`。

## Migration Plan

无需配置文件迁移。存量字段继续有效；升级后交互 init 会把既有值作为默认候选，非交互 update 保持原值不变。
