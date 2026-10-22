## Context

参见 `proposal.md` 的 Why 与五个 delta spec。当前 `testMode` 在配置层只有 `normal` / `off`，工作流直接消费 effective 配置值。propose、apply、review-plan、review-code 与 archive 都在 change 生命周期内运行，已有 `.openspec.yaml` 的 `lyx:` 命名空间承载 isolation metadata，可扩展 change 级测试决策。

本变更需要一个明确的两层模型：配置层决定是否使用 `ask`，change 元数据保存 `ask` 的回答。只改配置枚举而不持久化 change 决策，会导致同一 change 的 propose/apply/review/archive 反复询问或策略不一致。

## Goals / Non-Goals

**Goals:**

- 新增配置值 `ask`，并保持 `normal` / `off` 兼容。
- 每个 change 在配置为 `ask` 时只询问一次测试模式，后续阶段沿用。
- 让 propose、apply、review-plan、review-code、archive 使用同一决策优先级。
- 将决策写入 `.openspec.yaml`，且随对应阶段 commit 落库。
- 为无 change 元数据的 `@lyx-fix` 定义每次调用询问的明确例外。

**Non-Goals:**

- 不把 `ask` 扩展为测试以外的配置项。
- 不在多个 change 之间共享单次回答。
- 不为 `@lyx-fix` 创建临时 change 或独立元数据文件。
- 不改变最终 `normal` / `off` 下的既有测试义务。
- 不移除历史 `lyx.testModeDecision`；配置改为 `normal` / `off` 时仅覆盖消费结果，不清理元数据。

## Decisions

### D1. `TestMode` 扩展为三取值

`normal` / `off` 语义保持不变，新增 `ask`。`sanitizeTestMode`、类型、init/menu 候选、`lycx project test-mode`、doctor/status 与 i18n 均接受三取值。`ask` 是配置层值，不是最终测试义务；只有 change 级命令解析后才得到最终 `normal` / `off`。

替代方案新增独立布尔字段会形成两套模式来源；扩展既有枚举可保持“单字段、多层级”解析。

### D2. 配置优先级高于 change 历史决策

change 级解析顺序固定为：

1. effective 配置为 `normal` / `off` → 直接使用配置；
2. effective 配置为 `ask` 且 `lyx.testModeDecision` 合法 → 使用持久化决策；
3. effective 配置为 `ask` 且决策缺失/非法 → 询问并持久化。

因此用户可通过项目配置临时覆盖某个 change 的旧决策。历史决策在配置恢复 `ask` 后重新生效。

替代方案让任意历史决策永久覆盖配置，会使项目级配置失去可操作性；本方案保留显式配置的最终控制权。

### D3. 决策存储为 `lyx.testModeDecision`

在 change 的 `.openspec.yaml` 中保存：

```yaml
lyx:
  isolation: none
  testModeDecision: normal | off
```

字段可选。写入 SHALL 保留 YAML 其他字段与 `lyx` 下其他键。非法值视为缺失，下一次 `ask` 时重新询问并覆盖。运行模板通过常规文件读取与编辑协议维护该字段，不引入新的 YAML 运行时依赖。

替代方案使用 `context.md` 或独立文件，会绕开 change 元数据并增加第二份生命周期状态；`.openspec.yaml` 已是 each change 的唯一元数据载体。

### D4. propose 在生成前询问，在 change 创建后落库

`@lyx-propose` 在生成 artifacts 前解析 effective 配置：

- 配置为 `normal` / `off`：直接进入现有流程；
- 配置为 `ask`：在 opsx propose 生成前询问一次 `normal` / `off`，按选择生成/跳过测试任务；真实 change 名确定后写入 `lyx.testModeDecision`，随既有 propose commit 提交。

此路径保证同一 change 的后续阶段无需再次询问。若会话在 propose commit 前中断，磁盘上没有 change 决策，下一次运行会重新询问，符合“未落库即未确认”。

### D5. apply/review/archive 作为缺失决策的兜底入口

直接运行 apply、review-plan、review-code 或 archive 时，命令先解析目标 change 与配置：

- 配置 `normal` / `off`：直接使用；
- 配置 `ask` 且元数据合法：直接使用；
- 配置 `ask` 且元数据缺失/非法：询问一次并写入 `.openspec.yaml`。

写入元数据的命令 SHALL 把 `.openspec.yaml` 纳入本阶段 commit 清单：

- apply：加入 apply pending file list；
- review-plan / review-code：加入审查统一 commit 目标；即使无 Critical 修复，也因决策写入创建实际 commit；
- archive：由既有 `git add -- openspec/` 覆盖。

若命令在 commit 前失败，决策写入保留在工作区，供恢复后的同一 change 沿用。

### D6. `@lyx-fix` 是显式每次询问例外

fix 不创建 change、不写 `context.md`，因此没有可持久化的 change 元数据。effective 配置为 `ask` 时，fix 在实施前询问一次，选择只对本次调用生效；配置 `normal` / `off` 时不询问。替代方案为 fix 创建隐藏状态文件会违反其轻量、无 change 的边界。

### D7. 审查角色词与执行模板使用最终决策

六个共享模板和四份审查角色词在测试判级前先按 D2 得到最终 `normal` / `off`。模板只在 final mode 为 `off` 时抑制测试缺失类发现，在 `normal` 时照常适用风险策略。`ask` 本身不得直接用于判级，也不得被解释为 `normal`。

### D8. 无回答即停止

所有运行时询问都是人工决策点。用户取消、问题通道不可用或当前环境无法向用户提问时，命令 SHALL 停止在测试文件写入、测试任务生成、测试命令执行或测试相关判级之前；SHALL NOT 默认 `normal` / `off`。这与配置不可读时的“未知即停止”一致。

## Risks / Trade-offs

- **用户忘记回答导致流程停止** → 输出明确提示“测试模式未决定”，并保留工作区状态；这是避免静默选错测试策略的代价。
- **配置修改与历史决策优先级混淆** → doctor/status 与命令报告同时展示 effective 配置值、change 决策与最终模式来源。
- **review 无修复但需写决策** → 扩展统一 commit 规则，使 `.openspec.yaml` 的真实变化不被“无 Critical 不建 commit”规则吞掉。
- **人工编辑 YAML 损坏其他字段** → 模板要求只增改 `lyx.testModeDecision` 并保留其余内容；review/apply/archive 的 diff 校验会暴露越界改动。
- **同一 change 在不同宿主机执行** → 决策存于 change 文件，随项目仓库共享；配置仍为宿主本地，配置 `normal/off` 可覆盖该宿主的消费。
- **fix 每次询问增加交互** → 只发生在 effective `ask`；用户可将项目配置设为 `normal` / `off` 免除询问。

## Migration Plan

1. 扩展 `TestMode`、配置清洗、init/menu、项目命令、doctor/status 与 i18n。
2. 更新 propose/apply 与 change metadata 规则。
3. 更新 fix、review、archive 模板及四份审查角色词。
4. 更新双语文档与测试：三取值、配置覆盖历史决策、`ask` 持久化、无回答停止、阶段 commit 包含 `.openspec.yaml`。
5. 现有配置无需迁移；无 `lyx.testModeDecision` 的 change 仅在配置为 `ask` 时首次补问。
