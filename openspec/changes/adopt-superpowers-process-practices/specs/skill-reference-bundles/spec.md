## Purpose

定义长 skill 的主文件与按需参考文件分层，确保流程在上下文压缩后仍能读回完整规则，同时保持技能发现、宿主差异渲染和安装产物完整。

## ADDED Requirements

### Requirement: 长 skill 主文件保持压缩安全体积
仓库中 `propose`、`review-plan`、`review-code` 的最终宿主渲染 `SKILL.md` SHALL 保持在 20,000 字节以内。超出主文件职责的判级表、终止条件、提交协议、快照格式、恢复语义和详细示例 SHALL 移入同 skill 的 `references/` sidecar，并由主文件在对应步骤显式要求按需读取。参考文件 SHALL NOT 被要求在每个会话开始时预读。

#### Scenario: Claude Code 压缩后重挂
- **WHEN** 长时间会话发生上下文压缩，宿主只重新挂载主 `SKILL.md`
- **THEN** 主文件中的阶段入口仍存在，并明确指示在审查、提交或恢复前读取对应 reference

#### Scenario: reference 缺失
- **WHEN** 主文件要求的 reference 文件在安装目录中缺失
- **THEN** 命令停止并报告缺失路径，不得在缺少规则的情况下继续执行关键关卡

### Requirement: skill description 只描述触发条件
核心 skill 的 frontmatter `description` SHALL 描述何时使用该 skill、覆盖哪些用户触发条件和不适用边界，SHALL NOT 概括完整执行流程、审查轮次、提交顺序或宿主实现细节。完整流程 SHALL 只在主 `SKILL.md` 正文和 references 中定义。

#### Scenario: 用户触发 propose
- **WHEN** agent 只读 skill description 决定是否加载
- **THEN** 它能判断“需要创建完整 OpenSpec change”时使用 propose，但不会从 description 获得可替代正文的简化流程

### Requirement: 安装器复制并渲染 sidecar references
安装器 SHALL 在安装带 references 的 skill 时，把该 skill 的全部 reference 文件复制到目标 skill 目录内，并以与主 `SKILL.md` 相同的宿主变量和片段渲染规则处理。安装后校验 SHALL 检查主文件声明的必需 reference 是否存在且可读；缺失 SHALL 报告安装错误，SHALL NOT 静默安装部分 skill。无 references 的既有 skill SHALL 继续按单 `SKILL.md` 方式安装。

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
