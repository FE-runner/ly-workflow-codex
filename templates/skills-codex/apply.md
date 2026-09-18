---
name: lyx-apply
description: '按 [codexHost] codingExecutor 决定实施主体：main（默认）= 主 agent 直接实施；subagent = spawn coding subagent（非 fork spawn，只携带 TASK；经 change 目录 context.md 获取软上下文 + 只实施 change 范围）。两条路径均逐任务实施+验证+勾选，主会话确认后回写 context.md 并按共用隔离协议统一提交 apply 阶段 commit（CC 前缀 + Change-Stage: apply trailer）；失败原样呈报转人工（不重试不兜底）'
argument-hint: '[<change-name>]'
---

# Apply

> 调用方式：`@lyx-apply` mention 后跟随的自然语言即参数（如 `@lyx-apply` 带需求描述/选项）；无参数时直接 `@lyx-apply`。

实施主体由 `~/.codex/lyx/config.toml` 的 `[codexHost] codingExecutor` 决定（未配置、空白或非法取值等价 `"main"`）：

- **`"main"`（默认）**：主 agent SHALL 在当前会话直接实施——读取该 change 的 `tasks.md` 逐任务实施 + 验证 + 勾选；SHALL NOT spawn 子代理、SHALL NOT 读取 `codingModel` / `codingReasoningEffort`、SHALL NOT 产生 `[回退]` 标记。
- **`"subagent"`**：主会话 spawn 一个 coding subagent，**非 fork spawn**（只携带 TASK，软上下文经该 change 目录下的 `context.md` 到达）并在任务中点名"只实施 change 范围"；模型按 `codingModel`、非空推理档按 `codingReasoningEffort` 传入。coding subagent 读取 tasks.md 逐任务实施 + 验证 + 勾选后，将改动与结果**回传主会话，不自行 commit**。

两条路径共同遵守：主会话确认后回写 `context.md`（实施决策）并按共用 index 隔离协议统一提交 apply 阶段 commit（message 为 CC 前缀 + `Change-Stage: apply` + `Change-Name: <change-name>` trailer），作为 `@lyx-review-code` 的审查对象。失败区分两阶段：**环境级不可用**（仅 `subagent` 路径可能发生——宿主无 subagent 能力、初始 spawn 失败）按回退口径回退主 agent 直接实施，输出 `[回退] subagent 不可用: <原始报错>`，SHALL NOT 视为业务失败；**实施中/验证失败** SHALL 原样呈报转人工，不自动重试、不自动兜底。隔离 worktree 的询问/新建统一收敛到 `@lyx-propose` 入口，apply 不触发任何 worktree 询问、不做隔离检测——直接在当前工作目录实施。

## 步骤

### 1. 确定目标 change 名

按固定优先级解析：

1. `参数` 中显式且合法的 change 名。
2. `openspec/changes/` 下唯一未归档的 change。
3. 无法唯一确定 → 直接询问用户。

任一步骤无法唯一确定时，不得继续执行后续步骤。

### 2. 按 codingExecutor 实施 tasks

读取 `~/.codex/lyx/config.toml` 的 `[codexHost] codingExecutor`（缺文件/解析错误 → 明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承）。

**`"main"`（默认，含未配置）**：主 agent 在当前会话直接实施，跳过下方的 spawn 段，直接执行「实施规范」。

**`"subagent"`**：按下方指示 spawn coding subagent。模型 = `codingModel`（未配置或空白 → 继承当前会话模型）；推理档 = `codingReasoningEffort`（trim 后非空才随 spawn 传入）。模型与推理档只写在任务指示里，SHALL NOT 依赖 shell 层模型参数，SHALL NOT 内置"模型名 → 推理档"的硬编码映射。

主会话 spawn 一个 coding subagent（由运行环境的宿主 spawn 能力落实），并给它下述任务指示：

**轮内纪律（主会话硬规则）**：

1. **同轮等待结果**：spawn 之后 SHALL 在本轮内等待（wait）coding subagent 返回，收到结果先逐字转达再确认；SHALL NOT 在 spawn 后结束本轮回合，留下"子 agent 已返回但主会话已退出、结果无人消费"的断链状态。
2. **禁止口头分发**：spawn / wait 都 SHALL 落到宿主的实际工具调用，SHALL NOT 仅以自然语言描述"已分发/将分发实施任务给 coding subagent"代替实际 spawn 与等待；出现"我将 spawn…"类描述而没有对应工具调用时，该输出不视为分发动作，不得据此结束本轮或进入下一步。
3. **消费完即关闭**：coding subagent 结果消费完毕（主会话确认与提交决策完成）SHALL 关闭它，SHALL NOT 假设 subagent 跨用户回合存活。

**spawn 前记录工作区快照**：spawn coding subagent 前 SHALL 执行一次 `git status --porcelain` 并记录快照（覆盖工作区/暂存区全部现状，含与本次无关的既存改动），供步骤 3 的文件清单核对使用。

1. **模型与推理档** = `~/.codex/lyx/config.toml` 的 `[codexHost] codingModel` 与 `codingReasoningEffort`；模型未配置或空白 → 继承当前会话模型，推理档先 trim，trim 后非空时把 trim 后的值作为宿主 spawn 的 `reasoning_effort` 随 `codingModel` 一并传入，trim 后为空 → 不传该参数。模型与推理档指定只写在任务指示里，由宿主 spawn 能力执行，SHALL NOT 依赖任何 shell 层模型参数，SHALL NOT 内置任何"模型名 → 推理档"的硬编码映射。
2. **agent 模型需额外配置（含推理档；spawn 前确认字段，不做清单强校验）**：coding 模型能否 spawn 由运行环境实际能力决定，SHALL NOT 依赖任何硬编码清单或 `/models` 结果预判。spawn 前 SHALL 读取 `~/.codex/lyx/config.toml` 确认 `codingModel` 与 `codingReasoningEffort` 取值；读取失败（缺文件/解析错误）→ 视为**配置状态未知**：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。模型留空 → 回退继承当前会话模型；推理档 trim 后为空 → 不传 `reasoning_effort`。spawn 失败报错原文含 `Unknown model` 与 `Available models: ...` 时如实展示，提示"该模型当前不支持 spawn，请改用报错中 Available models 列表内的模型"；推理档被宿主/上游拒绝时同样如实展示报错原文并按既有 spawn 失败口径处理，SHALL NOT 把取值预判为"配置无效"——能否 spawn 以宿主实际报错为准，SHALL NOT 以配置猜测绕过。**验证某模型是否可 spawn 的示例 prompt**：让 Codex 用该模型 spawn 一个子代理执行简单任务（如回复 ok），报错原文即判定依据。
3. **非 fork spawn + 软上下文经 context.md 到达**：coding subagent SHALL 以**非 fork** 方式 spawn——子代理只携带 TASK，SHALL NOT 携带父线程对话历史（宿主 V1 语义为 `fork_context: false` 默认值；V2 语义为 `fork_turns: none`；仅当宿主仅支持"最近 N 轮"fork 模式时取最小 N 近似并如实说明，SHALL NOT 全量 fork）。关键决策、取舍、已知边界等"软上下文"经 TASK 指示读取该 change 目录下的 `context.md`（`openspec/changes/<change-name>/context.md`）到达实施模型，SHALL NOT 在 TASK 中整段复制其内容；`context.md` 缺失时如实注明后继续，SHALL NOT 凭空虚构上下文。
4. **范围点名（只实施 change 范围）**：任务点名"只实施 change 范围"——读取 `openspec/changes/<change-name>/tasks.md`，按需读取同目录 `proposal.md`/`design.md`/`context.md` 及任务引用的上下文文件，理解现有模式；SHALL NOT 改动范围外文件。
5. **实施规范**（coding subagent 内部执行）：
   - 自顶向下逐任务实施，每完成一个任务立即验证：只修改任务列出的文件，不添加任务之外的功能/重构/注释；按 tasks.md 指定的验证方式运行验证（如 typecheck/build/test），失败则修复后重试，每个任务最多 3 次修复尝试；验证通过后，把 tasks.md 中对应条目从 `- [ ]` 改为 `- [x]`，继续下一个任务。
   - 不询问——任务描述有歧义时按最简方案处理，直接落地并在回传结果中说明选择。
6. **回传不 commit**：coding subagent SHALL NOT 自行执行任何 git commit——实施完成后，将实际改动的文件清单、验证结果与逐任务完成情况回传主会话。

**环境级不可用回退**：若当前环境无 subagent spawn 能力或初始 spawn 失败，主会话回退为当前会话直接实施（实施规范同上），并输出**显式状态标记** `[回退] subagent 不可用: <原始报错>` 作为回退事实的唯一宣告——SHALL NOT 以其他自然语言描述代替该标记，SHALL NOT 在回退后以"实施已完成"之类结论冒充真实执行；该回退 SHALL NOT 视为业务失败。

### 3. 主会话确认并统一提交（全部任务完成时执行）

1. 主会话收到回传的改动与结果后确认（subagent 路径以 coding subagent 回传清单为对照；**环境级不可用回退的自实施路径无 subagent 回传清单，以主会话自己记录的实施改动文件清单——逐项列出并展示给用户——充当回传清单，快照与核对规则一致**）。确认前先识别 **partial apply**：残留判据限定为"改动路径落在本次实施目标文件集合内"——若步骤 2 快照中已存在的 dirty 路径 ∩ 本次实施目标文件集合（tasks.md 指向的 `templates/`、`src/` 等路径）≠ ∅，或该 change 目录下 tasks.md 已出现勾选但对应改动未提交，SHALL 判定 partial apply 并停止转人工（与本次实施无关的既存改动明确不算残留，交由快照差集与重叠规则处理）。随后确认时再执行一次 `git status --porcelain`，与步骤 2 spawn 前记录的快照**比对**：比对只针对快照之后新增/变化的路径——既存改动（快照中已存在的路径且状态未变）不参与比对、不纳入本次提交范围（保持"预存改动未被提交"口径，`git add` 范围仅限本次实际改动的文件，并在报告中说明"预存改动未被提交"）。仅当**快照之后出现回传清单之外的改动**、或**回传清单中的文件实际未变动**时才判定不一致：不一致 SHALL 停止并逐项列出差异路径报告，不执行 commit、不照单全收，转人工确认。**快照前已 dirty 的路径出现在回传清单**（与本次改动重叠，无法机械区分同一文件内既存与本轮的 hunk）→ SHALL 停止转人工，不得猜测性提交，报告中 SHALL 回指 propose 步骤 1 的既存改动处置选择，说明该路径下既存改动与实施目标文件重叠会使 apply 停止。
2. 确认一致后，**回写 context.md（实施软上下文）**：把实施阶段新产生的关键决策（实现取舍、对方案的偏差及理由、发现的坑）更新进 `openspec/changes/<change-name>/context.md`——增量追加或修订，SHALL NOT 重写或删除 propose 阶段已沉淀的内容（确已过时的条目标注"已过时"保留痕迹）；实施无新增软上下文时保持原样不强行凑写。`context.md` 缺失（历史 change）时跳过回写并在报告中注明。**回写了 context.md 时 SHALL 把它并入"本次待提交文件清单"**（清单 = coding subagent 回传清单 ∪ 回写后的 `context.md`；自实施路径同理——主会话记录的实施改动清单 ∪ `context.md`），后续暂存与提交校验均以更新后的清单为准。
3. 确认一致后提交，按共用 index 隔离协议执行（目标范围为本次待提交文件清单）：
   - 先 `git add -- <本次待提交文件清单>`（不用 `git add -A`）。
   - **步骤 2 快照中已存在 staged 内容时**：用 `git commit --only -F .git/COMMIT_EDITMSG -- <本次待提交文件清单>` 仅提交该清单（**`-F` 必须放在 `--` 之前**；清单含未跟踪新文件时**必须先 `git add`**，否则 `--only` 报 `pathspec ... did not match any file(s) known to git`；SHALL NOT 用全量 `git commit` 吞并 index 既存 staged 内容），或先 unstage 非本次文件、提交后恢复原暂存状态；范围外文件保留原暂存状态。
   - 同一文件内既存 staged hunk 与本次 hunk 混合、无法机械分离时 → 无法安全隔离，SHALL 停止转人工，不猜测性提交。
   - 快照中无 staged 内容时：直接 `git commit`。
   - message 采用 Conventional Commits 前缀 + 正文 + trailer 结构：先按 `@lyx-commit` 规范写入 `.git/COMMIT_EDITMSG`，首行 `<cc-type>(<scope>): <subject>`（type 由主会话按本次实际改动判断，如 `feat` / `fix` / `refactor`；SHALL NOT 固定为某个 type），正文至少包含 `- 动机：` / `- 改动：` / `- 影响：`，末尾带 `Change-Stage: apply` 与 `Change-Name: <change-name>` trailer。提交命令使用 `git commit -F .git/COMMIT_EDITMSG`。
   - 提交后 SHALL 以 `git show --name-only` 校验该 apply 阶段 commit 的文件集合严格等于本次待提交清单（含回写的 `context.md`，如适用），不相等 SHALL 如实报告并修复，不得带着多余文件进入 apply 阶段 commit。
4. apply 阶段 commit 即 `@lyx-review-code` 的审查对象（定位见 `@lyx-review-code` 的 trailer 优先规约）。
5. 无可提交内容（如 tasks 本身无产出、或改动已在审查循环中被提交）则跳过，不创建空 commit。
6. 若 `git commit` 失败，如实报告 Git 返回的原始错误，不重试不兜底。

### 失败处理（未全部完成时执行）

**实施中/验证失败**（coding subagent 报告任务未完成或验证失败）：主会话原样呈报失败详情转人工，不自动重试、不切回自实施、不 commit、不自动兜底。列出 tasks.md 中仍未勾选的条目，停止执行；改动可能已部分落地在工作区，保留原状，由用户决定后续处理。失败呈报的末尾 SHALL 附**下一步可用命令指引**，供用户在"断在明确节点、人工自行触发下一步"口径下续接，例如：

- 可用 `@lyx-apply <change-name>` 重跑实施（处理完失败原因后）；
- `@lyx-review-code <change-name>` 暂缓（尚无完整的 apply 阶段 commit 作为审查对象）；
- 已部分落地的改动保留在工作区未提交，可先 `git diff` / `git status` 查看。
