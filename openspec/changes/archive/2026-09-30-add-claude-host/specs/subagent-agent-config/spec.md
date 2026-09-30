## MODIFIED Requirements

### Requirement: codexHost 提供 codingModel 与 reviewModelB 可选模型字段

**字段集合变更（自本 change 起）**：本 Requirement 标题中的 `reviewModelB` 为历史措辞——自 `switchable-executor-flow` 起 `reviewModelB` 字段被移除，改由执行者字段 `reviewExecutor` / `codingExecutor` 决定主体。语义以正文为准。

**配置载体变更（自本 change 起）**：本 Requirement 及本能力其他 Requirement 正文中出现的 `~/.codex/lyx/config.toml` 与 `[codexHost]` SHALL 按宿主作用域解读——每个宿主各有自己的配置文件与宿主配置节（见 `multi-host-install`），codex 宿主为 `~/.codex/lyx/config.toml`，claude 宿主为 `~/.claude/lyx/config.toml`。宿主配置节名 SHALL 归一为不携带宿主名的统一节；读取 codex 宿主的既有配置文件时 SHALL 兼容历史节名并按本节语义解析。字段集合与语义在全部宿主一致。

每个宿主的配置文件 SHALL 提供 `reviewModel`、`codingModel`、`reviewExecutor`、`codingExecutor` 四个可选字段，均非必填。

**执行者字段语义**：`reviewExecutor` SHALL 决定审查关卡（`@lyx-review-plan` / `@lyx-review-code`）的执行者，`codingExecutor` SHALL 决定实施环节（`@lyx-apply`）的执行者；取值 SHALL 为 `"main"` 或 `"subagent"`，未配置、空白或非法取值 SHALL 等价于 `"main"`（主 agent 直接执行）。该默认值 SHALL 视为破坏性变更：升级用户即使不改配置，行为也会从"spawn 子代理"变为"主 agent 直接执行"。

**模型字段语义**：`reviewModel` / `codingModel` SHALL 仅在对应执行者为 `"subagent"` 时生效，未配置或空白时回退当前会话模型。执行者为 `"main"` 时，模型字段与对应推理档字段 SHALL 被忽略，`lycx doctor` 对该组合输出 WARN 提示（见「doctor 校验子代理模型配置」）。

`src/types/index.ts` SHALL 同步移除 `reviewModelB` 类型定义，新增 `reviewExecutor` / `codingExecutor` 字段。

**模型字段的落实方式按宿主（自本 change 起）**：codex 宿主 SHALL 按原有"模板指示 + 宿主 spawn 能力"方式落实模型与推理档取值。claude 宿主 SHALL 把模型与推理档写入该宿主的子代理定义（子代理定义中的模型字段与推理档字段），未配置或空白时 SHALL 以"继承当前会话模型"为默认取值写入，使该宿主子代理默认继承会话模型与会话推理档；该宿主 SHALL NOT 依赖运行时按次传参的模型/推理档通道。两种宿主下 `main` 执行者路径 SHALL NOT 读取模型与推理档字段。

**宿主机制差异按宿主落实（自本 change 起）**：非 fork 与跨轮复用两条契约在各宿主按其实际能力落实，语义不变——claude 宿主的普通子代理天然运行在独立的全新上下文中（满足非 fork 契约），跨轮复用走该宿主的子代理续跑能力；正文中列举的宿主专有语义（如某宿主的 fork 上下文参数名）仅作该宿主的实现说明，SHALL NOT 被解读为其他宿主的必填参数。宿主在交互模式下默认以后台方式运行子代理时，等待语义按 `ly-review-gates` 的宿主条款解读。

**向导与体检 Requirement 的宿主适用范围（自本 change 起）**：本能力中描述安装向导采集与体检展示的 Requirement，其适用范围 SHALL 按宿主区分——codex 宿主沿用既有采集与展示口径（含 provider 提供方选择与 Codex 现状检测）；claude 宿主按本 delta 的 ADDED Requirement「Claude 宿主的子代理字段采集与体检边界」执行。两套口径之间的差异以该 ADDED Requirement 为准，SHALL NOT 被解读为同一宿主同时适用两套互相矛盾的要求；claude 宿主不适用的采集步骤 SHALL NOT 被判定为缺失或失败。

#### Scenario: 仅配置 reviewModel，未配置新字段
- **WHEN** 用户只配置审查模型，未配置 `codingModel` / `reviewExecutor` / `codingExecutor`
- **THEN** 两个执行者均视为未配置（等价 `main`），审查与实施由主 agent 直接执行；审查模型因执行者为 `main` 不生效，`lycx doctor` 输出 WARN

#### Scenario: 存量 reviewModelB 保留但不生效
- **WHEN** 用户存量配置包含 `reviewModelB = "B"`，运行审查关卡
- **THEN** 自本 change 起该字段被移除：不再被读取、不再保留写回，`lycx doctor` 提示该字段已移除；用户如需独立审查应配置 `reviewExecutor = "subagent"`（本 scenario 标题为历史标签，语义以正文为准）

#### Scenario: 三个字段全部配置
- **WHEN** 用户配置 `reviewExecutor = "subagent"`、`reviewModel = "A"`、`codingExecutor = "subagent"`、`codingModel = "C"`
- **THEN** 审查 subagent 用 A、coding subagent 用 C（本 scenario 标题中"三个字段"为历史措辞）

#### Scenario: 未配置执行者字段时默认主 agent 执行
- **WHEN** 某宿主配置文件的宿主配置节未配置 `reviewExecutor` / `codingExecutor`
- **THEN** 审查与实施均由主 agent 直接执行，不 spawn 子代理

#### Scenario: 执行者为 main 时模型字段被忽略
- **WHEN** 用户配置 `reviewExecutor = "main"` 与 `reviewModel = "gpt-5.6-terra"`
- **THEN** 审查由主 agent 直接执行，`reviewModel` 不生效；`lycx doctor` 对该组合输出 WARN 提示

#### Scenario: 历史节名兼容读取
- **WHEN** codex 宿主的配置文件中宿主配置节沿用历史节名
- **THEN** 该节内的执行者、模型与推理档取值被正确读取并按本节语义生效，SHALL NOT 因节名沿用旧形态而被忽略或清空

#### Scenario: 两宿主各自持有独立执行者配置
- **WHEN** 用户在 codex 宿主配置中设 `codingExecutor = "subagent"`，在 claude 宿主配置中保持未配置
- **THEN** codex 宿主的实施走子代理，claude 宿主的实施由主 agent 直接执行，两侧取值互不影响

#### Scenario: claude 宿主模型写入子代理定义
- **WHEN** claude 宿主配置了审查子代理模型与推理档，用户执行安装
- **THEN** 该取值写入该宿主的子代理定义文件，子代理按该模型与推理档运行

#### Scenario: claude 宿主未配置模型时子代理继承会话
- **WHEN** claude 宿主未配置审查子代理的模型与推理档
- **THEN** 子代理定义以继承语义写入，子代理使用当前会话的模型与推理档，SHALL NOT 阻断安装或审查流程

## ADDED Requirements

### Requirement: Claude 宿主的子代理字段采集与体检边界

claude 宿主的安装向导 SHALL 采集执行者字段（`reviewExecutor` / `codingExecutor`，取值 main / subagent），交互菜单 SHALL 提供同一开关；SHALL NOT 采集子代理的模型与推理档字段，也 SHALL NOT 采集或写入该宿主自身的 provider（模型与网关）配置；该宿主的子代理定义 SHALL 以"继承当前会话"为默认。`lycx doctor` 的子代理配置检查项 SHALL 按宿主分别展示：codex 宿主沿用既有展示口径，claude 宿主 SHALL 展示其宿主配置节中的执行者字段与子代理定义侧的实际取值来源（继承或已指定），并在未采集模型字段时不报缺失错误。

#### Scenario: claude 宿主向导不采集模型字段

- **WHEN** 用户交互安装 claude 宿主
- **THEN** 向导出现执行者选择（main / subagent）并写入该宿主配置节；不出现子代理模型与推理档采集步骤，也不出现该宿主 provider 配置的采集或写入，摘要中如实说明子代理默认继承会话模型

#### Scenario: doctor 按宿主展示子代理配置

- **WHEN** 两个宿主均已安装，用户运行 `lycx doctor`
- **THEN** 子代理配置检查项按宿主分别展示；claude 宿主的子代理定义为继承语义时标注为继承而非缺失，SHALL NOT 输出"未配置模型"类错误
