## ADDED Requirements

### Requirement: propose 与 apply 遵守无测试模式

`/ly:propose` 生成 artifacts 时 SHALL 读取当前宿主 `testMode`。当值为 `off` 时，`tasks.md` SHALL NOT 包含测试文件创建、测试修改或测试命令任务；行为或契约所需 spec 仍 SHALL 生成，验证任务 SHALL 限定为 typecheck、build、视觉检查或其他非测试检查。

`@lyx-apply` 在 `testMode = "off"` 时 SHALL NOT 执行测试命令；遇到测试专用任务 SHALL 跳过并输出显式 `[跳过]` 状态，不得把未执行的测试描述为通过。交接给 review-code 的 apply commit SHALL 保留该跳过记录。

#### Scenario: 无测试模式 propose 不排测试任务
- **WHEN** 当前宿主 `testMode = "off"`，用户运行 `@lyx-propose`
- **THEN** tasks 不包含测试任务，只包含实现与 typecheck / build 等非测试验证

#### Scenario: 无测试模式 apply 跳过测试步骤
- **WHEN** 当前宿主 `testMode = "off"`，tasks 中出现测试专用步骤
- **THEN** apply 跳过该步骤并记录 `[跳过] ...（testMode=off）`
