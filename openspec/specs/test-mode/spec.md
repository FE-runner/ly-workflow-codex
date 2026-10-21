# test-mode Specification

## Purpose

定义每宿主可选的 `testMode` 配置以及无测试模式的跨流程行为，使用户可以显式关闭测试文件、测试任务与测试命令，同时保留类型检查和构建验证。

## Requirements

### Requirement: 每宿主 testMode 配置

每个宿主的配置文件 SHALL 在 `[host]` 节提供可选字段 `testMode`，取值 SHALL 为 `normal` 或 `off`。未配置、空白或非法取值 SHALL 等价于 `normal`。配置读写链路 SHALL 保留既有 `testMode`，非交互重装或未触碰该字段的编辑 SHALL NOT 清除该值。

`normal` SHALL 保持现有测试义务；`off` SHALL 启用无测试模式。该字段按宿主生效，SHALL NOT 从一个宿主的配置文件推断另一个宿主的模式。

工作流读取当前宿主配置文件失败或 YAML/TOML 解析失败时，SHALL 视为“测试模式未知”并在执行任何测试文件写入、测试任务生成或测试命令前停止，明确提示运行 `lycx doctor` 检查；SHALL NOT 静默按 `normal` 继续，以免用户配置的无测试模式被绕过。

#### Scenario: 未配置默认正常测试模式
- **WHEN** 宿主配置没有 `testMode`
- **THEN** 工作流按 `normal` 执行，现有测试义务不变

#### Scenario: 显式关闭测试
- **WHEN** 当前宿主配置为 `testMode = "off"`
- **THEN** 当前宿主启动的 lyx 工作流进入无测试模式

#### Scenario: 非法值按正常模式处理并告警
- **WHEN** `testMode` 为非空非法字符串
- **THEN** 运行时按 `normal` 处理，`lycx doctor` 输出 WARN

#### Scenario: 配置不可读时停止而不是默认运行测试
- **WHEN** 当前宿主配置文件缺失、不可读或解析失败
- **THEN** 工作流在测试相关动作前停止并提示运行 `lycx doctor`，不得静默按 `normal` 执行

### Requirement: testMode 的采集与展示

交互 `lycx init` 与菜单配置入口 SHALL 采集 `testMode`，既有合法值 SHALL 作为默认选中项，未配置或非法值 SHALL 默认选中 `normal`。配置摘要 SHALL 展示当前模式。

`lycx doctor` SHALL 在每个宿主的配置检查中展示当前 `testMode`；未配置或空白 SHALL 显示 `normal`，非法非空值 SHALL 输出 WARN 并按 `normal` 处理。

#### Scenario: 向导采集正常与无测试模式
- **WHEN** 用户运行交互 `lycx init` 或菜单配置
- **THEN** 命令提供 `normal` / `off` 选项并写回所选模式

#### Scenario: doctor 展示无测试模式
- **WHEN** 当前宿主配置为 `testMode = "off"`
- **THEN** `lycx doctor` 明确展示无测试模式已启用

### Requirement: 无测试模式关闭测试文件、测试任务与测试命令

`testMode = "off"` 时，`@lyx-fix`、`@lyx-propose`、`@lyx-apply`、`@lyx-review-plan`、`@lyx-review-code` 与 `@lyx-archive` SHALL NOT 新增或修改测试文件、SHALL NOT 生成测试任务、SHALL NOT 执行测试命令。测试专用步骤因无测试模式跳过时 SHALL 显式输出 `[跳过] ...（testMode=off）` 并留下可审计记录。

行为或契约改动仍 SHALL 按需要更新 spec 或说明行为变化，但测试义务 SHALL 归零；审查 SHALL NOT 产生“缺少测试、缺少边界测试、测试覆盖不足”类 Critical / Warning / Info。`testMode = "normal"` 时 SHALL 继续适用 `risk-based-testing-policy`。

若实施任务同时包含非测试实现步骤与测试步骤，`off` 时 SHALL 保留并执行非测试实现部分，只跳过测试部分；SHALL NOT 因同一任务含测试字样而跳过整个实现任务。

#### Scenario: fix 在无测试模式不写测试
- **WHEN** `testMode = "off"` 且用户运行 `@lyx-fix`
- **THEN** 命令不新增或修改测试文件、不运行测试命令，改用类型检查或构建验证实现改动

#### Scenario: propose 在无测试模式不生成测试任务
- **WHEN** `testMode = "off"` 且 `@lyx-propose` 生成方案
- **THEN** `tasks.md` 只包含实现与 typecheck / build 等非测试验证，不包含测试文件或测试命令任务

#### Scenario: apply 跳过已有的测试专用任务
- **WHEN** `testMode = "off"` 且 tasks 中仍有测试专用步骤
- **THEN** `@lyx-apply` 跳过该步骤、输出显式 `[跳过]` 状态并记录原因，不执行测试命令

#### Scenario: 混合任务只跳过测试部分
- **WHEN** `testMode = "off"` 且单个任务同时包含代码实现与测试补充
- **THEN** `@lyx-apply` 完成代码实现部分，只跳过测试补充部分并记录

#### Scenario: review 不报告缺测试
- **WHEN** `testMode = "off"` 且 review-plan / review-code 审查实现
- **THEN** 审查不因缺少测试文件、测试任务或测试覆盖形成发现

### Requirement: 无测试模式不关闭非测试质量门禁

`testMode = "off"` SHALL NOT 关闭核心行为覆盖、接口或配置契约一致性、错误路径、安全、数据完整性、类型检查或构建检查。`@lyx-archive` 在无测试模式下 SHALL 跳过测试类别，但仍 SHALL 执行项目提供的类型检查与构建，并在归档报告中明确说明测试因 `testMode=off` 被跳过。

#### Scenario: 核心行为缺口仍在审查中暴露
- **WHEN** `testMode = "off"` 且 proposal 声明的新行为在 delta spec 中完全未覆盖
- **THEN** review-plan 仍报告核心行为缺口，不因无测试模式忽略

#### Scenario: archive 跳过测试但保留 typecheck/build
- **WHEN** 项目提供 test / typecheck / build 脚本且 `testMode = "off"`
- **THEN** `@lyx-archive` 跳过 test，执行 typecheck 与 build，并在报告注明测试跳过原因
