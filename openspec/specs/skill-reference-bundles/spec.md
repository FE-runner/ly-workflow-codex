# skill-reference-bundles Specification

## Purpose

定义长 skill 的主文件与按需参考文件分层，确保流程在上下文压缩后仍能读回完整规则，同时保持技能发现、宿主差异渲染和安装产物完整。

## Requirements

### Requirement: 长 skill 主文件保持压缩安全体积
仓库中 `propose`、`review-plan`、`review-code` 的最终宿主渲染 `SKILL.md` SHALL 保持在 20,000 字节以内。超出主文件职责的判级表、终止条件、提交协议、快照格式、恢复语义和详细示例 SHALL 移入同 skill 的 `references/` sidecar，并由主文件在对应步骤显式要求按需读取。参考文件 SHALL NOT 被要求在每个会话开始时预读。

**关键续跑不变量例外**：为避免关键阶段连续执行规则只存在于工具读取的 reference 输出中，`propose` 与 `review-plan` 主 `SKILL.md` SHALL 保留一份简短、最高优先级的“全自动执行不变量”，至少说明 stage report 非终态、下一阶段必须同回合续跑、结束前核对 `run-state.md`。该摘要 SHALL 控制在能让主文件继续低于 20,000 字节的范围内；完整判据和详细流程仍由 references 提供，不得把全部 reference 内容搬回主文件。

#### Scenario: Claude Code 压缩后重挂
- **WHEN** 长时间会话发生上下文压缩，宿主只重新挂载主 `SKILL.md`
- **THEN** 主文件中的阶段入口仍存在，并明确指示在审查、提交或恢复前读取对应 reference

#### Scenario: reference 缺失
- **WHEN** 主文件要求的 reference 文件在安装目录中缺失
- **THEN** 命令停止并报告缺失路径，不得在缺少规则的情况下继续执行关键关卡

#### Scenario: 全自动续跑不变量在压缩后仍可见
- **WHEN** 会话压缩后宿主只重新挂载 propose 或 review-plan 主 `SKILL.md`
- **THEN** 主文件仍包含“阶段报告非终态、下一阶段同回合续跑、结束前核对 run-state”的简短不变量，不依赖重新读取工具输出才能知道该要求

### Requirement: skill description 只描述触发条件
核心 skill 的 frontmatter `description` SHALL 描述何时使用该 skill、覆盖哪些用户触发条件和不适用边界，SHALL NOT 概括完整执行流程、审查轮次、提交顺序或宿主实现细节。完整流程 SHALL 只在主 `SKILL.md` 正文和 references 中定义。三个超限 skill 的渲染后 description SHALL NOT 包含固定禁止片段：`审查-修复循环`、`终止条件`、`提交顺序`、`自动流水线`、`reviewExecutor`、`spawn`。

#### Scenario: 用户触发 propose
- **WHEN** agent 只读 skill description 决定是否加载
- **THEN** 它能判断“需要创建完整 OpenSpec change”时使用 propose，但不会从 description 获得可替代正文的简化流程

### Requirement: 安装器复制并渲染 sidecar references
主 `SKILL.md` frontmatter SHALL 使用 `references:` 字符串列表声明 required references，路径相对 skill 根目录。安装器 SHALL 以该列表为唯一 required-reference 契约，把列出文件从对应源目录渲染并复制到目标 skill 目录内，以与主 `SKILL.md` 相同的宿主变量和片段规则处理。未在列表中声明的 source 文件 SHALL NOT 被安装。安装后校验 SHALL 检查列表中的每个 reference 是否存在且可读；缺失 SHALL 报告安装错误，SHALL NOT 静默安装部分 skill。无 `references:` 列表的既有 skill SHALL 继续按单 `SKILL.md` 方式安装。force 更新 SHALL 以当前 `references:` 列表为唯一基准清理目标 `references/` 中不再声明的旧文件。

#### Scenario: frontmatter 声明 required reference
- **WHEN** review-code 主文件声明 `references/review-loop.md`
- **THEN** installer、verify、doctor 和 host-adapters 测试都按同一路径检查，不从正文散落的路径文本推断

#### Scenario: 双宿主安装 review-code
- **WHEN** codex 与 claude 宿主分别安装 `review-code`
- **THEN** 两侧都得到主 `SKILL.md` 和完整 `references/`，且 reference 中的宿主片段按各自宿主渲染

#### Scenario: 发布包遗漏 reference
- **WHEN** 打包内容缺少某个已声明 reference
- **THEN** 打包或安装校验失败并指出缺失文件，不生成可调用但断链的 skill

### Requirement: 发布包覆盖 references
包清单与模板完整性测试 SHALL 覆盖共享 skill references 及各宿主 fragments，SHALL 防止新增目录未纳入发布包。安装与 `doctor` SHALL 能识别主 skill 与 references 的结构性缺失。

#### Scenario: 新增 reference 后执行打包测试
- **WHEN** 开发者在 skill references 下新增文件
- **THEN** 打包覆盖测试验证该文件被 `package.json.files` 包含，否则失败

### Requirement: 全自动交接锚点保存在主 skill
`propose`、`review-plan` 与 `apply` 的最终宿主渲染主 `SKILL.md` SHALL 各自保留简短、最高优先级的“全自动交接”段，写明当前阶段的下一阶命令、同级 skill 路径、必须读取主文件与全部 references，以及只输出命令标识不算执行。该段 SHALL 在上下文压缩后仍可见，不得只存在于 sidecar reference。

#### Scenario: 压缩后仍能定位下一阶段
- **WHEN** 全自动会话发生上下文压缩，宿主只重新挂载 `propose`、`review-plan` 或 `apply` 的主 `SKILL.md`
- **THEN** 主文件仍包含下一阶段同级 skill 路径和完整 bundle 读取要求，不依赖此前工具输出

#### Scenario: 主文件过期时测试失败
- **WHEN** 任一上述主文件删除“读取同级 `lyx-<next-command>/SKILL.md` 及其 references”或“只输出命令标识不算交接”的锚点
- **THEN** 模板契约测试失败，不把该 bundle 视为可发布

#### Scenario: review-code 不要求虚构下一阶段
- **WHEN** review-code 以正常清零结束全自动流水线
- **THEN** 该主文件不要求加载不存在的下一 skill，只在报告中说明流水线正常终态
