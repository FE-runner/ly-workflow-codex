## MODIFIED Requirements

### Requirement: review 在 ask 模式下使用 change 决策

`@lyx-review-plan` 与 `@lyx-review-code` SHALL 在开始测试相关判级前解析 effective 配置 `testMode` 与目标 change 的 run-state `testModeDecision`。effective 配置为 `ask` 且 run-state 决策合法时，审查 SHALL 使用该决策；新字段缺失且目标 change 属于旧格式时，MAY 只读回退 `.openspec.yaml` 的 `lyx.testModeDecision`。决策缺失或非法时，命令 SHALL 询问一次 `normal` / `off` 并把选择持久化到 run-state 后再审查。

最终决策为 `off` 时，审查 SHALL 继续遵守无测试模式例外；最终决策为 `normal` 时，测试风险策略照常适用。任何因 `ask` 写入 `run-state.md` 的审查命令，在正常清零成功路径 SHALL 把该文件纳入统一 commit；若本轮没有审查修复，但决策元数据被新写入，SHALL 为该实际改动创建一次 commit。`--no-commit`、非清零终止或 commit 失败时，决策允许保留为 dirty 并由报告说明，后续同一 change 可复用。

新字段以 run-state frontmatter 为主；旧 `.openspec.yaml` 只在兼容回退时读取，SHALL NOT 被审查流程改写。run-state frontmatter 不可读或 YAML 解析失败时，审查 SHALL 在询问/写入/测试相关判级前停止并要求人工修复，SHALL NOT 将文件当作字段缺失覆盖。需要回退旧 `.openspec.yaml` 时，该文件不可读或解析失败同样 SHALL 阻断。

#### Scenario: review 使用已保存 off
- **WHEN** effective 配置为 `ask`，run-state 保存 `testModeDecision: "off"`
- **THEN** review-plan / review-code 不产生测试缺失类发现，也不重复询问

#### Scenario: review 使用已保存 normal
- **WHEN** effective 配置为 `ask`，run-state 保存 `testModeDecision: "normal"`
- **THEN** review 按风险测试策略判定测试相关发现

#### Scenario: review 补问并提交决策
- **WHEN** effective 配置为 `ask`，change 缺少决策，用户在 review-plan 中选择 `off`
- **THEN** review 写入 run-state 的 `testModeDecision: "off"`，并在正常清零时把 `run-state.md` 纳入统一 commit

#### Scenario: 无其他修复时仍提交决策
- **WHEN** review-code 在 `ask` 下补问并写入决策，但本轮没有 Critical 或其他修复
- **THEN** 命令仍提交仅含 `run-state.md` 决策修改的阶段 commit，使工作区恢复干净

#### Scenario: 旧活跃 change 只读回退
- **WHEN** run-state 没有 `testModeDecision`，目标旧 change 的 `.openspec.yaml` 保存 `lyx.testModeDecision = "off"`
- **THEN** review 使用 `off`，且不修改 `.openspec.yaml`

#### Scenario: review 未获得回答时停止
- **WHEN** effective 配置为 `ask` 且决策缺失，用户取消或环境无法交互
- **THEN** 审查在输出任何测试缺失类发现前停止，不默认按 normal / off 继续

#### Scenario: run-state 不可读时停止
- **WHEN** effective 配置为 `ask` 且目标 change 的 run-state frontmatter 不可读或解析失败
- **THEN** review 停止，不询问后覆盖文件，不输出测试相关判级

#### Scenario: YAML 不可读时停止
- **WHEN** effective 配置为 `ask`，run-state 缺少决策且需要回退读取旧 `.openspec.yaml`，但该文件不可读或解析失败
- **THEN** review 停止，不询问后覆盖文件，不输出测试相关判级

#### Scenario: no-commit 保留决策
- **WHEN** review 以 `--no-commit` 运行并写入 run-state 决策
- **THEN** 决策保留为 dirty 文件，报告未提交状态，后续可复用

### Requirement: 循环结束后统一提交, `--no-commit` 关闭最终提交
`/ly:review-code` 与 `/ly:review-plan` 默认（不传任何标志）在循环执行期间 SHALL NOT 提交——每一轮修复完成后只运行验证（`/ly:review-code` 为测试/类型检查/构建；`/ly:review-plan` 为 `openspec validate`），不执行 git commit，改动保持在工作区（修复改动一律留在工作区未暂存状态；审查目标本身的原始改动可能已由编排方 `/ly:propose`、`/ly:apply` 暂存，命令 SHALL NOT 主动改变文件的 staged 状态）。仅当循环以"正常清零"结束（某一轮 Critical 数为 0 且所有 `影响落地=是` 的 Warning 已解决）时，命令必须（SHALL）在输出报告之前对**审查目标全部文件**执行一次统一提交：先 `git add` 审查目标范围内的全部文件（`/ly:review-code` 为审查范围圈定的全部代码文件及本轮新写入或本轮开始时尚未提交、本轮实际消费的 `run-state.md` 决策；`/ly:review-plan` 为目标 change 目录下的 `proposal.md`/`design.md`/`tasks.md`、全部 delta spec 文件及同一口径的 `run-state.md`），再执行一次 commit（仅暂存并提交这些文件，不做范围外的 `git add`）。

统一提交的 commit message SHALL 采用 `commit-conventions` 定义的结构：CC 前缀为 `fix(<scope>): <subject>`，subject 含目标标识与总轮次说明（例如"review-plan 反馈修复（2 轮）"），末尾带 trailer——`/ly:review-plan` 用 `Change-Stage: review-plan-fix`，`/ly:review-code` 用 `Change-Stage: review-code-fix`，两者均带 `Change-Name: <change-name>`。

当 `run-state.md` 仅因记录 `ask` 决策而修改时，该文件属于审查阶段统一提交的强制辅助目标，即使它不在普通代码 diff 或 artifact 清单中。若本轮没有 Critical/Warning 修复，但 run-state 决策被新写入，SHALL 创建一次仅包含该实际状态修改的 commit，SHALL NOT 以“无实际改动”为由跳过。

**审查目标原始改动的提交归属**：`/ly:review-code` 的审查目标是**审查范围圈定的全部文件**——有 apply 阶段 commit 时为该 commit 的差异（`git show <commit>`）叠加循环期间未提交的修复；仅在无 apply 阶段 commit 的退化场景下才是"当前工作区尚未提交的变更"（`git diff HEAD` 圈定的范围）。两种场景下，循环产生的修复都是在原始内容之上的修正，清零后的统一提交本来就应同时包含"原始内容"与"审查修正"，二者是同一个待提交单元，不需要也不应该被拆开。同样地，`/ly:review-plan` 的审查目标（该 change 的 artifact 与 delta spec 文件）允许在循环开始前处于未暂存或已暂存状态（`/ly:propose` 编排下产物已暂存、独立运行时可能未暂存）。**因此 `review-plan` 场景下不再存在任何"循环开始前已脏的文件被跳过提交"的隔离逻辑**——propose 产物是合法审查对象不是无关脏文件，用户手工编辑的 artifact 同样属于审查目标内容，一并提交；删除对"循环开始前未提交状态文件"的 `git status --porcelain` 预检查和隔离跳过行为。

若循环从未认可并实际修复任何 Critical/Warning，且没有 `run-state.md` 决策写入或消费，SHALL NOT 创建空 commit；仅发现 Warning 但未认可修复、也未写入/消费决策时，不发生实际改动，同样不得创建空 commit。**仅修复 Warning 条目而不含任何 Critical 修复时，同样 MUST 执行这次统一提交**——判据是"是否发生实际文件改动"，不是"是否修过 Critical"。若循环以其余任一终止条件结束（熔断、无法安全修复、验证失败、驳回硬线、审查对象类型持续系统性误判）或达到全局轮数上限，命令 SHALL NOT 提交，已产生的改动（含已写入的决策）保持在工作区未提交状态，交由人工核实后自行决定是否提交——这些场景本身已经需要人工介入，不适合先自动提交半成品。当编排方（`/ly:propose` 或 `/ly:apply`）按自身规则决定对这类非清零终止的改动是否提交（见 `ly-propose-flow`、`ly-lifecycle-commands` 能力中的手动模式询问规则）时，是编排方层面在循环结束后对暂存区做提交决策，SHALL NOT 被理解为 review 循环自身的行为；循环自身的约束始终是"非清零 SHALL NOT 提交"。若"正常清零"后的这次统一提交本身执行失败（Git hook 拒绝、身份未配置、锁文件冲突等），必须（SHALL）在报告中如实说明该失败，视为"循环已清零, 但统一提交失败"的独立结果——循环本身不重新进入下一轮（因为已经清零, 没有下一轮的意义），但报告必须明确指出还需要人工手动完成这次提交。传入可选标志 `--no-commit` 时，命令 SHALL NOT 执行这次最终统一提交（不管循环以何种方式结束），已写入的决策保留为 dirty 并在报告中说明，后续同一 change 可复用。

#### Scenario: review-plan 场景下, 编排方暂存的产物与循环修复一并统一提交
- **WHEN** `/ly:propose` 将 `openspec/changes/<change-name>/` 下的产物 `git add` 暂存后调用 `/ly:review-plan <change-name>`; 循环期间因某条 Critical 修复了 `design.md` 与一份 delta spec, 最终清零
- **THEN** 清零后的统一提交先 `git add` 该 change 目录下的全部 artifact 与 delta spec 文件（含编排方已暂存的产物与循环的修复改动）, 再执行一次 commit——产物与修复作为同一待提交单元一并提交, 不存在"循环开始前已脏被跳过"的隔离, commit message 带 `Change-Stage: review-plan-fix` trailer

#### Scenario: review-code 场景下, 被审查的原始改动与修复一并提交
- **WHEN** 用户在触发 `/ly:review-code` 前已有未提交的代码改动（这正是本次的审查对象), 循环期间修复了其中一个 Critical 后清零
- **THEN** 统一提交时先把审查范围内全部文件 `git add`（用户原始改动 + 循环期间修复一并暂存）, 再执行 commit——二者作为同一份改动一起提交, 不做隔离——这是 `/ly:review-code` 的正常预期行为, commit message 带 `Change-Stage: review-code-fix` trailer

#### Scenario: 正常清零后统一提交一次
- **WHEN** 用户（或编排该命令的上层流程）执行 `/ly:review-plan <change-name>`（不带任何标志）, 第一轮发现 1 个 Critical 并修复、`openspec validate` 通过, 第二轮 Critical 数为 0
- **THEN** 循环期间（第一轮修复后）不执行任何 commit; 第二轮清零后, 命令 `git add` 该 change 目录全部 artifact 与 delta spec 文件, 在输出报告之前统一提交, 提交信息形如 `fix(openspec): review-plan 反馈修复（1 轮）` 并带 `Change-Stage: review-plan-fix` / `Change-Name: <change-name>` trailer

#### Scenario: 带 --no-commit 时不做最终提交
- **WHEN** 用户执行 `/ly:review-code --no-commit`, 循环修复了若干 Critical 后清零结束
- **THEN** 命令不执行任何 commit（循环期间和清零后都不提交）, 修改的文件保持在工作区未提交状态

#### Scenario: 循环以非清零终止条件结束, 循环自身不提交已产生的改动
- **WHEN** `/ly:review-code` 第一轮修复 1 个 Critical 后, 第二轮审查判定该问题仍存在（触发熔断）
- **THEN** 循环自身不提交第一轮的改动, 已修改的文件保持在工作区未提交状态, 报告中说明需要人工核实是否保留这次修复; 是否提交改由编排方（`/ly:propose`/`/ly:apply` 手动模式）按自身规则询问用户后决定

#### Scenario: 本轮无实际改动, 不创建空 commit
- **WHEN** 循环从未有任何 Critical 或标注为「是」的 Warning 被 当前会话 判定为认可（因而从未发生实际文件改动), 最终以某种方式清零或终止
- **THEN** 命令不执行 commit, 不产生空提交

#### Scenario: 清零后的统一提交本身失败
- **WHEN** 循环第二轮清零, 命令尝试执行统一提交, 但因 pre-commit hook 拒绝或 Git 身份未配置导致 commit 失败
- **THEN** 命令不重新进入循环（因为已经清零), 在报告中如实说明这次统一提交失败的原始错误信息, 并指出需要人工手动完成提交

#### Scenario: 仅自动修复「是」条目时同样统一提交
- **WHEN** 首轮 Critical 数为 0、存在 2 条标注为「是」的 Warning, 当前会话修复后第 2 轮复审确认已解决并按正常清零结束
- **THEN** 命令 MUST 执行统一提交（判据是发生了实际文件改动），提交信息带该命令对应的 `Change-Stage` trailer 与 `Change-Name: <change-name>`, SHALL NOT 因"没有修过 Critical"而跳过提交

#### Scenario: 仅写入 ask 决策时提交元数据
- **WHEN** review 在 `ask` 下写入 run-state `testModeDecision`，本轮没有其他 Critical/Warning 修复
- **THEN** 正常清零后创建仅含 `run-state.md` 决策修改的统一 commit

#### Scenario: no-commit 或非清零时决策保持 dirty
- **WHEN** review 写入决策后以 `--no-commit` 或非清零终止结束
- **THEN** 决策文件保持未提交，报告说明 dirty 状态，后续同一 change 可复用

#### Scenario: 恢复正常清零时提交历史 dirty 决策
- **WHEN** 前次 review 非清零终止留下 dirty 决策，本次 review 读取该决策后正常清零
- **THEN** 统一提交范围包含 `run-state.md`，即使本次没有新写入决策
