## ADDED Requirements

### Requirement: 全自动下一步安全动作包含交接坐标
全自动模式下的 `run-state.md` `下一步安全动作` SHALL 同时写明下一阶段命令、同级 skill 路径、change 参数和继续条件。恢复执行时，主 agent SHALL 按这些坐标读取下一阶段 bundle；字段只有“继续”“进入下一步”等模糊描述时，SHALL 视为账本信息不足并从当前阶段重建下一动作。

#### Scenario: review-plan 完成后记录 apply 坐标
- **WHEN** review-plan 正常清零并准备进入 apply
- **THEN** `下一步安全动作` 写明读取同级 `lyx-apply/SKILL.md` 及 references、以目标 change 名执行 apply，且无未决人工介入项

#### Scenario: apply 完成后记录 review-code 坐标
- **WHEN** apply 正常提交并准备进入 review-code
- **THEN** `下一步安全动作` 写明读取同级 `lyx-review-code/SKILL.md` 及 references、使用本次 apply commit SHA 继续审查

#### Scenario: 模糊状态触发重建
- **WHEN** 全自动 run-state 只有“继续下一阶段”而没有命令、bundle 路径或参数
- **THEN** 主 agent 不据此猜测执行，先从当前阶段和 enabled reviewMode 重建具体交接坐标并记录
