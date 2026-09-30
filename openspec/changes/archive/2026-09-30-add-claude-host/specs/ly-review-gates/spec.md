## MODIFIED Requirements

### Requirement: 审查执行者可切换（main / subagent）

**适用范围覆盖（自本 change 起）**：本能力中凡以"spawn 审查 subagent"为前提的 Requirement（含「审查 subagent 轮内纪律」「审查返回有效性判定」「审查关卡以单审查 subagent（非 fork）执行」「Critical 裁决：认可即修复、不认可必须附可核验依据」「审查调用失败分类处理」「审查-修复循环与终止条件」「全局轮数上限作为最后兜底」「循环结束后统一提交」），其适用范围 SHALL 限定为 `reviewExecutor = "subagent"` 时；`reviewExecutor = "main"`（默认，含未配置）时 SHALL 以本 Requirement 为准。两条路径的分歧点以本 Requirement 为权威。

**配置载体与等待语义按宿主（自本 change 起）**：执行者字段 SHALL 从当前宿主的宿主作用域配置读取（见 `multi-host-install` 与 `subagent-agent-config`）——codex 宿主为 `~/.codex/lyx/config.toml` 的宿主配置节，claude 宿主为 `~/.claude/lyx/config.toml` 的宿主配置节；本 Requirement 及本能力其他 Requirement 正文中出现的 `~/.codex/lyx/config.toml` 与 `[codexHost]` SHALL 按上述宿主作用域解读，字段语义在两个宿主一致。子代理路径下"同轮同步等待"的表述 SHALL 按宿主能力如实落实：宿主能把结果在同一回合内返回时，主会话 SHALL 在本轮内等待并消费结果；宿主在交互模式下默认以后台方式运行子代理时，「审查 subagent 轮内纪律」中的"同轮 wait" SHALL 解读为"子代理结果必须被消费并如实报告"，SHALL NOT 声称其为本轮内同步阻塞，也 SHALL NOT 以自然语言描述代替实际的子代理调用与结果消费。

**审查角色提示词来源按宿主（自本 change 起）**：审查子代理的角色提示词来源 SHALL 按宿主解析——codex 宿主沿用既有的角色词文件（TASK 指示子代理读取该角色词的绝对路径）；claude 宿主 SHALL 使用该宿主的子代理定义自带的系统提示词（定义正文即角色设定），SHALL NOT 在该宿主下要求子代理读取 codex 侧的角色词路径。共享模板中的 codex 角色词绝对路径 SHALL 归入 codex 宿主片段或由渲染阶段注入，SHALL NOT 出现在 Claude 宿主的产物中。

**子代理生命周期按宿主（自本 change 起）**：「审查 subagent 轮内纪律」中的"消费完即关闭"与"SHALL NOT 假设 subagent 跨用户回合存活"两条 SHALL 按本 Requirement 的跨轮复用契约重解释：单轮结果消费完毕但后续仍可能复用时，SHALL NOT 提前关闭该子代理；关闭时机 SHALL 为整个审查循环结束、或已确定不再复用该子代理之时。"不假设跨用户回合存活"SHALL 解读为"SHALL NOT 依赖子代理跨用户回合可用"，与"同一命令执行内的跨轮复用"不冲突；复用失效时仍按既有回退口径重新 spawn。

**执行者解析**：`@lyx-review-plan` / `@lyx-review-code` SHALL 读取当前宿主的 `reviewExecutor`（未配置、空白或非法取值等价 `"main"`）决定本轮审查的执行者。审查范围判定、基线锚定、未跟踪清单采集（含 `review-findings.md` 审查未修项快照的排除，见 `review-findings-snapshot`）、Critical / Warning / Info 分级输出、`openspec validate` 这些与执行者无关的规则 SHALL 在两条路径下保持一致。`review-findings.md` SHALL NOT 被当作可挑错的审查对象或修复对象，且 SHALL 从审查命令的未跟踪（`??`）清单中排除——避免它既被当作审查对象、又被 review-plan / apply / review-code 的中间 commit 提前纳入；该排除 SHALL 在 `main` 与 `subagent` 两条路径下同样生效。

**main 路径（默认）**：

- 主 agent SHALL 在当前会话直接执行审查，SHALL NOT spawn 子代理、SHALL NOT 读取 `reviewModel` / `reviewReasoningEffort`、SHALL NOT 产生 `[回退]` 标记。
- 主 agent SHALL 直接读取审查对象（review-plan 为 change 产物与全部 delta spec；review-code 为审查范围对应的 git diff 与未跟踪清单），产出 Critical / Warning / Info 分级发现。
- SHALL NOT 存在"审查发现 vs 主会话裁决"两个主体：主 agent 的发现即最终裁决，SHALL NOT 适用逐条裁决、驳回硬线、熔断、审查对象类型持续系统性误判这些为双主体仲裁设计的条件。
- 发现 Critical 时主 agent SHALL 直接修复，修复后 SHALL 再自查一轮确认清零；自审循环 SHALL 最多 2 轮，达到上限仍非清零时 SHALL 停止并转人工。
- review-plan 场景每轮修复后 SHALL 运行 `openspec validate --changes <change-name>`；SHALL NOT 运行测试 / 类型检查 / 构建——慢验证统一由 `archive-verification-gate` 在归档前执行一次。
- 清零后 SHALL 按既有「循环结束后统一提交」规则提交一次；`--no-commit` 时跳过。

**subagent 路径**：

- 主会话 SHALL spawn 1 个审查 subagent（非 fork，只携带 TASK），模型按当前宿主的 `reviewModel`、非空推理档按 `reviewReasoningEffort` 落实；TASK SHALL 指示读取该 change 目录下 `context.md`。
- 首轮之后 SHALL 优先复用同一子代理（宿主支持时会话保持能力等价于 `send_input`）；复用失败（会话丢失、复用调用报错）SHALL 回退为重新 spawn 全新子代理，并按增量语义携带上一轮全部 Critical 逐字原文与路径清单。
- 逐条裁决、驳回硬线、熔断、审查对象类型持续系统性误判、全局轮数上限（5 轮）等既有规则 SHALL 保持适用。
- review-plan 场景每轮修复后 SHALL 运行 `openspec validate`；SHALL NOT 运行测试 / 类型检查 / 构建——慢验证统一由 `archive-verification-gate` 在归档前执行一次。

**回退**：`reviewExecutor = "subagent"` 但宿主不支持 spawn 或首次 spawn 失败时，SHALL 按 `subagent-agent-config` 的回退口径回退 main 路径并输出 `[回退] subagent 不可用: <原始报错>`，SHALL NOT 视为流程失败。

**废止被实测推翻的假设**：本能力原有 Requirement 中"子 agent 会话随主会话回合结构而存在，回合结束即失去访问能力"SHALL 废止——宿主支持子代理首次任务完成后再唤醒并保留其会话上下文，因此"每轮必须重新 spawn"不再是约束。

#### Scenario: 默认由主 agent 直接审查
- **WHEN** 用户未配置 `reviewExecutor`（等价 `main`），运行 `@lyx-review-plan`
- **THEN** 主 agent 直接读取 change 产物产出分级发现，不 spawn 子代理、不产生回退标记；发现 Critical 时直接修复并最多自查 2 轮

#### Scenario: 主 agent 路径不适用裁决与驳回硬线
- **WHEN** 主 agent 执行审查并发现 Critical
- **THEN** 主 agent 直接修复，不进入"逐条裁决 / 不认可须附可核验依据 / 驳回硬线 / 熔断"流程

#### Scenario: 主 agent 路径不做慢验证
- **WHEN** 主 agent 在 review-code 场景修复了 Critical
- **THEN** 命令 SHALL NOT 运行测试 / 类型检查 / 构建，仅在报告中说明慢验证已由归档前关卡负责

#### Scenario: subagent 路径复用同一子代理
- **WHEN** 配置 `reviewExecutor = "subagent"`，首轮审查报告 Critical，主会话修复后进入第 2 轮
- **THEN** 主会话复用首轮子代理，携带修复说明与上轮 Critical 原文；复用失败才回退重新 spawn

#### Scenario: spawn 不可用时回退 main 路径
- **WHEN** 配置 `reviewExecutor = "subagent"` 但宿主不支持 spawn 或首次 spawn 失败
- **THEN** 命令回退主 agent 直接审查并输出 `[回退] subagent 不可用: <原始报错>`，流程不中断

#### Scenario: 未修项快照在两条执行者路径下都被排除
- **WHEN** 某 change 目录下存在未跟踪的 `review-findings.md`，用户运行 review-plan 或 review-code（无论 `reviewExecutor` 为 `main` 还是 `subagent`）
- **THEN** 该文件从审查命令的未跟踪清单中排除，既不被当作可挑错的审查对象，也不被审查循环的统一 commit 纳入；它保持未跟踪直到 `@lyx-archive`

#### Scenario: 按宿主读取执行者配置
- **WHEN** 在 claude 宿主下运行审查，执行者字段配置在该宿主的宿主作用域配置节中
- **THEN** 命令按该宿主的取值决定执行者，SHALL NOT 因配置不在 codex 宿主路径下而回退为默认 `main`

#### Scenario: 交互模式下不冒充同轮同步等待
- **WHEN** 在宿主交互模式下以子代理路径执行审查，且该宿主默认以后台方式运行子代理
- **THEN** 报告如实描述等待方式（结果被消费并如实报告），SHALL NOT 出现"本轮内同步等待完成"一类与宿主实际行为不符的表述

#### Scenario: Claude 产物不引用 codex 角色词路径
- **WHEN** 安装 claude 宿主并检查其审查命令产物与子代理定义
- **THEN** 产物中不出现 codex 侧角色词文件的绝对路径，角色设定来自该宿主的子代理定义正文

#### Scenario: 跨轮复用期间不提前关闭子代理
- **WHEN** 首轮审查完成、主会话修复后仍需进入第 2 轮复用同一子代理
- **THEN** 首轮结果消费后不关闭该子代理，复用其续跑能力；循环结束或确认不再复用时才关闭，SHALL NOT 因"消费完即关闭"而丢失复用能力
