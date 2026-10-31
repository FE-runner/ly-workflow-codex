## Purpose

定义核心 lyx skill 的可复跑行为评测契约，让流程模板的变更以 agent 实际行为和工具证据为验收对象，而不是只检查文本片段是否存在。

## ADDED Requirements

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
