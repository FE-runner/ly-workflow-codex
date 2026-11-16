## ADDED Requirements

### Requirement: 全自动跨阶段续跑具备真实行为评测
行为评测运行器 SHALL 支持一个场景安装并发现多个 `lyx-*` skill bundle。仓库 SHALL 至少维护一个全自动连续性场景，从 review-plan 正常清零开始，验证同一执行回合实际推进到 apply 并继续到 review-code；仅断言模板文本或阶段命令名称 SHALL NOT 视为通过。

#### Scenario: review-plan 自动推进完整流水线
- **WHEN** fixture 已包含全自动 run-state、propose 阶段 commit 与可正常实施的 tasks，运行全自动连续性场景
- **THEN** 被测 agent 在同一回合完成 review-plan、apply 阶段 commit 和 review-code，且最终报告与 fixture 副作用证明后两个阶段实际执行

#### Scenario: 停在阶段报告时评测失败
- **WHEN** 被测 agent 输出 review-plan 清零报告后结束，没有创建 apply 改动或 apply 阶段 commit
- **THEN** 该场景判为 failed，并记录缺失的 apply 与 review-code 证据

#### Scenario: 环境无法调用模型时不算通过
- **WHEN** Codex 调用缺失、超时、认证失败或最终输出为空
- **THEN** 该场景标记为 not-executed，保留原因，不把静态断言当作全自动续跑通过
