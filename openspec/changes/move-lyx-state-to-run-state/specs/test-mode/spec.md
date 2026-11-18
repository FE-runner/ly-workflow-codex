## MODIFIED Requirements

### Requirement: change 级 ask 决策持久化

`effective testMode = "ask"` 时，change 级命令 SHALL 从目标 change 的 `run-state.md` 固定 YAML frontmatter 读取可选字段 `testModeDecision`，取值仅允许 `normal` / `off`。新流程 SHALL NOT 把该决策写入 `.openspec.yaml`。

决策解析 SHALL 按以下顺序：

1. effective 配置为 `normal` / `off` 时直接使用配置，忽略 change 级决策；
2. effective 配置为 `ask` 且 run-state 的 `testModeDecision` 为合法值时，使用该持久化决策；
3. effective 配置为 `ask` 且 run-state 决策缺失或非法、目标 change 属于旧格式时，只读回退 `.openspec.yaml` 的 `lyx.testModeDecision`；
4. 仍缺失或非法时，询问用户选择 `normal` / `off`，并把选择写入 `run-state.md` 的固定 frontmatter。

询问 SHALL 明确区分 `normal`（写测试、跑测试）与 `off`（不写测试、不跑测试）。用户未回答、取消或当前环境无法交互时，命令 SHALL 停止，SHALL NOT 以 `normal` / `off` 猜测继续。

`run-state.md` 缺失时，新 change SHALL 按既有生命周期创建 `run-state.md` 后再持久化；旧 change MAY 在继续运行时补充固定 frontmatter，但 SHALL NOT 迁移或改写旧 `.openspec.yaml` 的 `lyx` 命名空间。run-state frontmatter 无法解析、YAML 结构非法，或 `testModeDecision` 存在且既不是 string 也不是 null 时，命令 SHALL 停止并要求人工修复。`testModeDecision: null` 或非空但不在 `normal` / `off` 的字符串 SHALL 视为缺失并重新询问。

需要回退读取旧 `.openspec.yaml` 时，文件整体不可读或 YAML 解析失败 SHALL 使命令停止并要求人工修复，SHALL NOT 覆盖该文件。旧 `lyx` 不是 mapping，或其中的 `testModeDecision` 存在且既不是 string 也不是 null 时，命令 SHALL 视为结构非法并停止。

决策写入磁盘后 SHALL 立即对同一 change 生效。正常成功路径 SHALL 把 `run-state.md` 纳入本阶段 commit；若本阶段成功消费的是前次遗留且尚未提交的 run-state 决策，也 SHALL 一并提交该文件。以下情形允许保留未提交的 dirty 决策并如实报告：propose/apply/archive 在决策写入或消费后、阶段 commit 前因中断、验证失败或业务失败停止；review `--no-commit`、review 非清零终止；阶段 commit 失败。后续同一 change 的恢复运行 MAY 直接消费该磁盘决策，避免重复询问；SHALL NOT 把“未提交”误报为“未决策”。

`@lyx-fix` 不创建 change 元数据，因此不适用本 Requirement；其 `ask` 行为由 `lightweight-fix-flow` 定义。

#### Scenario: ask 决策在 propose 首次询问并持久化
- **WHEN** effective 配置为 `ask`，用户运行 `@lyx-propose`
- **THEN** 命令在生成 artifacts 前询问一次，并在真实 change 名确定、run-state 初始化后把选择写入其 `testModeDecision`

#### Scenario: 后续命令沿用持久化决策
- **WHEN** run-state 的 `testModeDecision = "off"`，effective 配置仍为 `ask`
- **THEN** apply / review / archive 使用 `off`，不再重复询问

#### Scenario: 配置 normal 覆盖历史决策
- **WHEN** run-state 已保存 `testModeDecision = "off"`，当前 effective 配置变为 `normal`
- **THEN** 后续命令使用 `normal`，SHALL NOT 继续使用历史 `off`

#### Scenario: 配置 off 覆盖历史决策
- **WHEN** run-state 已保存 `testModeDecision = "normal"`，当前 effective 配置变为 `off`
- **THEN** 后续命令使用 `off`

#### Scenario: 决策缺失时补问并持久化
- **WHEN** effective 配置为 `ask`，目标 change 的 run-state 没有 `testModeDecision`，用户在 apply / review / archive 中选择 `off`
- **THEN** 命令写入 run-state 的 `testModeDecision = "off"` 并把 `run-state.md` 纳入该阶段提交

#### Scenario: 旧活跃 change 只读回退
- **WHEN** effective 配置为 `ask`，目标 change 的 run-state 没有新字段，但 `.openspec.yaml` 保存 `lyx.testModeDecision = "off"`
- **THEN** 命令只读使用 `off`，不修改 `.openspec.yaml`

#### Scenario: run-state 结构非法时停止
- **WHEN** run-state frontmatter 可解析，但 `testModeDecision` 为 object/list/number
- **THEN** 命令停止并要求人工修复，不得覆盖结构

#### Scenario: YAML 不可读时停止
- **WHEN** effective 配置为 `ask`，run-state 缺少决策且需要回退读取旧 `.openspec.yaml`，但该文件不可读或 YAML 解析失败
- **THEN** 命令在询问、写入或测试动作前停止并要求人工修复，不得覆盖该文件

#### Scenario: YAML 缺失时按缺失决策处理
- **WHEN** effective 配置为 `ask` 且目标 change 的 run-state 与旧 `.openspec.yaml` 均不存在决策
- **THEN** 命令把决策视为缺失，允许询问并在 run-state 中持久化

#### Scenario: YAML 结构非法时停止
- **WHEN** run-state frontmatter 或需要回退读取的旧 `.openspec.yaml` 可解析，但对应 lyx 命名空间不是 mapping，或 `testModeDecision` 为 object/list/number
- **THEN** 命令停止并要求人工修复，不得覆盖结构

#### Scenario: 旧 YAML 不可读时停止
- **WHEN** 需要回退读取旧 `.openspec.yaml`，但文件不可读或 YAML 解析失败
- **THEN** 命令在询问、写入或测试动作前停止并要求人工修复，不得覆盖该文件

#### Scenario: 旧 YAML 结构非法时停止
- **WHEN** 需要回退读取旧 `.openspec.yaml`，文件可解析，但 `lyx` 不是 mapping，或 `testModeDecision` 为 object/list/number
- **THEN** 命令停止并要求人工修复，不得覆盖结构

#### Scenario: 非法历史决策重新询问
- **WHEN** effective 配置为 `ask`，run-state 的 `testModeDecision` 为非空非法值
- **THEN** 命令忽略该值、询问一次并用新选择覆盖 run-state

#### Scenario: 未获得回答时停止
- **WHEN** effective 配置为 `ask` 且决策缺失，用户取消或当前环境不能交互
- **THEN** 命令停止在测试动作前，不新增测试文件、不生成测试任务、不执行测试命令

#### Scenario: no-commit 或失败时允许保留 dirty 决策
- **WHEN** review 使用 `--no-commit`、review 非清零终止，或 propose/apply/archive 在决策写入/消费后、阶段 commit 前因中断、验证失败、业务失败或 commit 失败停止
- **THEN** 命令如实报告未提交状态，后续同一 change 的恢复运行可以消费磁盘上的 run-state 决策

#### Scenario: 最终 normal 与 artifacts 测试规划失配时停止
- **WHEN** 历史决策为 `off` 但当前配置覆盖为 `normal`，或决策缺失后补问为 `normal`，而 proposal/tasks 没有测试任务或测试执行计划
- **THEN** apply 在实施前停止，提示先更新 change artifacts 或恢复配置，不得临时添加范围外测试
