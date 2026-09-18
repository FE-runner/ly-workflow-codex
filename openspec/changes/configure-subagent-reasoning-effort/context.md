# configure-subagent-reasoning-effort 软上下文

## 关键决策

- "是否推理"在本 change 中只表示"是否显式覆盖推理档"，不表示关闭模型思考。展开语义见 proposal.md - What Changes 与 delta spec 的覆盖/不覆盖定义。
- 不新增布尔字段，继续用 `reviewReasoningEffort` / `codingReasoningEffort` 单字段表达：字段省略 = 不覆盖（spawn 不传 `reasoning_effort`），字段有值 = 覆盖。
- 交互 init 与菜单选择"不覆盖"时必须真正清除既有字段；非交互 update 与未触碰路径继续保留原值。实现注意不要把 `undefined` 只交给 `createDefaultConfig`，否则 `sanitizeCodexHostExtras` 展开的旧值会残留。
- 推理档候选用"不覆盖 + 建议档位 + 自定义输入 + 既有值默认"，建议档位只是提示，不构成枚举白名单。
- 菜单只新增 review 推理档编辑；coding 推理档仍只在 init 采集，避免扩展菜单入口范围。
- 模板不改：`review-plan` / `review-code` / `apply` 已按字段非空传递 `reasoning_effort`，本 change 只补配置入口。

## 已否决的备选方案

- 新增 `reviewReasoningEnabled` / `codingReasoningEnabled` 布尔字段：否决，因为本需求不要求关闭推理，且两字段会引入优先级与兼容矩阵。
- 固定枚举 list 采集档位：否决，因为档位随模型/宿主漂移，违反既有"不做枚举强校验"约束。
- 向导只允许覆盖、不允许清除：否决，因为用户无法回到继承默认状态。
- 新增 coding 配置菜单项：否决，属于额外范围；现有 init 已能覆盖 coding 场景。

## 范围边界

- 做：init 交互采集、菜单 review 推理档编辑、显式不覆盖清除、摘要与 doctor 文案、i18n、文档、测试。
- 不做：真正关闭推理、模型名到档位的硬编码映射、spawn 模板协议调整、配置文件迁移、archive 行为变更。

## 已知坑与注意事项

- 清除逻辑是本次最容易出错处：init/menu 两条写回路径都要验证"已有值 + 不覆盖 → 字段消失"。
- 既有自定义档位（如 `custom-tier`）必须保留为候选并默认选中，不能因不在建议清单被替换。
- doctor 判定逻辑不因取值变化；只改展示文案与测试断言。
- 文档中"向导不采集推理档 / 维护方式 = 手改配置"的旧描述需要全部清掉，避免与 spec 冲突。
