# claude-host Specification

## Purpose
定义 Claude Code 宿主接入后的可观察行为：产物落位与命令前缀、审查以主 agent 为基线的完整语义、子代理可选路径及其如实降级，以及不越界修改宿主自有配置与 OpenSpec 产物的边界。

## Requirements

### Requirement: Claude 宿主产物布局

安装 Claude 宿主时，lyx SHALL 将该宿主的命令安装为 `~/.claude/skills/lyx-<command>/SKILL.md`，将审查与实施子代理定义安装为 `~/.claude/agents/lyx-*.md`，并将该宿主的配置写入 `~/.claude/lyx/config.toml`。宿主自有的命令目录结构（如 OpenSpec 生成的 `.claude/commands/`）SHALL NOT 被 lyx 用作自身命令的安装位置。

#### Scenario: 安装后产物落位

- **WHEN** 用户选择安装 Claude 宿主
- **THEN** `~/.claude/skills/` 下出现 `lyx-*` 命令目录，`~/.claude/agents/` 下出现 `lyx-*` 子代理定义，配置写入 `~/.claude/lyx/config.toml`

#### Scenario: 重复安装不产生重复产物

- **WHEN** 用户对已安装的 Claude 宿主再次执行安装
- **THEN** 产物路径与既有路径一致，不产生第二套命令目录或第二套子代理定义

### Requirement: 命令调用前缀按宿主渲染

在 Claude 宿主产出的产物中，lyx 命令的调用写法 SHALL 渲染为该宿主的调用语法（`/lyx-<command>`）；codex 宿主 SHALL 保持既有写法（`@lyx-<command>`）。该差异 SHALL 在安装期渲染阶段落实，SHALL NOT 通过在模板正文内嵌宿主条件块或维护双份正文实现。

模板中委托 OpenSpec 的 `@openspec-<skill>` 引用在 Claude 宿主产物中 SHALL 改写为调用同名 skill（`openspec-<skill>`），SHALL NOT 改写为 OpenSpec 生成的 `/opsx:<cmd>` 命令——委托语义是读取该 skill 并按其流程执行，且依赖前置检查只校验 skill 的可发现性。codex 宿主保持既有写法。命令标识约定见 `multi-host-install`。

#### Scenario: Claude 产物使用斜杠前缀

- **WHEN** lyx 安装 Claude 宿主并渲染命令模板
- **THEN** 模板正文中的 lyx 命令引用与调用示例均以 `/lyx-<command>` 呈现

#### Scenario: codex 产物写法不变

- **WHEN** lyx 安装 codex 宿主并渲染命令模板
- **THEN** 模板正文中的 lyx 命令引用与调用示例保持 `@lyx-<command>`，与本次改造前一致

#### Scenario: Claude 产物中 OpenSpec 委托改写为 skill 调用

- **WHEN** lyx 安装 Claude 宿主并渲染 propose / explore / archive 模板
- **THEN** 产物中不残留 `@openspec-` 前缀，委托处以调用 `openspec-<skill>` skill 的写法呈现，不引用 `/opsx:*` 命令

#### Scenario: 共享正文不含宿主分支

- **WHEN** 检查共享模板正文
- **THEN** 其中不出现宿主条件块或宿主名称分支，宿主差异全部由各宿主的渲染阶段产出

### Requirement: Claude 侧审查以主 agent 为基线

Claude 宿主的方案审查、代码审查与实施环节 SHALL 在未显式配置子代理执行者时由主 agent 直接执行，并保留完整审查语义：发现按 Critical/Warning/Info 分级、Critical 清零作为准出条件、自审循环最多 2 轮后停止转人工、循环结束时按既有纪律写入审查未修项快照。上述语义 SHALL NOT 因宿主不同而降级或省略。

#### Scenario: 默认由主 agent 执行审查

- **WHEN** Claude 宿主未配置子代理执行者，用户运行方案审查或代码审查
- **THEN** 主 agent 在当前会话直接完成审查并输出分级结果，不产生子代理调用，也不输出子代理回退标记

#### Scenario: 自审达到轮数上限即转人工

- **WHEN** Claude 宿主的主 agent 自审在 2 轮内仍未清零 Critical
- **THEN** 停止循环并如实报告，不继续自动修复、不视为通过

#### Scenario: 循环结束仍写快照

- **WHEN** Claude 宿主的审查循环结束（正常清零或任一终止条件收尾）
- **THEN** 按既有纪律写入审查未修项快照，快照格式与 codex 宿主一致

### Requirement: Claude 侧子代理为可选增强

显式配置子代理执行者时，Claude 宿主 SHALL 以非 fork 的独立子代理执行审查与实施，并在后续轮次复用同一子代理。子代理不可用、spawn 失败或复用失败时，SHALL 输出显式状态标记 `[回退] subagent 不可用: <原始报错>` 并回退为主 agent 执行，SHALL NOT 视为流程失败。Claude 侧子代理定义 SHALL 默认继承会话模型，并 SHALL NOT 为该子代理启用 worktree 隔离（实施改动须留在主检出以便主会话统一提交）。

子代理定义 SHALL 随 Claude 宿主安装而始终安装，SHALL NOT 按执行者取值增删；执行者字段只决定审查与实施环节是否使用这些定义。执行者字段 SHALL 由安装向导的执行者选择（main / subagent）与交互菜单的同一开关显式设定，写入 `~/.claude/lyx/config.toml` 的宿主配置节。审查子代理定义的工具集 SHALL 包含完成审查所需的 Bash（review-code 读取 git diff 与未跟踪清单、review-plan 运行 `openspec validate`），并 SHALL 在定义正文中把 Bash 用途限定为只读的 `git` 与 `openspec` 命令；SHALL NOT 仅提供文件读取类工具而使子代理路径无法执行审查。

#### Scenario: 配置子代理后走独立子代理

- **WHEN** Claude 宿主显式配置子代理执行者，用户运行审查
- **THEN** 以一个非 fork 的独立子代理执行审查，其上下文不包含父会话历史，软上下文经 change 目录的软上下文文件到达

#### Scenario: 子代理不可用时显式回退

- **WHEN** Claude 宿主配置了子代理执行者但宿主不具备子代理能力或首次 spawn 失败
- **THEN** 输出 `[回退] subagent 不可用: <原始报错>`，回退为主 agent 执行，流程不中断

#### Scenario: 实施子代理不启用 worktree 隔离

- **WHEN** Claude 宿主以子代理执行实施环节
- **THEN** 改动落在主检出，子代理不自行提交，改动清单与结果回传主会话

#### Scenario: 子代理定义不随执行者取值增删

- **WHEN** 用户安装 Claude 宿主时选择执行者为 `main`，之后经菜单切换为 `subagent`
- **THEN** 安装时已存在 `lyx-*` 子代理定义，切换后直接使用，无需重装或重渲定义

#### Scenario: 审查子代理可执行只读命令

- **WHEN** 检查已安装的 Claude 审查子代理定义
- **THEN** 其工具集包含 Bash，正文限定 Bash 仅用于只读的 `git` 与 `openspec` 命令

#### Scenario: 跨轮复用同一子代理

- **WHEN** 审查进入第二轮
- **THEN** 优先复用首轮子代理并按其增量语义传入上一轮结论；复用失败才重新起一个非 fork 子代理并如实说明原因

### Requirement: 交互模式等待语义如实标注

Claude 宿主交互模式下，宿主默认以后台方式运行子代理，主会话在收到完成通知后继续。因此该宿主路径 SHALL 把"同轮同步等待"如实表述为"子代理结果必须被消费并如实报告"，SHALL NOT 声称其为本轮内同步阻塞。非交互模式或显式关闭后台任务时，前台等待语义照常适用。

#### Scenario: 交互模式不冒充同轮同步

- **WHEN** 在 Claude 宿主交互模式下执行审查子代理
- **THEN** 报告中如实描述等待方式，不出现"本轮内同步等待完成"一类与宿主实际行为不符的表述

### Requirement: 项目初始化产出可被加载的项目记忆

在 Claude 宿主下执行项目初始化时，除生成或更新项目根目录的 `AGENTS.md` 外，SHALL 额外产出或更新导入 `AGENTS.md` 的 `CLAUDE.md`，使该宿主的项目指令实际可被加载。该宿主下初始化提交的暂存文件集合与结果汇总 SHALL 与所产出的记忆文件保持一致；目标记忆文件已存在且已有用户内容时 SHALL 增量更新，SHALL NOT 覆盖既有内容。

#### Scenario: 产出可加载的项目记忆

- **WHEN** 在 Claude 宿主下执行项目初始化，项目根目录只有 `AGENTS.md` 或两者都不存在
- **THEN** 生成或更新 `AGENTS.md`，并产出导入它的 `CLAUDE.md`，提交文件清单包含这两份文件

#### Scenario: 既有记忆文件增量更新

- **WHEN** 项目根目录已存在含用户内容的 `CLAUDE.md`
- **THEN** 增量更新并保留既有章节，不整体覆盖、不删除用户内容

### Requirement: 不越界修改宿主自有配置与 OpenSpec 产物

安装与卸载 Claude 宿主时，lyx SHALL NOT 写入该宿主自身的 provider（模型与网关）配置，SHALL NOT 删除或修改 OpenSpec 自有产物（如 `.claude/commands/` 下的 OpenSpec 命令与 `.claude/skills/openspec-*`）。对当前项目的 OpenSpec 依赖修复 SHALL 经 OpenSpec 官方命令完成，SHALL NOT 由 lyx 直接改写其产物。

#### Scenario: 卸载保留 OpenSpec 自有产物

- **WHEN** 用户卸载 Claude 宿主，项目中存在 OpenSpec 生成的命令与技能产物
- **THEN** 只移除 `lyx-*` 命令与 `lyx-*` 子代理定义以及 `~/.claude/lyx/`，OpenSpec 自有产物原样保留

#### Scenario: 不写入宿主 provider 配置

- **WHEN** 用户安装 Claude 宿主
- **THEN** 该宿主的模型与网关配置不被 lyx 创建或修改

### Requirement: Claude 子代理定义的取值表示与重渲时机

该宿主的子代理定义 SHALL 以宿主 frontmatter 字段表达模型与推理档：未配置或清洗后为空时 SHALL 写为"继承当前会话"的取值（显式继承值或等价的省略形式，两者择一并保持一致），显式配置时 SHALL 写入配置取值的原文（trim 后）。宿主配置在安装之后被修改时，SHALL 由重装或更新路径按当前配置重新渲染该宿主的子代理定义；体检 SHALL 能检测到"配置取值与已安装定义不一致"并如实提示，SHALL NOT 静默沿用旧定义。取值本身 SHALL NOT 做枚举白名单强校验——合法性由宿主实际能力判定，被拒绝时如实展示宿主返回的报错。

#### Scenario: 未配置时写为继承

- **WHEN** claude 宿主的子代理模型与推理档均未配置
- **THEN** 已安装的子代理定义以继承当前会话的取值表示（显式继承值或省略形式，口径统一），不写入任何具体模型名

#### Scenario: 显式配置时写入配置值

- **WHEN** 用户为该宿主配置了子代理模型与推理档
- **THEN** 已安装的子代理定义写入该取值的 trim 后原文，不做枚举校验、不改写为其他值

#### Scenario: 配置变更后重新渲染

- **WHEN** 用户在安装之后修改该宿主的子代理模型或推理档，并执行重装或更新
- **THEN** 已安装的子代理定义按新配置重新渲染；若用户未执行重装或更新，体检检测到不一致并如实提示
