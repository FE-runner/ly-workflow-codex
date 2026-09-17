## ADDED Requirements

### Requirement: 审查执行者可切换（main / subagent）

**适用范围覆盖（自本 change 起）**：本能力中凡以"spawn 审查 subagent"为前提的 Requirement（含「审查 subagent 轮内纪律」「审查返回有效性判定」「审查关卡以单审查 subagent（非 fork）执行」「Critical 裁决：认可即修复、不认可必须附可核验依据」「审查调用失败分类处理」「审查-修复循环与终止条件」「全局轮数上限作为最后兜底」「循环结束后统一提交」），其适用范围 SHALL 限定为 `reviewExecutor = "subagent"` 时；`reviewExecutor = "main"`（默认，含未配置）时 SHALL 以本 Requirement 为准。两条路径的分歧点以本 Requirement 为权威。

**执行者解析**：`@lyx-review-plan` / `@lyx-review-code` SHALL 读取 `~/.codex/lyx/config.toml` 的 `[codexHost] reviewExecutor`（未配置、空白或非法取值等价 `"main"`）决定本轮审查的执行者。审查范围判定、基线锚定、未跟踪清单采集、Critical / Warning / Info 分级输出、`openspec validate` 这些与执行者无关的规则 SHALL 在两条路径下保持一致。

**main 路径（默认）**：

- 主 agent SHALL 在当前会话直接执行审查，SHALL NOT spawn 子代理、SHALL NOT 读取 `reviewModel` / `reviewReasoningEffort`、SHALL NOT 产生 `[回退]` 标记。
- 主 agent SHALL 直接读取审查对象（review-plan 为 change 产物与全部 delta spec；review-code 为审查范围对应的 git diff 与未跟踪清单），产出 Critical / Warning / Info 分级发现。
- SHALL NOT 存在"审查发现 vs 主会话裁决"两个主体：主 agent 的发现即最终裁决，SHALL NOT 适用逐条裁决、驳回硬线、熔断、审查对象类型持续系统性误判这些为双主体仲裁设计的条件。
- 发现 Critical 时主 agent SHALL 直接修复，修复后 SHALL 再自查一轮确认清零；自审循环 SHALL 最多 2 轮，达到上限仍非清零时 SHALL 停止并转人工。
- review-plan 场景每轮修复后 SHALL 运行 `openspec validate --changes <change-name>`；SHALL NOT 运行测试 / 类型检查 / 构建——慢验证统一由 `archive-verification-gate` 在归档前执行一次。
- 清零后 SHALL 按既有「循环结束后统一提交」规则提交一次；`--no-commit` 时跳过。

**subagent 路径**：

- 主会话 SHALL spawn 1 个审查 subagent（非 fork，只携带 TASK），模型按 `reviewModel`、非空推理档按 `reviewReasoningEffort` 传入；TASK SHALL 指示读取该 change 目录下 `context.md`。
- 首轮之后 SHALL 优先以 `send_input` 复用同一子代理；复用失败（会话丢失、`send_input` 或 `resume_agent` 报错）SHALL 回退为重新 spawn 全新子代理，并按增量语义携带上一轮全部 Critical 逐字原文与路径清单。
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
- **THEN** 主会话以 `send_input` 复用首轮子代理，携带修复说明与上轮 Critical 原文；复用失败才回退重新 spawn

#### Scenario: spawn 不可用时回退 main 路径
- **WHEN** 配置 `reviewExecutor = "subagent"` 但宿主不支持 spawn 或首次 spawn 失败
- **THEN** 命令回退主 agent 直接审查并输出 `[回退] subagent 不可用: <原始报错>`，流程不中断

