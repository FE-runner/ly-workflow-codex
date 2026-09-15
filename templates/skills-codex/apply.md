---
name: lyx-apply
description: 'coding subagent 实施 tasks（subagent 多 Agent 模式）：主会话 spawn coding subagent（fork 当前会话上下文 + 只实施 change 范围），逐任务实施+验证+勾选；结论与改动回传主会话，由主会话确认后统一提交 apply: <change-name>；失败原样呈报转人工（不重试不兜底）'
argument-hint: '[<change-name>]'
---

# Apply

> 调用方式：`@lyx-apply` mention 后跟随的自然语言即参数（如 `@lyx-apply` 带需求描述/选项）；无参数时直接 `@lyx-apply`。

实施环节由 **coding subagent** 执行（subagent 多 Agent 模式）：主会话 spawn 一个 coding subagent，fork 当前会话上下文并在任务中点名"只实施 change 范围"；coding subagent 读取 tasks.md 逐任务实施 + 验证 + 勾选后，将改动与结果**回传主会话，不自行 commit**——`apply: <change-name>` 由主会话确认后统一提交，作为 `@lyx-review-code` 的审查对象。失败区分两阶段：**环境级不可用**（宿主无 subagent 能力、初始 spawn 失败）按回退口径回退当前会话直接实施，SHALL NOT 视为业务失败；**实施中/验证失败** SHALL 原样呈报转人工，不自动重试、不切回自实施、不自动兜底。隔离 worktree 的询问/新建统一收敛到 `@lyx-propose` 入口，apply 不触发任何 worktree 询问、不做隔离检测——直接在当前工作目录实施。

## 步骤

### 1. 确定目标 change 名

按固定优先级解析：

1. `参数` 中显式且合法的 change 名。
2. `openspec/changes/` 下唯一未归档的 change。
3. 无法唯一确定 → 直接询问用户。

任一步骤无法唯一确定时，不得继续执行后续步骤。

### 2. spawn coding subagent 实施 tasks

主会话 spawn 一个 coding subagent（由运行环境的宿主 spawn 能力落实），并给它下述任务指示：

1. **模型与推理档** = `~/.ly/config.toml` 的 `[codexHost] codingModel` 与 `codingReasoningEffort`；模型未配置或空白 → 继承当前会话模型，推理档非空时将其值作为宿主 spawn 的 `reasoning_effort` 随 `codingModel` 一并传入，未配置或空白 → 不传该参数。模型与推理档指定只写在任务指示里，由宿主 spawn 能力执行，SHALL NOT 依赖任何 shell 层模型参数，SHALL NOT 内置任何"模型名 → 推理档"的硬编码映射。
2. **agent 模型需额外配置（含推理档；spawn 前确认字段，不做清单强校验）**：coding 模型能否 spawn 由运行环境实际能力决定，SHALL NOT 依赖任何硬编码清单或 `/models` 结果预判。spawn 前 SHALL 读取 `~/.ly/config.toml` 确认 `codingModel` 与 `codingReasoningEffort` 取值；读取失败（缺文件/解析错误）→ 视为**配置状态未知**：明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退。模型留空 → 回退继承当前会话模型；推理档留空 → 不传 `reasoning_effort`。spawn 失败报错原文含 `Unknown model` 与 `Available models: ...` 时如实展示，提示"该模型当前不支持 spawn，请改用报错中 Available models 列表内的模型"；推理档被宿主/上游拒绝时同样如实展示报错原文并按既有 spawn 失败口径处理，SHALL NOT 把取值预判为"配置无效"——能否 spawn 以宿主实际报错为准，SHALL NOT 以配置猜测绕过。**验证某模型是否可 spawn 的示例 prompt**：让 Codex 用该模型 spawn 一个子代理执行简单任务（如回复 ok），报错原文即判定依据。
3. **fork 当前会话上下文**：coding subagent 以当前会话（含 propose 阶段上下文）fork 启动——关键决策、取舍、已知边界等"软上下文"随 fork 到达实施模型。
4. **范围点名（只实施 change 范围）**：任务点名"只实施 change 范围"——读取 `openspec/changes/<change-name>/tasks.md`，按需读取同目录 `proposal.md`/`design.md` 及任务引用的上下文文件，理解现有模式；SHALL NOT 改动范围外文件。
5. **实施规范**（coding subagent 内部执行）：
   - 自顶向下逐任务实施，每完成一个任务立即验证：只修改任务列出的文件，不添加任务之外的功能/重构/注释；按 tasks.md 指定的验证方式运行验证（如 typecheck/build/test），失败则修复后重试，每个任务最多 3 次修复尝试；验证通过后，把 tasks.md 中对应条目从 `- [ ]` 改为 `- [x]`，继续下一个任务。
   - 不询问——任务描述有歧义时按最简方案处理，直接落地并在回传结果中说明选择。
6. **回传不 commit**：coding subagent SHALL NOT 自行执行任何 git commit——实施完成后，将实际改动的文件清单、验证结果与逐任务完成情况回传主会话。

**环境级不可用回退**：若当前环境无 subagent spawn 能力或初始 spawn 失败，主会话回退为当前会话直接实施（实施规范同上），并如实报告"已回退，原因：subagent 不可用"——该回退 SHALL NOT 视为业务失败。

### 3. 主会话确认并统一提交（全部任务完成时执行）

1. 主会话收到 coding subagent 回传的改动与结果后确认；确认时先检查 `git status --porcelain`：若实施前已存在与本次无关的预存改动，`git add` 范围仅限本次实际改动的文件，SHALL NOT 将预存改动一并暂存/提交，并在报告中说明"预存改动未被提交"。
2. `git add` 本次实际改动的文件后立即 `git commit -m "apply: <change-name>"`。
3. `apply: <change-name>` commit 即 `@lyx-review-code` 的审查对象。
4. 无可提交内容（如 tasks 本身无产出、或改动已在审查循环中被提交）则跳过，不创建空 commit。
5. 若 `git commit` 失败，如实报告 Git 返回的原始错误，不重试不兜底。

### 失败处理（未全部完成时执行）

**实施中/验证失败**（coding subagent 报告任务未完成或验证失败）：主会话原样呈报失败详情转人工，不自动重试、不切回自实施、不 commit、不自动兜底。列出 tasks.md 中仍未勾选的条目，停止执行；改动可能已部分落地在工作区，保留原状，由用户决定后续处理。
