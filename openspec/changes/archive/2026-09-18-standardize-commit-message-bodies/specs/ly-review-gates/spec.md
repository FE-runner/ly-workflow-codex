## ADDED Requirements

### Requirement: review 清零统一提交使用增强正文

`/ly:review-plan` 与 `/ly:review-code` 在 Critical 清零后执行的统一修复提交 SHALL 按 `commit-conventions` 的正文规范生成 message。CC 前缀仍分别为 `fix(<scope>): review-plan 反馈修复（N 轮）` 与 `fix(<scope>): review-code 反馈修复（N 轮）`；正文 SHALL 说明本轮认可并修复的 Critical、修复动作与验证说明；末尾仍带对应 `Change-Stage` 与 `Change-Name` trailer。

#### Scenario: review-plan 修复提交包含正文
- **WHEN** `/ly:review-plan` 清零并执行统一提交
- **THEN** commit message 在 `Change-Stage: review-plan-fix` trailer 前包含本轮 Critical 与修复动作正文

#### Scenario: review-code 修复提交包含正文
- **WHEN** `/ly:review-code` 清零并执行统一提交
- **THEN** commit message 在 `Change-Stage: review-code-fix` trailer 前包含本轮 Critical、代码修复动作与验证说明
