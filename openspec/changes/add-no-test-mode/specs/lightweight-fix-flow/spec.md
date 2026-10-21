## MODIFIED Requirements

### Requirement: 实施先写回归测试并观察失败

实施前 SHALL 读取当前宿主 `testMode`。`testMode = "off"` 时，`@lyx-fix` SHALL NOT 新增或修改测试文件、SHALL NOT 运行测试命令；行为或契约改动仍 SHALL 正常实施，并改用项目提供的类型检查、构建或其他非测试验证。`testMode = "normal"` 时 SHALL 按 `risk-based-testing-policy` 对改动单元分类并记录测试策略：行为或契约改动与逻辑缺陷修复在可自动化时 SHALL 先编写能复现问题或刻画新行为的测试并运行、确认其失败，再修改实现直至通过；失败记录 SHALL 保留供自审⑤核对。纯展示改动 SHALL NOT 被要求新增自动化测试，但仍 SHALL 运行相关既有测试、类型检查或构建，并在可用时执行视觉检查。补充边界覆盖 SHALL NOT 被自动扩为核心实施步骤或提交前置条件。

无测试模式下，`@lyx-fix` 的非测试职责 SHALL 保持不变，包括定位、spec 分流、实现、自审、类型检查、B 类确认与单 commit。任何无法执行的验证 SHALL 明确记录原因，SHALL NOT 静默省略。

#### Scenario: 回归测试先红后绿
- **WHEN** `testMode = "normal"` 且修复一个可复现的逻辑 bug
- **THEN** 命令先新增测试并展示其失败输出，再修改实现使其通过

#### Scenario: 纯展示改动不新增测试
- **WHEN** `testMode = "normal"`，需求只改动纯 UI、文案或样式，且不涉及行为、状态、数据流或契约
- **THEN** 命令不要求新增测试，改为运行相关既有测试、类型检查或构建，并在可用时完成视觉检查

#### Scenario: 无测试模式不写不跑测试
- **WHEN** `testMode = "off"`，用户运行 `@lyx-fix`
- **THEN** 命令不新增或修改测试文件、不运行测试命令，只用类型检查、构建或其他非测试验证后提交

#### Scenario: 补充边界不扩为实施任务
- **WHEN** 实施中识别到与用户请求和既有 Scenario 无关的额外边界用例
- **THEN** 命令将其作为可选补充记录，不自动新增测试或扩大本次实施范围

#### Scenario: 无法写测试时说明原因
- **WHEN** `testMode = "normal"` 且改动无法被自动化测试覆盖，或环境无法执行相称验证
- **THEN** 命令记录具体原因并写入提交正文 `- 自审：` 与 `- 验证：` 条目
