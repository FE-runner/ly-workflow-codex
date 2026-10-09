## ADDED Requirements

### Requirement: 配置摘要的 review 侧"不生效"标注按原因分流
`lycx init` 与菜单配置入口的配置摘要 SHALL 对 review 侧模型字段（`reviewModel`）与推理档字段（`reviewReasoningEffort`）在"不生效"时按**真实原因**选择文案，SHALL NOT 把不同原因混用同一句：

- `reviewMode = "off"`（审查范围关闭；即使 `reviewExecutor = "subagent"`）：摘要 SHALL 以"审查范围 off，不生效"类文案标注该字段；未覆盖的推理档 SHALL 标注"审查范围 off，不生效（未覆盖）"。
- `reviewMode` 非 `off` 但 `reviewExecutor = "main"`：摘要 SHALL 沿用既有"主 agent 执行时不生效"类文案。
- `reviewMode` 非 `off` 且 `reviewExecutor = "subagent"`：字段生效，按既有口径展示取值（已覆盖 / 继承当前会话模型）。

coding 侧字段 SHALL NOT 受本 Requirement 影响，仍按 `codingExecutor` 是否为 `"subagent"` 判定"不生效"。

#### Scenario: reviewMode=off 时 review 侧字段标注审查范围原因
- **WHEN** 用户配置 `reviewMode = "off"`、`reviewExecutor = "subagent"`、`reviewModel = "gpt-6-sol"` 与 `reviewReasoningEffort = "high"`，运行交互 `lycx init` 并渲染配置摘要
- **THEN** 摘要对 `reviewModel` 与 `reviewReasoningEffort` 分别标注"审查范围 off，不生效"，SHALL NOT 标注"主 agent 执行时不生效"

#### Scenario: reviewMode=off 且 review 推理档未覆盖时的标注
- **WHEN** 用户配置 `reviewMode = "off"` 且未配置 `reviewReasoningEffort`，渲染配置摘要
- **THEN** 摘要标注"审查范围 off，不生效（未覆盖）"，SHALL NOT 标注"主 agent 执行时不生效（未覆盖）"

#### Scenario: 执行者为 main 时的既有文案不变
- **WHEN** 用户配置 `reviewMode = "full"`（或未配置）、`reviewExecutor = "main"` 且 `reviewModel` 非空，渲染配置摘要
- **THEN** 摘要仍按既有口径标注"主 agent 执行时不生效"，SHALL NOT 改成"审查范围 off"

#### Scenario: coding 侧不受影响
- **WHEN** 用户配置 `reviewMode = "off"`、`codingExecutor = "main"` 且 `codingModel` 非空，渲染配置摘要
- **THEN** `codingModel` 仍按"主 agent 执行时不生效"标注（其不生效原因确为执行者）
