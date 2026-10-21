## ADDED Requirements

### Requirement: review 遵守无测试模式

`testMode = "off"` 时，`/ly:review-plan` 与 `/ly:review-code` SHALL NOT 报告缺少测试文件、缺少测试任务、缺少边界测试或测试覆盖不足类发现。审查发现中的测试风险策略在无测试模式下 SHALL NOT 产生 Critical、Warning 或 Info。

无测试模式 SHALL NOT 豁免核心行为未覆盖、接口或配置契约不一致、错误路径、安全、数据完整性等非测试问题；这些问题继续按既有分级处理。

#### Scenario: review-code 不因无测试文件报警
- **WHEN** `testMode = "off"` 且改动没有新增测试文件
- **THEN** review-code 不产生测试相关发现

#### Scenario: review-plan 不要求测试任务
- **WHEN** `testMode = "off"` 且 tasks 没有测试任务
- **THEN** review-plan 不把它视为遗漏或 Warning

#### Scenario: 非测试契约问题仍阻断
- **WHEN** `testMode = "off"` 且 proposal 声明的行为没有对应 spec
- **THEN** review-plan 仍按既有规则报告核心行为缺口
