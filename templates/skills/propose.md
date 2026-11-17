---
name: lyx-propose
description: '在需要创建 OpenSpec change、整理方案并编排后续审查与实施时使用。'
argument-hint: '<需求描述>'
references:
  - references/propose-contract.md
  - references/recovery-and-evidence.md
---

# Propose

> 调用方式：`@lyx-propose` mention 后跟随的自然语言即参数（如 `@lyx-propose` 带需求描述/选项）；无参数时直接 `@lyx-propose`。

执行本 skill 前，SHALL 完整读取：

- `references/propose-contract.md`：隔离询问、自动/手动选择、artifact 生成、change 名确认、方案自审、context/run-state、提交和流水线。
- `references/recovery-and-evidence.md`：运行账本、机械裁决和新鲜验证证据规则。

## 全自动执行不变量（最高优先级）

- 用户选择全自动后，真实 change 名一经确认，SHALL 立即创建 `run-state.md`，写入 `执行模式: full-auto`、当前阶段和下一步；该初始化 SHALL 早于方案自审。
- `@openspec-propose` 的 Planning boundary 只结束它自己的 artifacts 生成阶段，不结束 `@lyx-propose` 编排；artifacts 返回后 SHALL 继续方案自审、context/metadata、propose commit 与后续流水线。
- 方案自审清单 MUST 输出，但它是 propose 内部 checkpoint，不是阶段交接点；输出后 SHALL 立即执行步骤 5.5→5.6→5.7→6，完成 propose commit 后才读取 review-plan bundle，SHALL NOT 在自审后结束回合。
- review-plan 报告、apply 完成证据和节点校验结论都只是中间状态，SHALL NOT 被当作最终回复。
- 当前阶段正常完成且不存在待用户决策、失败或终止条件时，SHALL 以当前 skill 目录为锚点，读取同级 `lyx-review-plan/SKILL.md`、`lyx-apply/SKILL.md` 或 `lyx-review-code/SKILL.md` 及该主文件 frontmatter 声明的全部 references，再继续同一回合。
- 只输出 `@lyx-*`、写出下一阶段名称或说明“下一步应执行”SHALL NOT 视为已进入下一阶段；无法定位同级 bundle 时停止并报告，不得回退为等待用户再次触发。
- 恢复时若目标 change 的 `run-state.md` 已是 `阶段: propose-self-review` 且方案 artifacts 完整，SHALL 沿用既有 isolation / 执行模式并从方案自审或 5.5 继续，SHALL NOT 重复询问隔离方式或全自动/手动。
- review-plan 正常清零后 SHALL 继续 apply；apply 正常完成并提交后 SHALL 继续 review-code。
- 只有 review-code 正常清零，或出现明确业务决策、失败、终止条件时，才允许结束全自动回合。
- 准备结束回合前 SHALL 核对 `run-state.md`；若 `执行模式=full-auto` 且流水线尚未到正常终态，不得结束当前回合。

除上述 references 与全自动执行不变量外，本文件只负责入口和路由；不得根据 frontmatter description 自行简化流程。
