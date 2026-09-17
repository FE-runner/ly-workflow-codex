---
name: lyx-review-plan
description: '读取 OpenSpec change 的 proposal/design/tasks，按 [codexHost] reviewExecutor 决定审查主体（main = 主 agent 直接审查；subagent = spawn 审查 subagent），分级审查方案合理性，审查-修复循环直到 Critical 清零或触发终止条件'
argument-hint: '[<change-name>] [--no-commit]'
---

<!-- 单审查 subagent 执行约定（spawn 协议、任务构造、主会话裁决与驳回硬线）内联于本文件，无外部 shell 调用契约；
     模型指定经"模板指示 + 宿主能力"落实，见"步骤 3"与模板变量说明 -->

# Review Plan - 方案审查

> 调用方式：`@lyx-review-plan` mention 后跟随的自然语言即参数（如 `@lyx-review-plan` 带需求描述/选项）；无参数时直接 `@lyx-review-plan`。

审查当前 OpenSpec change 的方案是否合理，聚焦遗漏边界、范围不清晰、风险点——不是逐行代码风格。输出 Critical/Warning/Info 分级结果（与 `@lyx-review-code` 一致）。**审查主体由 `~/.codex/lyx/config.toml` 的 `[codexHost] reviewExecutor` 决定**（未配置、空白或非法取值等价 `"main"`）：

- **`"main"`（默认）**：主 agent 在当前会话直接审查——不 spawn 子代理、不读取 `reviewModel` / `reviewReasoningEffort`、不产生 `[回退]` 标记。主 agent 的发现即最终裁决，**不适用**逐条裁决、驳回硬线、熔断、审查对象类型持续系统性误判这些为双主体仲裁设计的条件；发现 Critical 时直接修复该 change 的 artifact，修复后自查一轮确认清零，自审循环最多 2 轮（超过则停止转人工）。
- **`"subagent"`**：进入既有单审查 subagent 流程（下方步骤），首轮之后 SHALL 优先以 `send_input` 复用同一子代理；复用失败才回退为重新 spawn 全新子代理（按增量语义携带上一轮全部 Critical 逐字原文与路径清单）。逐条裁决、驳回硬线、熔断、轮数上限等既有规则保持适用。

与执行者无关的规则（目标 change 解析、工件路径枚举、基线 spec 引用检测、分级输出、每轮 `openspec validate`）在两条路径下保持一致。

审查由 **1 个审查 subagent** 执行（subagent 多 Agent 模式）：子会话**非 fork spawn**、只携带本模板构造的 TASK（软上下文经该 change 目录下的 `context.md` 到达），任务中点名"只审该 change 的产物范围"；模型按 `codexHost.reviewModel` 指定，未配置或空白时继承当前会话模型；`reviewModelB`/`reviewReasoningEffortB` 为弃用字段，本命令不读取使用。SHALL NOT spawn 第二个审查 agent、SHALL NOT 实现"并行双审、交换结论、共识归并"环节——单 agent 的分级结论即本轮唯一审查发现来源，质量把关由当前会话逐条裁决与"驳回硬线"终止条件承担。Critical 修复由当前会话执行。

循环执行期间默认不提交；仅当循环以"正常清零"结束时，才对审查目标全部文件（该 change 的 artifact 与 delta spec，含编排方已暂存的产物与循环修复）统一提交一次（见步骤 5）。传入 `--no-commit` 时，连这次最终的统一提交也不做。

## 步骤

### 1. 解析目标 change

按优先级：

1. 若 `参数` 指定了 change 名称 → 使用该名称
2. 否则枚举 `openspec/changes/` 下的目录，**排除 `archive/` 目录及其内容**
3. 若恰好一个候选 → 直接使用
4. 若多个候选且未指定 → 直接询问用户选哪个
5. 若零个候选 → 询问用户要审查哪个 change，不要猜测

```bash
ls -d openspec/changes/*/ 2>/dev/null | grep -v '/archive/'
```

审查对象是目标 change 的 `propose:` commit（编排方 `@lyx-propose` 在生成方案后立即提交，提交信息 `propose: <change-name>`）。审查基线 SHALL 用 `git log --grep="^propose: <change-name>"` 取 HEAD 侧最近一期匹配 commit，审查范围 = 该 commit 差异（`git show <commit>`）+ 当前 `git diff HEAD` + 未跟踪文件清单（`??`）——修复在审查-修复循环内未提交时不丢失。不存在 `propose:` commit（零 commit 仓库、或尚未生成方案提交）时，退化为 `git diff HEAD` + 未跟踪清单组合。审查期间新产生的修复改动（循环内每轮修复未提交）始终计入审查范围，不在中途产生新 commit（提交只发生在正常清零后的统一提交，见步骤 5）。

**基线锚定**：首轮确定审查基线 commit 后 SHALL 固定该 SHA 作为本次命令执行的基线锚点，后续轮次的审查范围一律以 `git show <固定SHA>` + `git diff <固定SHA>` + 未跟踪清单计算，SHALL NOT 在循环期间重新执行 `git log --grep` 或重算 HEAD 作基线（除非基线 commit 因异常被回滚/丢失，此时才重新定位并如实报告）。循环期间发生任何中途提交（无论手滑或外部因素）SHALL 如实报告，并仍以固定基线重新计算 `git diff <固定SHA>` 说明该中途 commit 是否落在审查范围内（核对不等于替换基线），但不以此自动进入终止条件。

### 2. 枚举工件路径（仅首轮执行一次；不读取内容）

枚举该 change 目录下的 `proposal.md`、`design.md`、`tasks.md`（存在的部分即可，缺失的容错跳过，不报错）以及 `specs/**/*.md` 的全部 delta spec 文件路径（存在多份时全部枚举，不只取其中一份）。这一步只确定路径，不读取文件内容拼接成字符串——审查 subagent 具备自主读取文件的能力。

**基线 spec 引用检测**：检查每份 delta spec 文件是否有显式文字引用了基线 spec 中未被本次修改的既有 Requirement（例如"见……'某 Requirement 名'"这类指代，无论出现在 `## MODIFIED Requirements` 内还是外）。若有，额外把该基线能力对应的 `openspec/specs/<capability>/spec.md` 路径也纳入路径清单，并在 TASK 中说明该文件仅作审查上下文（用于核实引用是否准确），不属于修复对象。

### 3. spawn 单审查 subagent（首轮）

本关卡审查由 **1 个审查 subagent** 执行（subagent 多 Agent 模式，不再走独立子进程 shell 调用）。主会话按以下指示 spawn，由运行环境的宿主 spawn 能力落实：

**轮内纪律（主会话硬规则）**：

1. **同轮等待结果**：spawn 之后 SHALL 在本轮内等待（wait）子 agent 返回，收到结果先逐字转达（写入本轮执行日志）再判定；SHALL NOT 在 spawn 后结束本轮回合，留下"子 agent 已返回但主会话已退出、结果无人消费"的断链状态。
2. **禁止口头分发**：每一步 spawn / wait 都 SHALL 落到宿主的实际工具调用，SHALL NOT 仅以自然语言描述"已分发/将分发审查任务给 subagent"代替实际 spawn 调用；出现"我将 spawn…"类描述而没有对应工具调用时，该输出不视为分发动作，不得据此结束本轮或进入下一阶段。
3. **消费完即关闭**：子 agent 结果消费完毕（逐条裁决完成、不再需要该 agent）SHALL 关闭它；SHALL NOT 假设 subagent 跨用户回合存活。

1. **非 fork spawn**：审查 subagent SHALL 以**非 fork** 方式 spawn——子代理只携带 spawn 消息（TASK），SHALL NOT 携带父线程对话历史（宿主 V1 语义为 `fork_context: false` 默认值；V2 语义为 `fork_turns: none`）。仅当宿主不支持完全非 fork 而仅支持"最近 N 轮"fork 模式时，SHALL 取最小 N（或 0）近似非 fork 并在报告中如实说明；SHALL NOT 使用全量 fork。
2. **软上下文经 context.md 到达**：非 fork 意味着主会话讨论中的关键决策、取舍、已知边界等"软上下文"不再随会话历史自动到达审查 agent——TASK SHALL 指示审查 subagent 读取该 change 目录下的 `context.md`（`openspec/changes/<change-name>/context.md`）获取软上下文，SHALL NOT 在 TASK 中整段复制其内容。`context.md` 缺失（历史 change）时在报告中如实注明"context.md 缺失，软上下文不可用"后继续，SHALL NOT 凭空虚构上下文。
3. **agent 模型需额外配置（含推理档；spawn 前确认字段，不做清单强校验）**：审查 subagent 的模型 = `~/.codex/lyx/config.toml` 的 `[codexHost] reviewModel`；未配置或空白 → 继承当前会话模型。推理档 = `[codexHost] reviewReasoningEffort`；先 trim，trim 后为空 → 不传该参数，trim 后非空时把 trim 后的值作为宿主 spawn 的 `reasoning_effort` 随 `reviewModel` 一并传入。`reviewModelB`/`reviewReasoningEffortB` 为弃用字段，SHALL NOT 读取使用。模型能否 spawn 由运行环境实际能力决定，SHALL NOT 依赖任何硬编码清单或 `/models` 结果预判。spawn 前 SHALL 读取 `~/.codex/lyx/config.toml` 确认模型与推理档字段取值，读取失败（缺文件/解析错误）→ 视为**配置状态未知**：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。spawn 失败报错原文含 `Unknown model` 与 `Available models: ...` 时如实展示，提示"该模型当前不支持 spawn，请改用报错中 Available models 列表内的模型"；推理档被宿主/上游拒绝时同样如实展示报错原文并按既有 spawn 失败口径处理，SHALL NOT 把取值预判为"配置无效"。模型与推理档指定只写在模板指示里，SHALL NOT 依赖任何 shell 层模型参数（无 `-m`/`--model` 类指令），SHALL NOT 内置任何"模型名 → 推理档"的硬编码映射。**验证某模型是否可 spawn 的示例 prompt**：让 Codex 用该模型 spawn 一个子代理执行简单任务（如回复 ok），报错原文即判定依据。
4. **TASK 范围点名（只审 change 范围）**：审查 subagent 的任务点名"只审该 change 的下列产物"，SHALL NOT 超出点名范围作业。TASK 先指示读取 ROLE_FILE（`~/.codex/lyx/prompts/codex/plan-reviewer.md`，角色词内容不重写），再列出路径清单（步骤 2 枚举的 artifact + delta spec；若步骤 2 检测到基线 spec 引用，同时说明基线路径仅作审查上下文、不属于修复对象）。**首轮只传路径清单，不拼贴文件全文**——审查 subagent 具备自主读取文件的能力，需要实际内容时自行读取。

TASK 核心约束（写入审查 subagent 的任务）：
- 只审查该 change 目录下 artifact 之间的内在一致性和完整性（proposal vs design vs tasks vs spec 是否互相矛盾、是否有遗漏）
- 可做轻量代码库确认（确认 plan 列出的文件路径是否存在、grep 硬编码数字/常量是否遗漏关联文件），但不深入读源码实现、不做逐行代码审查——后者是 apply 后 code-review 的职责
- 不把'代码库尚未实现该方案条目'当作 Critical（方案审查阶段代码库本来就没有实现，这是正常状态）

OUTPUT 约束（写入审查 subagent 的任务）：审查发现按严重度分级 Critical/Warning/Info，每条含位置/条目（含可解析的文件相对路径）、问题描述、建议。

**审查返回有效性判定**：审查 subagent 的返回 SHALL 包含可识别的分级结论（Critical/Warning/Info 计数与条目）或明确的"无发现"声明。空响应、内容疑似截断（token 截断、输出中断）、或仅有过程描述而无结论的返回，SHALL 视为**无效返回**，按"审查调用失败"的运行期失败处理——如实报告原始返回内容与判定理由，SHALL NOT 误判为"本轮无 Critical"或视为清零通过。

**审查调用失败（区分三类）**：

- **运行期失败**（spawn 后等待超时/卡死、返回内容格式不符或不含有效结论（含空响应与疑似截断，见"审查返回有效性判定"）、审查 subagent 调用失败且无法按回退口径继续、回退不可行或回退后仍失败）→ 视为**独立终止条件**，如实报告原因（含已取得的部分结论，如有）并停止循环，**不得**把失败或超时等同于"本轮无 Critical"或视为清零通过，SHALL NOT 归入"驳回硬线"（调用失败非裁决分歧）。
- **环境级不可用**（配置合法时宿主无 subagent 能力、初始 spawn 不可用）→ 按回退口径处理：回退为当前会话直接执行审查，并输出**显式状态标记** `[回退] subagent 不可用: <原始报错>` 作为回退事实的唯一宣告——SHALL NOT 以其他自然语言描述代替该标记，SHALL NOT 在回退后以"审查已完成"之类结论冒充真实执行；该回退 SHALL NOT 视为流程失败中断整体编排。
- **配置读取失败**（缺文件或解析错误）→ 视为"配置状态未知"，见第 3 条，明确提示运行 `lycx doctor` 检查。

本轮结束后，无论是否有 Critical，都先生成"本轮执行日志"（见"逐轮执行日志"一节），再判定：

若本轮 Critical 数为 0 → 跳到步骤 5 输出报告，结束（不进入循环）。
若本轮 Critical > 0 → 进入步骤 4 循环体。

### 4. 审查-修复循环

对本轮全部 Critical，逐条执行：

**4.1 当前会话先裁决该 Critical**（同 `@lyx-review-code`）

- **认可**：判断问题确实存在，进入 4.2 修复。
- **不认可**：判断为误报、对上下文理解有误、或建议本身有问题，则不修改任何文件，但必须在本轮报告里写明**可核验依据**——指明具体文件路径/行号、命令输出、既有条目所在位置等可被第三方独立核验的证据，SHALL NOT 仅以"误报""不影响"之类泛泛措辞打发。**缺乏可核验依据的不认可视为未完成裁决**：当前会话 SHALL 补足依据后重新裁决，不能补足的按认可处理并修复。SHALL NOT 沉默跳过或悄悄忽略任何一条 Critical。

**4.2 修复（仅针对认可的 Critical）**

修改该 change 的 `proposal.md`/`design.md`/`tasks.md`/`specs/**/*.md`（该 change 目录下的 delta spec 文件），修复范围为"Critical 直接指向的条目" + "修复它所必需的直接依赖条目"（例如"proposal 与 tasks 范围不一致"这类问题往往需要同步改动多处才能真正修好；"spec 未覆盖 proposal 的 What Changes"这类问题的修复方式就是编辑对应 delta spec 文件）；不得借机改动无关内容。若改动涉及必需依赖条目，本轮报告必须逐项说明关联性。

**4.3 本轮验证**

修复完成后运行一次 `openspec validate --changes <change-name>`。验证失败 → 立即停止循环，不再进行下一轮修复，报告本轮改动的文件清单及 `openspec validate` 的失败信息，说明需要人工介入。

**4.4 记录本轮改动文件清单（不提交）**

验证通过后，把本轮实际改动的 artifact/delta spec 文件相对路径清单写入本轮报告——供 4.5 步构造下一轮增量 TASK 直接复用，不得靠"运行时的 git 状态"反推（后续轮次还会继续修改文件，仅凭某个时间点的 git 状态无法可靠还原"本轮具体改了什么"）。本轮不执行任何 git commit——提交只发生在循环以正常清零结束之后（见步骤 5）。

**4.5 自动触发下一轮审查（增量传递；第 2 轮起重新 spawn）**

从第 2 轮起，TASK SHALL NOT 重新传整份 proposal/design/tasks/specs 内容；改为仅包含：

1. 上一轮审查 subagent 报告的全部 Critical 原文（逐字，不经改写，包含被判定"不认可"的条目——非 fork 的审查 agent 无任何历史记忆，上一轮原文是判断"问题是否已解决"的唯一依据）。
2. 路径清单，必须覆盖"本轮实际改动的 artifact/delta spec 文件"（4.4 记录的清单）∪"上一轮全部 Critical 各自指向的 artifact/delta spec 文件"（即使未被修改）。若上一轮某条 Critical 指向的文件已被删除或重命名，路径清单改用新路径（若有）并说明状态变化。
3. 该 change 目录下 `context.md` 的路径引用——非 fork spawn 每轮都是全新子代理、无任何历史记忆，缺少该引用即彻底失去软上下文通道，SHALL NOT 因为 `context.md` 不在本轮改动/上一轮 Critical 指向的文件集合内而省略；`context.md` 仍只作背景引用，不计入上述"路径清单"所指的修复对象范围。

路径清单之外的文件不重新整段传入。若某条上一轮 Critical 的位置字段缺失可解析路径，命令保守处理：将该 change 目录下全部 artifact/delta spec 路径纳入下一轮路径清单，并在报告中说明该情况（不得静默丢弃该 Critical）。

**第 2 轮起优先复用同一审查 subagent（`send_input`）**：实测宿主支持在子代理首次任务完成后再次唤醒它且其保留自身会话上下文，因此"回合结束即失去访问能力"SHALL NOT 再作为必须重新 spawn 的理由。主会话 SHALL 先以 `send_input` 向首轮那个子代理发送增量内容（修复说明 + 上一轮全部 Critical 逐字原文 + 路径清单 + 该 change 目录下 `context.md` 路径引用），由它判断"问题是否已解决"。**复用失败时**（子代理会话丢失、`send_input` 报错、`resume_agent` 不可用）SHALL 回退为重新 spawn 一个全新审查 subagent（**非 fork，只携带 TASK**），TASK 按同一增量语义构造，并在本轮报告中说明复用失败原因。回到步骤 3 的执行方式，不要求用户手动重新触发命令。生成本轮执行日志后再判定 Critical 是否清零。

### 循环终止条件（任一命中即停止，转步骤 5）

复用 `@lyx-review-code` 的同一套规则，全局轮数上限同样默认 5 轮（清零优先于轮数上限：本轮先判 Critical 是否清零，仅非清零时才检查是否达到 5 轮）：

1. **正常清零**：某一轮审查 Critical 数为 0
2. **熔断**：同一个 Critical（以"文件路径 + 问题类别 + 定位锚点（artifact 内的具体条目/章节）"三者共同判定为同一问题）在相邻两轮审查中都被判定为存在，且上一轮当前会话对它是"认可"状态。若上一轮当前会话对它的判断是"不认可"（未修复），相邻两轮再次出现 SHALL NOT 走熔断而走"驳回硬线"（条件 5）
3. **无法安全自动修复**：需要产品/业务决策、依赖当前会话不具备的信息，或当前会话判断信息不足——不得进行猜测性修改
4. **修复后验证失败**：见 4.3（`openspec validate` 未通过）
5. **驳回硬线**（二选一命中即触发）：（a）**逐条口径**——当前会话上一轮判断"不认可"（附可核验依据，未修改），下一轮审查该 Critical 仍被提出，且当前会话依然不认可；（b）**整轮口径**——连续 2 轮审查中，当前会话对当轮**全部** Critical 均不认可（零认可、零修复，即使各轮 Critical 的判同键互不相同）——整轮口径防的是"当前会话系统性驳回一切发现"的裁决失效。命中任一口径立即停止循环，报告并列展示审查 subagent 各轮原始发现与当前会话各轮可核验依据，判定需要人工介入，不得继续自动修复或自动放弃该问题
6. **审查对象类型持续系统性误判**：连续 3 轮（含本轮）审查中，每一轮的全部 Critical 都被当前会话判定为同一大类系统性误判——即审查 subagent 反复以"该轮 Critical 所依据的判断类别不属于方案审查范畴"为由被判定不认可（例如连续 3 轮的 Critical 均以"代码库尚未实现该方案条目"作为理由），不要求这 3 轮之间 Critical 的文件/类别/锚点相互匹配，只要求"判定为不认可的理由类别"在这 3 轮中一致
7. **达到全局轮数上限**（5 轮，独立于上面 1-6 的判定）

触发条件 2-6（或达到全局轮数上限）时，立即停止循环，不执行任何提交（改动留在工作区），报告中必须明确指出触发的具体条件、涉及的问题（文件/类别/章节/判定依据），并说明需要人工介入。"驳回硬线"要求并列展示审查 subagent 每一轮的原始发现与当前会话每一轮的可核验依据；"审查对象类型持续系统性误判"同样要求并列展示，但展示连续 3 轮（而不是 2 轮）的原始发现与可核验依据。循环期间的 Warning/Info 不参与终止判定，只在最终报告列出**最后一轮**结果。

**循环期间不提交**：每一轮修复完成、验证通过后，SHALL NOT 立即执行 git commit——改动保持在当前状态，统一提交仅发生在正常清零后（见步骤 5）；`--no-commit` 传入时连清零后的统一提交也不执行。

**终止报告末尾附下一步可用命令指引**：以终止条件 2-6 或轮数上限结束时，终止报告的末尾 SHALL 附"下一步可用命令指引"段落，供用户在"断在明确节点、人工自行触发下一步"口径下续接，例如：

- 可用 `@lyx-review-plan <change-name>` 重跑审查（修复后重新进入循环）；
- `@lyx-apply <change-name>` 暂不实施（按当前终止原因说明）；
- 改动保留在工作区未提交，可先 `git diff` 查看。

### 逐轮执行日志

每一轮审查 subagent 派发完成后（包括首轮 Critical 为 0、直接结束的情况），都要在报告中包含一个独立区块，逐字展示该轮审查 subagent 返回的原始 Critical/Warning/Info 内容（不经概括、改写或合并），与当前会话对该轮每条 Critical 的裁决（认可 / 不认可及可核验依据）并排列出（若该轮无 Critical，只展示原文）。这个区块在该轮审查返回之后即可呈现，不是流式展示。这是给需要核实细节的人看的补充材料；最终报告的主体是人话摘要（见步骤 5），二者并存，不互相替代。

**硬性约束（逐字执行）**：该区块中的 Warning/Info 与 Critical 同样必须逐字完整贴出，**禁止用省略号（"…"、"（同前）"等）压缩**；**清零轮（无 Critical）的判定仍需写明依据**——对照前一轮各 Critical 的修复/确认情况说明"认可清零"的理由，不得仅以"无 Critical，正常清零"一句带过。

### 5. 输出报告

**正常清零结束：**

先执行统一提交：先 `git add` 该 change 目录下的 `proposal.md`/`design.md`/`tasks.md` 及全部 delta spec 文件（审查目标全部文件——编排方（`@lyx-propose`）已暂存的产物与循环期间修复的改动一并暂存；若产物此前已在暂存区则保持，修复改动由本次 `git add` 覆盖进 index），再执行一次统一 commit（仅暂存并提交这些文件，不做范围外的 `git add`），提交信息形如 `fix: review-plan feedback (经 N 轮修复) - <change-name>`。**不存在"循环开始前已脏文件的隔离跳过"**——该 change 目录下的 artifact 与 delta spec 是合法审查对象，产物与修复是同一个待提交单元，全部一并提交。若循环全程没有任何 Critical 被认可修复（从未发生实际改动），不创建空 commit。若统一提交本身执行失败，在报告中如实说明该失败，视为"清零但提交失败"的独立结果——不重新进入循环（已经清零），但要指出还需要人工手动完成这次提交。若传入 `--no-commit`，跳过这次统一提交，修复结果留给调用方或用户自行处理。

```
📋 方案审查：<change-name>

## Critical（必须修复）
（本次已自动修复 N 个 Critical，或为空——若曾发现并修复过，必须写明"本次已自动修复 N 个 Critical"，不得用"未发现问题"掩盖。每条用非技术人员能看懂的人话概括问题和已做的改动）

## Warning（建议修复，最后一轮结果）
1. [proposal.md / design.md / tasks.md / specs/**/*.md] — <问题描述，人话>
   建议: <具体建议>

## Info（供参考，最后一轮结果）
1. [proposal.md / design.md / tasks.md / specs/**/*.md] — <观察/建议，人话>

## 逐轮执行日志
（见"逐轮执行日志"一节，按轮次顺序列出每轮审查 subagent 原文 + 当前会话裁决，作为补充材料）

---
总轮次: [轮数]
总计（最后一轮）: [N] Critical, [M] Warning, [K] Info
提交: [已提交 <commit信息> / 未提交（--no-commit） / 无可提交内容 / 提交失败：<原始错误>]
```

**熔断/驳回硬线/无法安全修复/验证失败/审查调用失败/达到轮数上限/审查对象类型持续系统性误判结束：**

不执行任何提交，改动留在工作区。

```
📋 方案审查：<change-name> — 循环终止：<触发条件>

## 终止详情
<用人话说清楚发现了什么问题、卡在哪、涉及哪些文件/章节>

（"驳回硬线"额外展示，展示 2 轮）
### 审查 subagent 各轮原始发现
第 N 轮：<原文>
### 当前会话各轮可核验依据
第 N 轮：<依据>

（"审查对象类型持续系统性误判"额外展示，展示连续 3 轮）
### 审查 subagent 各轮原始发现
第 N 轮：<原文>
第 N+1 轮：<原文>
第 N+2 轮：<原文>
### 当前会话各轮可核验依据
第 N 轮：<依据>
第 N+1 轮：<依据>
第 N+2 轮：<依据>

## 逐轮执行日志
（同上）

## 需要人工介入
<人话说明，改动都留在工作区未提交，可用 git diff 查看>

## 下一步可用命令指引
- 可用 `@lyx-review-plan <change-name>` 重跑审查
- `@lyx-apply <change-name>` 暂不实施（按上述终止原因）
- 改动保留在工作区未提交，可先 `git diff` 查看

---
总轮次: [轮数]
本次未提交任何改动
```

如从未出现任何 Critical/Warning/Info，明确说明"方案审查未发现问题"，不要保持沉默。
