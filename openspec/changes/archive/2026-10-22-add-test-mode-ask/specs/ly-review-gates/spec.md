## MODIFIED Requirements

### Requirement: 循环结束后统一提交, `--no-commit` 关闭最终提交

`/ly:review-code` 与 `/ly:review-plan` 默认（不传任何标志）在循环执行期间 SHALL NOT 提交——每一轮修复完成后只运行验证（`/ly:review-code` 为测试/类型检查/构建；`/ly:review-plan` 为 `openspec validate`），不执行 git commit，改动保持在工作区（修复改动一律留在工作区未暂存状态；审查目标本身的原始改动可能已由编排方 `/ly:propose`、`/ly:apply` 暂存，命令 SHALL NOT 主动改变文件的 staged 状态）。仅当循环以"正常清零"结束（某一轮 Critical 数为 0 且所有 `影响落地=是` 的 Warning 已解决）时，命令必须（SHALL）在输出报告之前对**审查目标全部文件**执行一次统一提交：先 `git add` 审查目标范围内的全部文件（`/ly:review-code` 为审查范围圈定的全部代码文件及本轮新写入或本轮开始时尚未提交、本轮实际消费的 `.openspec.yaml` 决策；`/ly:review-plan` 为目标 change 目录下的 `proposal.md`/`design.md`/`tasks.md`、全部 delta spec 文件及同一口径的 `.openspec.yaml`），再执行一次 commit（仅暂存并提交这些文件，不做范围外的 `git add`）。

当 `.openspec.yaml` 仅因记录 `ask` 决策而修改时，该文件属于审查阶段统一提交的强制辅助目标，即使它不在普通代码 diff 或 artifact 清单中。若本轮没有 Critical/Warning 修复，但决策文件被新写入，SHALL 创建一次仅包含该实际元数据修改的 commit，SHALL NOT 以“无实际改动”为由跳过。

统一提交的 commit message SHALL 采用 `commit-conventions` 定义的结构：CC 前缀为 `fix(<scope>): <subject>`，subject 含目标标识与总轮次说明，末尾带 trailer——`/ly:review-plan` 用 `Change-Stage: review-plan-fix`，`/ly:review-code` 用 `Change-Stage: review-code-fix`，两者均带 `Change-Name: <change-name>`。

**审查目标原始改动的提交归属**：`/ly:review-code` 的审查目标是审查范围圈定的全部文件——有 apply 阶段 commit 时为该 commit 的差异叠加循环期间未提交的修复；仅在无 apply 阶段 commit 的退化场景下才是当前工作区尚未提交的变更。循环修复与原始内容作为同一个待提交单元。`/ly:review-plan` 的审查目标（该 change 的 artifact 与 delta spec 文件）允许在循环开始前处于未暂存或已暂存状态，产物与修复一并提交。

若循环从未认可并实际修复任何 Critical/Warning，且没有 `.openspec.yaml` 决策写入或消费，SHALL NOT 创建空 commit；仅发现 Warning 但未认可修复、也未写入/消费决策时，不发生实际改动，同样不得创建空 commit。若循环以其余任一终止条件结束（熔断、无法安全修复、验证失败、驳回硬线、审查对象类型持续系统性误判）或达到全局轮数上限，命令 SHALL NOT 提交，已产生的改动（含已写入的决策）保持在工作区未提交状态，交由人工核实；此处仅约束 review 循环自身，编排方（`/ly:propose`/`/ly:apply` 手动模式）后续是否按自身规则提交，不属于 review 循环行为。若"正常清零"后的统一提交本身执行失败，必须在报告中如实说明，视为“循环已清零，但统一提交失败”，不重新进入循环。传入 `--no-commit` 时，命令 SHALL NOT 执行最终统一提交（不管循环以何种方式结束），已写入的决策保留为 dirty 并在报告中说明，后续同一 change 可复用。

#### Scenario: review-plan 场景下, 编排方暂存的产物与循环修复一并统一提交
- **WHEN** `/ly:propose` 将 change 目录下的产物暂存后调用 `/ly:review-plan`；循环期间修复了 `design.md` 与一份 delta spec，最终清零
- **THEN** 清零后的统一提交先 `git add` 该 change 目录下的全部 artifact 与 delta spec 文件，再提交；commit message 带 `Change-Stage: review-plan-fix` trailer

#### Scenario: review-code 场景下, 被审查的原始改动与修复一并提交
- **WHEN** 用户在触发 `/ly:review-code` 前已有未提交的代码改动，循环期间修复其中一个 Critical 后清零
- **THEN** 统一提交时先把审查范围内全部文件 `git add`，再执行 commit；commit message 带 `Change-Stage: review-code-fix` trailer

#### Scenario: 正常清零后统一提交一次
- **WHEN** `/ly:review-plan <change-name>` 第一轮发现 1 个 Critical 并修复，第二轮 Critical 数为 0
- **THEN** 循环期间不提交；第二轮清零后统一提交，message带 `Change-Stage: review-plan-fix` / `Change-Name: <change-name>` trailer

#### Scenario: 带 --no-commit 时不做最终提交
- **WHEN** 用户执行 `/ly:review-code --no-commit`，循环修复若干 Critical 后清零
- **THEN** 命令不执行任何 commit，修改文件与已写入决策保持未提交

#### Scenario: 循环以非清零终止条件结束, 循环自身不提交已产生的改动
- **WHEN** `/ly:review-code` 第一轮修复 1 个 Critical 后，第二轮触发熔断
- **THEN** 循环自身不提交改动，已写入决策也保持未提交；报告说明需要人工核实，编排方后续是否提交由其自身规则决定

#### Scenario: 本轮无实际改动, 不创建空 commit
- **WHEN** 循环从未认可并实际修复任何 Critical/Warning，且没有 `.openspec.yaml` 决策写入/消费
- **THEN** 命令不执行 commit，不产生空提交

#### Scenario: 清零后的统一提交本身失败
- **WHEN** 循环清零后统一提交因 hook 拒绝或 Git 身份未配置而失败
- **THEN** 命令不重新进入循环，报告原始错误，并指出需要人工完成提交

#### Scenario: 仅自动修复「是」条目时同样统一提交
- **WHEN** 首轮 Critical 数为 0，存在 2 条 `可自动修复=是` 且 `影响落地=是` 的 Warning，修复后第二轮确认清零
- **THEN** 命令执行统一提交，不因“没有修过 Critical”而跳过

#### Scenario: 仅写入 ask 决策时提交元数据
- **WHEN** review 在 `ask` 下写入 `lyx.testModeDecision`，本轮没有其他 Critical/Warning 修复
- **THEN** 正常清零后创建仅含 `.openspec.yaml` 决策修改的统一 commit

#### Scenario: no-commit 或非清零时决策保持 dirty
- **WHEN** review 写入决策后以 `--no-commit` 或非清零终止结束
- **THEN** 决策文件保持未提交，报告说明 dirty 状态，后续同一 change 可复用

#### Scenario: 恢复正常清零时提交历史 dirty 决策
- **WHEN** 前次 review 非清零终止留下 dirty 决策，本次 review 读取该决策后正常清零
- **THEN** 统一提交范围包含 `.openspec.yaml`，即使本次没有新写入决策

## ADDED Requirements

### Requirement: review 在 ask 模式下使用 change 决策

`@lyx-review-plan` 与 `@lyx-review-code` SHALL 在开始测试相关判级前解析 effective 配置 `testMode` 与目标 change 的 `lyx.testModeDecision`。effective 配置为 `ask` 且决策合法时，审查 SHALL 使用该决策；决策缺失或非法时，命令 SHALL 询问一次 `normal` / `off` 并持久化后再审查。

最终决策为 `off` 时，审查 SHALL 继续遵守无测试模式例外；最终决策为 `normal` 时，测试风险策略照常适用。任何因 `ask` 写入 `.openspec.yaml` 的审查命令，在正常清零成功路径 SHALL 把该文件纳入统一 commit；若本轮没有审查修复，但决策元数据被新写入，SHALL 为该实际改动创建一次 commit。`--no-commit`、非清零终止或 commit 失败时，决策允许保留为 dirty 并由报告说明，后续同一 change 可复用。

若 `.openspec.yaml` 不可读或 YAML 解析失败，审查 SHALL 在询问/写入/测试相关判级前停止并要求人工修复，SHALL NOT 将文件当作字段缺失覆盖。

#### Scenario: review 使用已保存 off
- **WHEN** effective 配置为 `ask`，change 保存 `lyx.testModeDecision = "off"`
- **THEN** review-plan / review-code 不产生测试缺失类发现，也不重复询问

#### Scenario: review 使用已保存 normal
- **WHEN** effective 配置为 `ask`，change 保存 `lyx.testModeDecision = "normal"`
- **THEN** review 按风险测试策略判定测试相关发现

#### Scenario: review 补问并提交决策
- **WHEN** effective 配置为 `ask`，change 缺少决策，用户在 review-plan 中选择 `off`
- **THEN** review 写入 `lyx.testModeDecision = "off"`，并在正常清零时把 `.openspec.yaml` 纳入统一 commit

#### Scenario: 无其他修复时仍提交决策
- **WHEN** review-code 在 `ask` 下补问并写入决策，但本轮没有 Critical 或其他修复
- **THEN** 命令仍提交仅含 `.openspec.yaml` 决策修改的阶段 commit，使工作区恢复干净

#### Scenario: review 未获得回答时停止
- **WHEN** effective 配置为 `ask` 且决策缺失，用户取消或环境无法交互
- **THEN** 审查在输出任何测试缺失类发现前停止，不默认按 normal / off 继续

#### Scenario: YAML 不可读时停止
- **WHEN** effective 配置为 `ask` 且目标 change 的 `.openspec.yaml` 不可读或解析失败
- **THEN** review 停止，不询问后覆盖文件，不输出测试相关判级

#### Scenario: no-commit 保留决策
- **WHEN** review 以 `--no-commit` 运行并写入决策
- **THEN** 决策保留为 dirty 文件，报告未提交状态，后续可复用
