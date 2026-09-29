## MODIFIED Requirements

### Requirement: apply 实施由 coding subagent 执行
`@lyx-apply` 的实施环节在 `codingExecutor = "subagent"` 时 SHALL 由 coding subagent 执行：主会话 spawn 一个 coding subagent，**非 fork spawn（只携带 TASK，不携带父线程对话历史）**，TASK SHALL 指示读取该 change 目录下 `context.md` 获取软上下文（见 `review-context-artifact`），并在任务中点名"只实施 change 范围"（读取 `openspec/changes/<change-name>/tasks.md` 逐任务实施 + 验证 + 勾选，SHALL NOT 改动范围外文件）。模型 SHALL 按当前宿主的 `codingModel` 落实（见 `subagent-agent-config`；未配置或空白回退当前会话模型），非空推理档按当前宿主的 `codingReasoningEffort` 落实。**宿主等待语义（自本 change 起）**：主会话 SHALL 消费 coding subagent 的返回结果并先逐字转达再确认；宿主能把结果在同一回合内返回时 SHALL 在本轮内等待（wait），宿主在交互模式下默认以后台方式运行子代理时 SHALL 在收到完成通知后消费并如实报告——两种情形下 SHALL NOT 以自然语言描述"已分发/将分发"代替实际的子代理调用与结果消费。coding subagent SHALL NOT 自行 commit：实施完成后将改动与结果回传主会话。**实施完成后主会话 SHALL 按 `review-context-artifact` 的"apply 阶段维护更新 context.md"规则回写实施软上下文，随 apply 阶段 commit（带 `Change-Stage: apply` trailer）一并提交。** spawn coding subagent 前 SHALL 记录一次 `git status --porcelain` 快照**（快照覆盖工作区/暂存区全部现状，含既存改动）：主会话确认阶段 SHALL 再执行一次 `git status --porcelain`，**比对只针对快照之后新增/变化的路径**——既存改动（快照中已存在）不参与比对、不纳入本次提交范围（保持"预存改动未被提交"口径），仅当快照之后出现回传清单之外的改动、或回传文件实际未变动时才判定不一致：不一致 SHALL 停止并报告差异（逐项列出路径），不照单全收；一致才提交——提交前 SHALL 按 `commit-conventions` 的"propose / apply 共用提交范围隔离协议"显式隔离 index：范围外已暂存内容用 `--only` 隔离或 unstage-提交-恢复；同一文件内混合 hunk 无法机械分离时 SHALL 停止转人工。提交后 SHALL 以 `git show --name-only` 校验 apply 阶段 commit 的文件集合严格等于本次清单，不相等则如实报告并修复。**快照即实施前基线，统一覆盖 coding subagent 实施与环境级不可用回退的自实施两条路径**：自实施无 subagent 回传清单，以主会话自己记录的实施改动文件清单（逐项列出并展示给用户）充当回传清单，快照与核对规则与 subagent 路径一致。spawn 前 SHALL 先识别 partial apply：残留判据限定为"改动路径落在本次实施目标文件集合内"——既存 dirty 路径 ∩ 本次实施目标文件集合（tasks.md 指向的 `templates/`、`src/` 等路径）≠ ∅，或该 change 目录下 tasks.md 已出现勾选但对应改动未提交，判定 partial apply，SHALL 停止转人工；与本次实施无关的既存改动明确不算残留，交由快照差集与重叠规则处理。比对时若**快照前已 dirty 的路径**出现在回传清单（与本次改动重叠），无法机械区分同一文件内既存与本轮的 hunk，SHALL 停止转人工，不得猜测性提交，报告中 SHALL 回指 propose 步骤 1 的既存改动处置选择，提示该路径下既存改动与实施目标文件重叠会在此停止。失败区分两阶段：**环境级不可用**（宿主无 subagent 能力、初始 spawn 失败）按 `subagent-agent-config` 的回退口径回退当前会话直接实施（输出显式状态标记 `[回退] subagent 不可用: <原始报错>`），SHALL NOT 视为业务失败；**实施中/验证失败**（coding subagent 报告任务未完成或验证失败）SHALL 原样呈报转人工并附下一步可用命令指引（如 `@lyx-apply <change-name>` 重跑、`@lyx-review-code <change-name>` 暂缓），不自动重试、不切回自实施、不自动兜底。

**子代理模型取值按宿主（自本 change 起）**：本 Requirement 正文原先以 `codexHost.codingModel` 指代模型来源，该指代 SHALL 按宿主作用域解读——值取自当前宿主的宿主作用域配置节（见 `multi-host-install` 与 `subagent-agent-config`）。宿主把模型落实为"运行时按次传参"或"安装期写入子代理定义"由该能力定义，本 Requirement 只要求取值来源与回退语义两宿主一致。

**本能力其他 Requirement 的配置载体按宿主解读（自本 change 起）**：本能力其余 Requirement 正文中出现的 `~/.codex/lyx/config.toml`、`[codexHost]` 与以 `codexHost.<字段>` 形式书写的取值引用，SHALL 按宿主作用域解读——取当前宿主的宿主配置节（见 `multi-host-install` 与 `subagent-agent-config`），执行者与模型字段语义两宿主一致；正文中以 `@lyx-<command>` 形式出现的命令引用 SHALL 视为命令标识，其宿主调用写法由各宿主定义（见 `claude-host`）。

#### Scenario: coding subagent 完成实施
- **WHEN** coding subagent 读 tasks.md 完成全部任务并验证通过
- **THEN** 改动回传主会话；主会话比较当前 porcelain 与 spawn 前快照的新增/变化差集，与回传清单一致且无快照前重叠路径后提交 apply 阶段 commit（带 `Change-Stage: apply` trailer，含 context.md 实施回写），作为 `@lyx-review-code` 的审查对象

#### Scenario: coding subagent 以非 fork 方式 spawn 并经 context.md 获取软上下文
- **WHEN** 主会话 spawn coding subagent
- **THEN** 子代理只携带 TASK（只实施 change 范围点名、tasks.md 与 context.md 路径引用、模型指示），不携带主会话对话历史；SHALL NOT 使用全量 fork

#### Scenario: 回传清单与工作区实际改动不一致
- **WHEN** coding subagent 回传的改动文件清单遗漏了实际改动文件（如漏列一个模板文件）
- **THEN** 主会话比对发现差异，停止该节点，逐项列出差异文件并报告，不执行 commit，转人工确认

#### Scenario: 工作区存在既存改动，快照排除后不影响比对
- **WHEN** apply 启动前工作区已有与本次无关的未提交改动（propose 步骤 1"留在当前分支原样保留"路径），spawn 前已记录 porcelain 快照，coding subagent 回传清单仅含本次改动文件
- **THEN** 主会话比对只针对快照之后新增/变化的路径，既存改动不参与比对、不纳入提交范围，apply 阶段 commit 只含本次改动，报告中说明"预存改动未被提交"

#### Scenario: 环境级回退自实施按主会话清单核对
- **WHEN** 环境无 subagent spawn 能力，主会话按 `subagent-agent-config` 回退口径自实施（输出 `[回退] subagent 不可用: <原始报错>`），实施完成无 subagent 回传清单
- **THEN** 主会话以自己记录的实施改动文件清单（逐项列出并展示给用户）充当回传清单，按快照差集规则比对，一致才提交 apply 阶段 commit（带 `Change-Stage: apply` trailer）

#### Scenario: 既存改动与实施目标文件重叠时停止并回指 propose 处置选择
- **WHEN** 快照前已 dirty 的路径出现在 coding subagent 回传清单中（与本次实施目标文件重叠），且该既存改动来自 propose 步骤 1"留在当前分支原样保留"路径
- **THEN** 主会话停止转人工，报告中回指 propose 步骤 1 的既存改动处置选择，说明该路径下既存改动与实施目标文件重叠会使 apply 停止，不猜测性提交

#### Scenario: coding subagent 实施失败
- **WHEN** coding subagent 报告任务未完成或验证失败
- **THEN** 主会话原样呈报失败详情转人工，不自动重试、不切回自实施、不 commit

#### Scenario: 模型取值按宿主作用域配置
- **WHEN** 在 claude 宿主下配置了 `codingExecutor = "subagent"` 与 `codingModel` 并执行 apply
- **THEN** 实施子代理按该宿主配置的模型运行，SHALL NOT 回落到 codex 宿主的模型取值
