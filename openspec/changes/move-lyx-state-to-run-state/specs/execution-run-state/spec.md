## MODIFIED Requirements

### Requirement: 每个活跃 change 维护 run-state.md
`@lyx-propose` SHALL 在真实 change 名确认后、方案自审开始前立即在 change 目录下创建 `run-state.md`，不得等到自审完成、`context.md` 产出或 propose 阶段 commit 时才首次创建。文件 SHALL 至少记录 change 名、执行模式（`full-auto` / `manual`）、当前阶段与流水线阶段、基线或最后成功 commit、已完成任务比例、最近审查轮次与终止类型、验证证据、机械裁决和下一步安全动作。新建 run-state 的 frontmatter 字段名 SHALL 使用本能力定义的稳定英文标识；标题、正文说明、状态描述和证据摘要 SHALL 使用当前宿主配置中 `[general].language` 对应的自然语言（缺失、空白或非法时按 `zh-CN`）。`@lyx-apply`、review-plan、review-code 与 archive 续写时 SHALL 沿用正文现有语言。`run-state.md` SHALL 与 `context.md` 分离：`context.md` 保存讨论语义和取舍背景，`run-state.md` 只保存可恢复执行状态。

#### Scenario: 方案自审前初始化
- **WHEN** 真实 change 名确认，propose 即将进入方案自审
- **THEN** `run-state.md` 已存在，记录执行模式、`stage: propose-self-review`、流水线阶段和下一步安全动作

#### Scenario: propose 完成
- **WHEN** change artifacts、context.md 与方案自审完成
- **THEN** run-state 记录执行模式、阶段为 propose commit 已完成，并给出同一回合的下一流水线阶段或手动路径下一步审查入口

#### Scenario: zh-CN 宿主生成中文运行账本
- **WHEN** 当前宿主配置的 `[general].language` 为 `zh-CN`
- **THEN** run-state 正文使用中文标题、字段说明和状态描述，frontmatter 键名与枚举保持稳定英文标识

## ADDED Requirements

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
