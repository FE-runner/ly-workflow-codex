## Context

动机与范围见 `proposal.md`。本设计只解决"如何让审查关卡可配置跳过"，不影响审查关卡自身的执行机制（执行者、子代理、审查-修复循环、快照留痕均不变）。相关既有约定：

- 配置为每宿主一个文件，宿主配置节归一为 `[host]`，字段语义两宿主一致（见 `subagent-agent-config`）。
- 审查关卡的唯一编排入口是 `@lyx-propose`；`@lyx-review-plan` / `@lyx-review-code` 也可被直接调用（见 `ly-review-gates`）。
- `@lyx-archive` 的归档前完整验证与审查解耦（见 `archive-verification-gate`）。

## Goals / Non-Goals

**Goals:**

- 让用户在配置层选择执行哪些审查关卡，且不改配置时行为与现状完全一致。
- 跳过必须显式可见（状态行 + doctor 提示），避免"以为审过其实早关了"。
- 复用既有配置骨架（`sanitize*` 清洗、`mergeHostConfig` 保留、init/menu 共享采集），不引入新机制。

**Non-Goals:**

- 不改审查关卡内部机制（执行者、子代理复用、终止条件、快照格式）。
- 不让配置影响被直接调用的 `@lyx-review-plan` / `@lyx-review-code`，也不影响 `@lyx-apply` / 归档前验证。
- 不引入"每轮参数"式的临时跳过开关，也不新增交互提问轮次。

## Decisions

### D1：字段形态用作用域枚举 `reviewMode`，而非布尔开关或复用执行者枚举

`[host]` 新增 `reviewMode`，取值 `full` | `plan-only` | `code-only` | `off`，未配置 / 空白 / 非法等价 `full`。

- **理由**：方案审查与代码审查价值不同，用户可能需要只保留其一（例如只想要代码审查）。四态枚举一次覆盖全部诉求。
- **备选 A（布尔 `reviewEnabled`）**：最小，但无法表达"只关一级"，后续如需细分会二次改字段、再改一轮配置 schema。已否决。
- **备选 B（复用 `reviewExecutor` 加 `none`）**：省一个字段，但把"谁来审"与"审不审"两件事揉进同一字段，`sanitizeExecutor` 需按侧分叉，语义更难解释。已否决。
- **备选 C（每轮 `--skip-review` 参数）**：不持久、每次都要记得传，且与产品"配置驱动"定位不一致。已否决。

### D2：`reviewMode` 只门控编排入口，不门控直接调用

`@lyx-propose` 读取 `reviewMode` 决定跑哪些审查关卡；被直接调用的 `@lyx-review-plan` / `@lyx-review-code` 完全忽略该字段。

- **理由**：用户显式点了审查命令，配置却把它静默变成 no-op，是很容易骗过自己的坑；显式调用应当显式生效。
- **代价**：同一份配置下"编排不审、手动审"是允许的组合——这是有意为之，不是不一致。

### D3：跳过以显式状态行宣告

每次跳过审查关卡（或其前置校验）打印形如 `[跳过] review-plan（reviewMode=code-only）` 的状态行，沿用仓库既有的 `[回退]` 显式状态风格。

- **理由**：全自动流水线里"少跑了一步"如果不喊出来，用户无法区分"跳过了"与"跑了但没发现"。

### D4：流水线节点前置校验随关卡一起跳过

`reviewMode` 跳过某一级审查时，该级对应的节点前置校验（进入 apply 前的 review-plan 清零校验、进入 review-code 前的 apply SHA 校验）一并跳过；未被跳过的关卡其前置校验保持适用。

- **理由**：前置校验是"上一关卡正常收尾"的门禁，关卡本身未跑时门禁无判据，必须跟着走，否则会因"无终止类型记录"误判阻断。

### D5：init / menu 把 `reviewMode` 作为采集段的开头一问；`off` 时跳过 review 侧采集

`collectSubagentConfig`（init 与 menu 共用）在"执行者二连 → 模型二连 → 推理档二连"之前先采集 `reviewMode`；`reviewMode = off` 时跳过 review 侧执行者 / 模型 / 推理档提问，既有值原样保留、不清空。

- **理由**：`reviewMode` 框定了后面几个 review 侧字段是否还有意义，放最前面最自然；`off` 时继续追问"审查执行者是谁"没有意义。
- **保留既有值**：与现有"未触碰字段以既有值回填、不静默丢弃"口径一致——`off` 只影响是否提问，不替用户清配置。

### D6：doctor 展示 `reviewMode`，并对"off + review 侧字段非空"告警

`lycx doctor` 展示当前 `reviewMode`；非法取值 WARN；`off` 且 review 侧执行者 / 模型 / 推理档任一非空时 WARN 提示不生效。

- **理由**：与既有"执行者 = main 却配了 model"WARN 同一套口径，集中暴露"配置了却不生效"的组合。

## Risks / Trade-offs

- `[用户关掉审查后遗忘]` → doctor 展示 `reviewMode` + `off` 时 WARN + 配置摘要展示取值，三处可见；`reviewMode` 是持久配置、非隐藏默认。
- `[code-only 意味着方案不经独立审查直接实施]` → 用户已明确确认该语义；字段命名保留 `plan-only` / `code-only` 的对称，让取舍一眼可见。
- `[模板分支增多导致流水线描述漂移]` → 在 `ly-propose-flow` 用行为矩阵（取值 × 关卡）固定契约，模板正文按同一矩阵改写；`reviewMode` 的取值解析集中在配置层清洗函数，模板只读解析结果。
- `[误用非法取值被当作 full]` → 清洗回退 + doctor WARN，避免静默漂移。

## Migration Plan

- `reviewMode` 为新增可选字段，未配置等价 `full`：升级用户不改配置时行为不变，无需数据迁移。
- 已安装用户重新运行安装（`lycx init` / update）后模板渲染产物才会带上新行为。

## Open Questions

（无）
