# execution-run-state Specification

## Purpose

定义 lyx 全自动流程的非持久执行状态边界：状态只在同一未中断回合内传递，跨回合恢复依赖 Git、tasks、context、commit trailer 与审查快照，不创建 run-state 账本。

## Requirements

### Requirement: 每个活跃 change 维护 run-state.md
`@lyx-propose` SHALL 在真实 change 名确认后、方案自审开始前立即在 change 目录下创建 `run-state.md`，不得等到自审完成、`context.md` 产出或 propose 阶段 commit 时才首次创建。文件 SHALL 至少记录 change 名、执行模式（`full-auto` / `manual`）、当前阶段与流水线阶段、基线或最后成功 commit、已完成任务比例、最近审查轮次与终止类型、验证证据、机械裁决、方案自审逐项结论和下一步安全动作。新建 run-state 的 frontmatter 字段名 SHALL 使用本能力定义的稳定英文标识；标题、正文说明、状态描述和证据摘要 SHALL 使用当前宿主配置中 `[general].language` 对应的自然语言（缺失、空白或非法时按 `zh-CN`）。`@lyx-apply`、review-plan、review-code 与 archive 续写时 SHALL 沿用正文现有语言。`run-state.md` SHALL 与 `context.md` 分离：`context.md` 保存讨论语义和取舍背景，`run-state.md` 只保存可恢复执行状态。

#### Scenario: 方案自审前初始化
- **WHEN** 真实 change 名确认，propose 即将进入方案自审
- **THEN** `run-state.md` 已存在，记录执行模式、`stage: propose-self-review`、流水线阶段和下一步安全动作

#### Scenario: 自审结论写入运行账本
- **WHEN** propose 完成方案自审
- **THEN** `run-state.md` 正文包含 `## 方案自审`，逐项记录所有检查结论；该清单不作为独立 assistant 消息输出

#### Scenario: propose 完成
- **WHEN** change artifacts、context.md 与方案自审完成
- **THEN** run-state 记录执行模式、阶段为 propose commit 已完成，并给出同一回合的下一流水线阶段或手动路径下一步审查入口

#### Scenario: zh-CN 宿主生成中文运行账本
- **WHEN** 当前宿主配置的 `[general].language` 为 `zh-CN`
- **THEN** run-state 正文使用中文标题、字段说明和状态描述，frontmatter 键名与枚举保持稳定英文标识

### Requirement: run-state 在阶段转换和验证后更新
propose、apply、review-plan、review-code 和 archive SHALL 在阶段开始或结束时更新 `run-state.md`。每完成一个任务或一轮审查，SHALL 记录最近可用基线 commit、检查命令、退出码、关键结果和未决项；当工作尚未进入阶段统一 commit 时 SHALL 标记“待本次阶段提交归属”，统一 commit 成功后 SHALL 在同一生命周期的下一次允许更新中回填 SHA。该规则 SHALL NOT 要求每个任务或每轮审查新增独立 commit。更新 SHALL 是增量或幂等的，SHALL NOT 删除既有证据。无状态变化的阶段 MAY 保持文件不变，SHALL NOT 为凑更新制造空内容。

全自动模式下，阶段报告非终态：当前阶段正常完成、无未决业务决策且未触发终止条件时，命令 SHALL 根据 run-state 的 `流水线阶段` 与 `下一步安全动作` 在同一回合继续下一阶段，SHALL NOT 在阶段报告输出后等待用户再次触发。

#### Scenario: review-plan 正常清零
- **WHEN** 某轮 review-plan 以 Critical 为 0 且所有影响落地 Warning 已解决结束
- **THEN** run-state 写入终止类型 `normal`、轮次、统一提交 SHA 和下一步 apply

#### Scenario: 全自动阶段报告后继续
- **WHEN** run-state 的执行模式为 `full-auto`，review-plan 或 apply 阶段正常完成且无未决项
- **THEN** 阶段报告作为中间状态输出，命令在同一回合继续下一流水线阶段，不结束回合等待用户输入

#### Scenario: 验证失败
- **WHEN** archive 前测试或构建失败
- **THEN** run-state 记录失败命令、退出码、关键错误摘要和“未归档”状态

### Requirement: 恢复优先读取 run-state 和 git 事实
命令在恢复中断的 change 时 SHALL 先读取 `run-state.md`，再以 `git status`、`git log` 和 `tasks.md` 核对事实。会话记忆与账本冲突时 SHALL 以可核验的 git 状态和文件内容为准，并把冲突记录为新的恢复事件；SHALL NOT 因账本存在就跳过当前文件核对。

#### Scenario: 会话压缩后继续 apply
- **WHEN** 用户在新回合继续一个已完成部分任务的 change
- **THEN** agent 从 run-state 获取 last commit 与任务进度，再用 git 和 tasks 校验后从第一个未完成或证据不一致的任务恢复

### Requirement: run-state 不保存敏感内容
run-state SHALL NOT 写入凭据、token、完整环境变量、私密 URL、用户无关个人信息或大段命令原始输出。验证证据 SHALL 保存命令、退出码、测试计数和短摘要；需要详细信息时引用已有日志路径或 commit，不复制敏感内容。

#### Scenario: 验证命令输出包含环境变量
- **WHEN** 命令输出包含可能的密钥或凭据
- **THEN** run-state 只记录脱敏摘要和“详见终端/日志”，不保存原始值

### Requirement: run-state 参与阶段贡献与归档
`run-state.md` SHALL 视为 change artifact，随对应生命周期阶段 commit 一并提交；review-plan 与 review-code SHALL 把它作为恢复和证据输入，但 SHALL NOT 将其当作实现代码挑错或要求修改的源码。archive SHALL 把最终 run-state 随 change 移入归档目录。

#### Scenario: archive 完成
- **WHEN** change 成功归档
- **THEN** run-state 位于归档 change 目录内，最后阶段为 archive，且包含最终验证证据和分支收尾结果

### Requirement: 全自动下一步安全动作包含交接坐标
全自动模式下的 `run-state.md` `下一步安全动作` SHALL 同时写明下一阶段命令、同级 skill 路径、change 参数和继续条件。恢复执行时，主 agent SHALL 按这些坐标读取下一阶段 bundle；字段只有“继续”“进入下一步”等模糊描述时，SHALL 视为账本信息不足并从当前阶段重建下一动作。

#### Scenario: review-plan 完成后记录 apply 坐标
- **WHEN** review-plan 正常清零并准备进入 apply
- **THEN** `下一步安全动作` 写明完整读取同级 `lyx-apply/SKILL.md`、以目标 change 名执行 apply，且无未决人工介入项

#### Scenario: apply 完成后记录 review-code 坐标
- **WHEN** apply 正常提交并准备进入 review-code
- **THEN** `下一步安全动作` 写明完整读取同级 `lyx-review-code/SKILL.md`、使用本次 apply commit SHA 继续审查

#### Scenario: 模糊状态触发重建
- **WHEN** 全自动 run-state 只有“继续下一阶段”而没有命令、bundle 路径或参数
- **THEN** 主 agent 不据此猜测执行，先从当前阶段和 enabled reviewMode 重建具体交接坐标并记录

### Requirement: run-state.md 使用固定 YAML frontmatter 承载 lyx 状态
新建 change 的 `run-state.md` SHALL 以固定 YAML frontmatter 保存 lyx 机器可读状态，至少包含 schema 版本、change 名、阶段、执行模式、流水线阶段、`testModeDecision`、隔离方式、来源分支、开发分支、worktree 路径、最后成功 commit、已完成任务数、审查状态和下一步安全动作。frontmatter 字段名和技术取值 SHALL 使用稳定的英文标识，Markdown 正文仍可使用宿主配置语言记录说明与证据；正文 SHALL NOT 作为上述机器字段的第二权威来源，发生冲突时以 frontmatter 为准。

lyx 状态 SHALL NOT 写入新 change 的 `.openspec.yaml`。该文件只允许 OpenSpec 官方字段；`lyx:` 与 `x-lyx:` 均 SHALL NOT 由新流程写入。

#### Scenario: 新 change 初始化固定 frontmatter
- **WHEN** propose 确认真实 change 名并创建 `run-state.md`
- **THEN** 文件顶部包含固定 YAML frontmatter，阶段为 `propose-self-review`、执行模式为所选路径，且 `.openspec.yaml` 不出现 `lyx:` 或 `x-lyx:`

#### Scenario: 宿主语言只影响正文
- **WHEN** 当前宿主 `[general].language` 为 `zh-CN` 或 `en`
- **THEN** frontmatter 字段名与技术枚举保持稳定英文标识，Markdown 正文的自然语言跟随宿主语言

#### Scenario: 正文与 frontmatter 冲突
- **WHEN** Markdown 正文的说明文字与 frontmatter 中的阶段或隔离字段不一致
- **THEN** 命令以 frontmatter 为机器状态来源，并在报告中记录正文与 frontmatter 的不一致

### Requirement: 旧 change 的 lyx 元数据只读兼容
已有活跃 change 的 `.openspec.yaml` SHALL NOT 被自动迁移或改写。命令读取 lyx 状态时 SHALL 先读取 run-state 固定字段；该字段缺失且目标 change 没有 YAML frontmatter 时，MAY 只读回退 `.openspec.yaml` 顶层 `lyx:`。旧字段 SHALL NOT 写回；同一字段在 run-state 已存在时 SHALL 忽略旧值。

#### Scenario: 旧活跃 change 继续读取旧决策
- **WHEN** 一个存量活跃 change 只有 `.openspec.yaml lyx.testModeDecision = "off"`，没有 run-state 新字段
- **THEN** propose/apply/review/archive 把该值作为只读兼容输入，且不修改 `.openspec.yaml`

#### Scenario: 归档历史不被批量处理
- **WHEN** `openspec/changes/archive/**/.openspec.yaml` 中存在旧 `lyx:` 字段
- **THEN** lyx 不扫描、不迁移、不改写这些归档文件

#### Scenario: 新旧来源同时存在时优先新来源
- **WHEN** 同一 change 的 run-state 固定字段与旧 `.openspec.yaml lyx:` 同时包含测试模式或隔离信息
- **THEN** 命令使用 run-state 固定字段，并忽略对应的旧值

#### Scenario: 损坏的新 frontmatter 不回退
- **WHEN** run-state 含 YAML frontmatter，但 frontmatter 无法解析，或 `lyx.schemaVersion` 缺失或非法
- **THEN** 命令停止并要求人工修复，SHALL NOT 改读旧 `.openspec.yaml` 后继续

### Requirement: 损坏的新 run-state frontmatter 停止处理
run-state 存在 YAML frontmatter 但无法解析、`lyx` 缺失或不是 mapping，或 `schemaVersion` 缺失或不受支持时，命令 SHALL 视为损坏并停止，SHALL NOT 静默回退旧元数据或覆盖该文件。

#### Scenario: frontmatter 结构损坏
- **WHEN** run-state 顶部存在 frontmatter，但 YAML 解析失败或 `lyx` 不是 mapping
- **THEN** 命令停止并要求人工修复，不改写 `.openspec.yaml` 或 run-state
