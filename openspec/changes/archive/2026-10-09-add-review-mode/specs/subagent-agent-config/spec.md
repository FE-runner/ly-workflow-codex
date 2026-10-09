## ADDED Requirements

### Requirement: `[host].reviewMode` 配置审查关卡范围
每个宿主的配置文件 SHALL 提供可选字段 `reviewMode`，取值 SHALL 为 `"full"` | `"plan-only"` | `"code-only"` | `"off"`；未配置、空白或非法取值 SHALL 等价于 `"full"`（方案审查与代码审查都执行）。该字段 SHALL 只决定编排入口 `@lyx-propose` 触发哪些审查关卡（见 `ly-propose-flow`），SHALL NOT 影响被直接调用的 `@lyx-review-plan` / `@lyx-review-code`（见 `ly-review-gates`），也 SHALL NOT 影响 `@lyx-apply` 或 `@lyx-archive` 的归档前完整验证。

**清洗与读写**：`reviewMode` 的清洗规则 SHALL 为——非字符串视为未配置；trim 后仅接受 `full` / `plan-only` / `code-only` / `off` 四个取值，其余（含空白）视为未配置。类型化配置（`src/types/index.ts` 的宿主配置节）SHALL 提供该可选字段，配置读写链路（`createDefaultConfig` / `mergeHostConfig` / 宿主配置节重写）SHALL 携带并保留既有 `reviewMode`，SHALL NOT 因重装或编辑而重置或丢失。

**采集与摘要**：交互 `lycx init` 与菜单配置入口 SHALL 把 `reviewMode` 作为子代理配置整段的开头一问采集，候选 SHALL 为上述四个取值，未配置或既有值非法时默认选中 `full`。`reviewMode = "off"` 时 SHALL 跳过 review 侧执行者 / 模型 / 推理档的提问，review 侧既有值 SHALL 原样保留（SHALL NOT 被清空）；`full` / `plan-only` / `code-only` 时 review 侧照常采集，coding 侧始终照常采集。配置摘要 SHALL 展示 `reviewMode` 当前取值。

**doctor**：`lycx doctor` SHALL 展示 `reviewMode` 当前取值（未配置或空白等价 `full`），非法取值 SHALL 输出 WARN；`reviewMode = "off"` 且 review 侧 `reviewExecutor` / `reviewModel` / `reviewReasoningEffort` 任一非空时，SHALL 输出 WARN 提示"审查已关闭，review 侧字段不生效"。

#### Scenario: 未配置 reviewMode 时行为不变
- **WHEN** 用户未配置 `reviewMode`（或配置为空白）
- **THEN** 等价于 `full`，`@lyx-propose` 编排照常执行方案审查与代码审查；`lycx doctor` 展示该字段为 `full`（等同未配置）

#### Scenario: 非法 reviewMode 回退 full 并被 doctor 提示
- **WHEN** 用户配置 `reviewMode = "sometimes"`
- **THEN** 该值被视为未配置（等价 `full`），`lycx doctor` 输出 WARN 提示取值非法

#### Scenario: 重写配置保留 reviewMode
- **WHEN** 用户已配置 `reviewMode = "plan-only"` 后运行 `lycx update`（`init --force --skip-prompt`）或通过菜单配置入口编辑
- **THEN** 重装/编辑后宿主配置文件仍保留 `reviewMode = "plan-only"`，SHALL NOT 被重置或丢弃

#### Scenario: reviewMode 为 off 时跳过 review 侧采集
- **WHEN** 用户在交互 `lycx init` 或菜单配置入口把 `reviewMode` 设为 `off`
- **THEN** 向导跳过 review 侧执行者 / 模型 / 推理档的提问，review 侧既有配置值原样保留；coding 侧照常采集

#### Scenario: reviewMode 为 off 且 review 侧字段存在时 doctor 告警
- **WHEN** 用户配置 `reviewMode = "off"` 且 `reviewModel`（或 `reviewExecutor` / `reviewReasoningEffort`）非空，运行 `lycx doctor`
- **THEN** 检查项展示 `reviewMode = off` 并输出 WARN 提示该 review 侧字段不生效，整体判定不因此变化
