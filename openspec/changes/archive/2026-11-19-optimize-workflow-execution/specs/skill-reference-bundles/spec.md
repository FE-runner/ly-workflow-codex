## MODIFIED Requirements

### Requirement: 当前核心 skill 主文件自包含
`propose`、`review-plan`、`review-code` 的最终宿主渲染 `SKILL.md` SHALL 各自包含完整流程规则，包括阶段入口、判级、修复循环、提交、快照、恢复和下一阶段交接。三个核心 skill SHALL NOT 声明 `references:`，也 SHALL NOT 依赖 `templates/skill-references/` 下的 sidecar 才能执行关键步骤。

当前核心 skill 的主文件允许超过 20,000 字节。`review-plan` 主 `SKILL.md` SHALL 保留最高优先级的“全自动执行不变量”，至少说明 stage report 非终态、下一阶段必须同回合续跑，并使用当前会话、Git 和 tasks 事实判断是否继续；SHALL NOT 要求核对 `run-state.md`。

#### Scenario: 宿主只重挂核心 skill 主文件
- **WHEN** 长时间会话发生上下文压缩，宿主重新挂载 propose、review-plan 或 review-code 主 `SKILL.md`
- **THEN** 主文件本身包含继续、提交或恢复所需的关键规则，不依赖重新读取 sidecar

#### Scenario: 核心 skill 不声明 reference
- **WHEN** 安装器处理 propose、review-plan 或 review-code 主文件
- **THEN** 解析到的 required-reference 列表为空，三个 skill 的流程不因 `references/` 缺失而断链

#### Scenario: review-plan 续跑不变量在压缩后仍可见
- **WHEN** 会话压缩后宿主只重新挂载 review-plan 主 `SKILL.md`
- **THEN** 主文件仍包含“阶段报告非终态、下一阶段同回合续跑、使用当前会话/Git/tasks 判断”的简短不变量，不依赖重新读取工具输出才能知道该要求
