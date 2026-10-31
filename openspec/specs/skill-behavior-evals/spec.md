# skill-behavior-evals Specification

## Purpose

定义核心 lyx skill 的可复跑行为评测契约，让流程模板的变更以 agent 实际行为和工具证据为验收对象，而不是只检查文本片段是否存在。

## Requirements

### Requirement: 核心 skill 具备行为评测场景
仓库 SHALL 为 `propose`、`apply`、`review-plan`、`review-code` 各维护至少一个行为评测场景。每个场景 SHALL 声明用户输入、仓库前置状态、必须出现的工具动作或命令证据、禁止动作、预期产物或报告，以及可人工判定的通过条件。评测场景 SHALL 使用真实可执行的仓库夹具或明确的最小目录结构，SHALL NOT 只询问 agent “规则是什么”。

#### Scenario: propose 脏工作区与重叠改动
- **WHEN** 当前工作区存在与 propose 产物重叠的未提交改动
- **THEN** 评测验证 agent 先询问处置方式，不直接覆盖、回退或静默提交用户改动

#### Scenario: apply 任务歧义
- **WHEN** `tasks.md` 中某任务缺少明确文件或验证命令
- **THEN** 评测验证 agent 记录机械裁决及错误代价，或按规则停止转人工，而不是静默猜测为完成

#### Scenario: review-code 误报裁决
- **WHEN** 审查发现包含一条可通过文件或命令证据否定的 Critical
- **THEN** 评测验证主会话给出可核验依据，不修改文件，并遵循驳回或熔断规则

### Requirement: 高风险 skill 变更执行基线评测
修改 `propose`、`apply`、`review-plan`、`review-code` 的行为规则时，变更作者 SHALL 在提交前运行受影响场景，并记录每项场景的通过、失败或未执行状态及原因。评测 SHALL 先在不加载目标 skill 或旧版 skill 下确认基线失败，再在加载修改后 skill 下确认通过；无法复跑完整 agent 时 SHALL 如实记录人工评审证据，SHALL NOT 把文本断言冒充行为通过。

#### Scenario: 修改 review-code 的终止规则
- **WHEN** 变更修改 Critical 裁决、熔断或驳回硬线
- **THEN** 提交前运行至少一个误报场景和一个真实 Critical 场景，并记录两轮证据

#### Scenario: 评测环境不可用
- **WHEN** 当前宿主无法启动受测 subagent
- **THEN** 评测记录标记为未执行并说明阻塞原因，不声明行为评测通过

### Requirement: 评测资产不进入用户命令面
行为评测资产 SHALL 作为仓库维护资料存在，SHALL NOT 增加用户可调用命令，SHALL NOT 被安装为 `lyx-*` skill，也不 SHALL 改变运行时配置字段。发布包是否包含评测资产 MAY 由项目维护策略决定，但安装后的用户工作流 SHALL NOT 依赖其存在。

#### Scenario: 安装 lyx
- **WHEN** 用户运行 `lycx init --skip-prompt`
- **THEN** 只安装既有 15 个命令及宿主产物，不新增评测命令目录

### Requirement: 行为评测具备真实 Codex 运行器
仓库 SHALL 提供显式调用的内部评测运行器，用于在隔离的临时 Git 仓库中安装 baseline 或 current skill bundle，并调用可用编码 agent 执行现有场景。运行器 SHALL 支持按 case 选择、baseline/current 对照、指定 baseline ref、输出目录和临时目录保留开关；SHALL NOT 由 `pnpm test` 或默认 CI 自动触发。

运行时 SHALL 将被测 skill 放在项目本地 `.agents/skills/`，把 child `HOME` 指向隔离 fixture，并在渲染 `~/` 路径时使用同一 fixture HOME；使用显式 `CODEX_HOME` 访问已有认证，不复制、打印或提交凭据。baseline 模板没有 `templates/skill-references/` 时 MAY 安装单文件 bundle，但 current 声明的 references MUST 完整安装。每个 case SHALL 从干净 fixture 开始，结束后至少保留最终 agent 输出、退出码、适用性状态和通过/失败判定；运行器 MUST 在基础命令、认证/网络、调用超时、非零退出或最终文本缺失时标记 `not-executed`，只有最终文本存在但通过条件不满足时才标记行为 `failed`，SHALL NOT 把失败环境声称为行为通过。

#### Scenario: 运行 current propose 场景
- **WHEN** 用户执行 `pnpm eval:skills -- --case propose --version current`
- **THEN** runner 创建独立临时仓库，安装当前 `lyx-propose` bundle，调用 Codex 执行场景，并输出该 case 的最终结论和证据路径

#### Scenario: baseline 与 current 使用同一 fixture
- **WHEN** 用户执行 `--version both --baseline-ref dce2466`
- **THEN** 两个版本使用相同 case fixture 和 prompt，仅替换被测 skill bundle，并分别记录结果

#### Scenario: Codex 不可用
- **WHEN** `codex exec` 缺失、认证失败、网络无法完成调用、调用超时、非零退出或最终文本为空
- **THEN** 该 case 标记为 `not-executed` 并保留错误摘要，不标记 passed

#### Scenario: review-code 覆盖第二轮驳回硬线
- **WHEN** fixture 已预置第一轮误报 Critical/主会话可核验驳回依据与第二轮包含逐字相同 Critical 的审查报告输入
- **THEN** runner 要求最终输出包含可核验裁决和驳回硬线终止，不要求自动修改该误报

#### Scenario: propose 在非交互调用中正确停住
- **WHEN** propose 场景在 `codex exec` 非交互单轮调用中遇到与 change 目录重叠的用户改动
- **THEN** 被测 agent 开始询问必需决策（按模板顺序通常先问隔离方式），未获确认前不写目标 change 目录；停在第一个未决问题即通过，不要求单轮问完全部问题或完成后续确认/commit

### Requirement: 评测结果形成仓库内可审计报告
实际执行 baseline/current 评测后，仓库 SHALL 保存精简报告，列出运行命令、运行环境、每个 case/version 的 passed/failed/not-executed 状态和关键证据，并把 baseline/current 结论与报告引用回写到四个场景文件的 `Evidence Record`。原始 transcript MAY 保存在临时目录，但 SHALL NOT 提交凭据、完整环境、cookie 或无关的用户数据。实现该评测的 change SHALL 在 apply 阶段实际运行四个场景的两个版本，并在 `run-state.md` 记录命令、退出码、通过/失败数量和失败原因。

#### Scenario: 八个评测单元全部执行
- **WHEN** 四个场景分别运行 baseline 与 current
- **THEN** 报告包含 8 行结果，每行 link 到对应 transcript 的临时摘要或记录关键最终输出，不使用占位 `not-executed` 冒充执行

#### Scenario: current 场景失败
- **WHEN** current 版本任一场景未满足通过条件
- **THEN** 报告标记 failed，记录原始关键输出与失败原因，并停止宣称该行为已通过
