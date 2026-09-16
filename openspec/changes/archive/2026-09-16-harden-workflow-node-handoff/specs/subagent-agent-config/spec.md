## MODIFIED Requirements

### Requirement: 模型经"模板指示 + 宿主能力"落实，subagent 不可用时回退

模型指定 SHALL 以模板内明确的模型指示落实（模板写明各 subagent 的模型取哪个配置字段、未配置用当前会话模型），由运行环境的宿主 spawn 能力执行；模板 SHALL NOT 依赖任何 shell 层模型参数。**未配置（留空）**时 SHALL 回退为继承当前会话模型，SHALL NOT 阻断安装或审查流程。**agent 模型需额外配置**：配置的模型能否 spawn 由运行环境实际能力决定，SHALL NOT 依赖任何硬编码清单或 `/models` 结果预判；运行期判定以宿主 spawn 报错为准。spawn 失败报错原文含 `Unknown model` / `Available models: ...` 时 SHALL 如实展示，提示"该模型当前不支持 spawn，请改用报错中 Available models 列表内的模型"。运行环境无 subagent 能力或初始 spawn 失败 SHALL 按回退口径回退当前会话直接执行，并输出**显式状态标记** `[回退] subagent 不可用: <原始报错>` 作为回退事实的唯一宣告——回退 SHALL NOT 以"已回退，原因：subagent 不可用"以外的自然语言描述代替，SHALL NOT 在回退后以"审查/实施已完成"之类结论冒充真实执行；该回退 SHALL NOT 视为流程失败。模板运行时读取 `~/.ly/config.toml` 失败（缺文件/解析错误）SHALL 视为"配置状态未知"：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。

**推理档经同一条通道落实**：模板 SHALL 读取与各 subagent 模型字段一一对应的推理档字段（`reviewReasoningEffort`/`reviewReasoningEffortB`/`codingReasoningEffort`），该字段非空时 SHALL 把其值作为宿主 spawn 的推理档参数（`reasoning_effort`）随模型一并传入；未配置或空白时 SHALL NOT 传该参数（保持宿主/模型默认档）。模板 SHALL NOT 内置任何"模型名 → 推理档"的硬编码映射，也 SHALL NOT 依赖任何 shell 层参数。推理档取值本身 SHALL NOT 做枚举强校验；该参数被宿主/上游拒绝时 SHALL 如实展示报错原文，并按本 Requirement 既有的 spawn 失败口径处理，SHALL NOT 归入"配置无效"分支。

#### Change: 回退口径补充显式状态标记 `[回退] subagent 不可用: <原始报错>`，禁止回退后以自然语言结论冒充真实执行结果。

#### Scenario: 宿主无 subagent 能力
- **WHEN** 当前 codex 环境不提供 subagent spawn 能力，用户运行 `@lyx-review-plan`
- **THEN** 提示"当前环境无 subagent 能力，已回退为当前会话直接审查"，回退事实以 `[回退] subagent 不可用: <原始报错>` 标记呈现，审查流程以当前会话继续执行

#### Scenario: 初始 spawn 失败（模型不受支持或被拒）
- **WHEN** 模型配置合法但宿主初始 spawn 失败（如报错原文含 `Unknown model ... Available models: ...`）
- **THEN** 如实展示报错原文并提示改用报错中 Available models 列表内模型或当前会话模型；按回退口径回退为当前会话直接执行，输出 `[回退] subagent 不可用: <原始报错>` 标记，不作为流程失败


#### Scenario: 配置了任意模型（含清单外或自定义输入）
- **WHEN** 用户 `[codexHost] reviewModel = "glm-5.3-flash"`（不在任何内置/维护清单内，或经向导自定义输入写入）
- **THEN** 作为审查 agent A 的模型指定 spawn，是否可用由宿主实际报错判定，SHALL NOT 因不在清单而被预判"配置无效"


#### Scenario: 模板运行时无法读取配置
- **WHEN** 审查/实施子代理 spawn 前读取 `~/.ly/config.toml` 失败（缺文件或解析错误）
- **THEN** 明确提示"无法读取配置，请运行 `lycx doctor` 检查"，按"配置状态未知"处理，SHALL NOT 按"未配置"静默继承回退


#### Scenario: 配置了推理档时随 spawn 传入
- **WHEN** 用户 `[codexHost]` 同时配置 `reviewModel = "glm-5.3-flash"` 与 `reviewReasoningEffort = "low"`，用户运行 `@lyx-review-plan`
- **THEN** 审查 agent A 的 spawn 指示读取该字段并把 `reasoning_effort: "low"` 随模型一并传入，SHALL NOT 因模板未写死该模型而忽略该字段


#### Scenario: 未配置推理档时不传该参数
- **WHEN** 用户未配置 `reviewReasoningEffort`，用户运行 `@lyx-review-plan`
- **THEN** 审查 agent A 的 spawn 不传推理档参数，由宿主/模型使用默认档，SHALL NOT 传空值或占位值


#### Scenario: 推理档被宿主或上游拒绝
- **WHEN** 配置的推理档取值不被宿主或上游接受（如报错原文含不受支持的档位说明）
- **THEN** 如实展示报错原文并报告该 agent 失败原因，按既有 spawn 失败口径处理（单一 agent 失败且另一 agent 结论完整时以完整一方继续并如实报告降级），SHALL NOT 把该字段预判为"配置无效"或在未实测前拦截
