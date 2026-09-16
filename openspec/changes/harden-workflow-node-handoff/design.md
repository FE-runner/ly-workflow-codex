## 设计概览

本次改动只改 skill 模板文本（`templates/skills-codex/*.md`）与相应 delta spec，不涉及 CLI 源码、不引入新依赖。核心是把"subagent 多 Agent 模式"的执行约定从"职责描述"收紧为"与宿主 spawn 能力一致的操作纪律"，落在四个模板中作为主会话必须执行的硬规则。

## 统一契约：轮内纪律（review-plan / review-code / apply 三段共用一段话）

三个模板各插入同一段"轮内纪律"约束（措辞允许按命令差异微调，语义一致）：

1. **同轮等待结果**：spawn 子 agent 后 SHALL 在本轮内 wait 其返回；收到结果先逐字转达（报告/日志）再判定；禁止 spawn 后结束回合造成"子 agent 已返回但无人消费"。
2. **禁止口头分发**：一律以实际工具调用落实 spawn / wait / 交换结论，禁止用"我将 spawn…"类自然语言描述代替工具调用。
3. **消费完即关闭**：结果消费完毕 SHALL 关闭子 agent，不假设跨用户回合存活；关闭时机在共识归并或主会话裁决之后，避免提前关闭被"交换结论失败兜底"误判为运行期失败。

## 各模板改动点

### `review-plan.md` / `review-code.md`（双审查关卡）

- **步骤 2/3（spawn）**：补"同轮 wait + 禁止口头分发 + 消费完关闭"；spawn 后必须等待两个 agent 均返回或失败才进入归并。
- **新增"有效返回判定"小节**：返回必须含分级结论或明确"无发现"声明；空响应/疑似截断/纯过程描述 → 无效返回，按运行期失败终止，不按清零。
- **交换结论**：任一步骤（发送/等待）失败 → 终止本轮并报告卡点，不推测补全对方结论。
- **第 2 轮起改"重新 spawn"**：删除"沿用同一批审查 subagent 会话（具备轮间记忆），SHALL NOT 重新 spawn"的跨轮续聊假设；改为每轮重新 spawn 一对全新 subagent（fork 当前上下文，上下文含上一轮结论与修复现状），TASK 仍增量携带上一轮 Critical 逐字原文 + 路径清单。
- **基线锚定**：首轮确定审查基线 commit SHA 后固定；后续轮次审查范围 = `git show <固定SHA>` + `git diff <固定SHA>` + 未跟踪清单，不每轮重算 HEAD。
- **循环期不 commit**：重申每一轮修复完成、验证通过后不提交；统一提交只发生在正常清零后（或 `--no-commit` 关闭）。
- **终止报告**：末尾附"下一步可用命令指引"段落（重跑命令、改动所在位置说明、人工介入提示）。
- **回退标记**：环境级不可用时输出 `[回退] subagent 不可用: <原始报错>`。

### `apply.md`（实施关卡）

- 补轮内纪律：spawn coding subagent 后同轮 wait，禁止口头分发，结果先逐字转达，消费完关闭。
- **主会话确认阶段核对文件清单**：spawn coding subagent 前先记录一次 `git status --porcelain` 快照（覆盖既存改动），快照即实施前基线（subagent 实施与环境级回退自实施两路统一，回退自实施时以主会话自己记录的实施改动文件清单充当回传清单）；spawn 前先识别 partial apply（残留判据限定为"改动路径落在本次实施目标文件集合内"——既存 dirty 路径 ∩ 本次实施目标文件集合 ≠ ∅，或 tasks.md 已勾选但对应改动未提交 → 停止转人工；与本次实施无关的既存改动不算残留）；回传后比对只针对快照之后新增/变化的路径——既存改动不参与比对、不纳入提交范围，快照前已 dirty 的路径若出现在回传清单（重叠）→ 停止转人工并回指 propose 步骤 1 的既存改动处置选择；不一致 → 停止并列出差异，不 commit；一致才提交——提交前显式隔离 index（`git commit --only -- <本次文件>` 或临时 unstage 恢复），提交后以 `git show --name-only` 校验提交文件集合严格等于本次清单，才生成 `apply: <change-name>` commit。
- 回退标记同上一段（环境级不可用回退自实施时输出 `[回退] subagent 不可用: <原始报错>`）。

### `propose.md`（编排入口）

- **全自动步骤 8**：在进入 apply 前增加前置校验——判据为本会话记录的 review-plan 循环终止类型 == 正常清零且无未决人工介入项（节点处显式打印一行校验结论，含依据），否则停在该节点复用终止报告；在进入 review-code 前增加前置校验——apply 提交后记录本次 HEAD SHA，校验最近一期 `apply: <change-name>` commit 的 SHA 等于该记录（旧 commit 不得绕过），否则停在该节点报告实施收尾失败。两处校验不过均不硬闯下一阶段。
- **手动步骤 9**：询问"要不要现在跑一次 review-plan"时附状态摘要（当前阶段：`propose:` commit 已完成；下一步：`@lyx-review-plan <change-name>`），保证选"是"后无歧义续接。

## spec 落点

- `ly-propose-flow`：全自动节点前置校验（MODIFIED）、手动状态摘要（MODIFIED）、基线锚定（MODIFIED）、apply 文件清单核对 + 轮内 wait + 回退标记（MODIFIED）。
- `ly-review-gates`：轮内纪律（ADDED）、有效返回判定（ADDED）、wait 超时 + 交换结论失败兜底 + 回退标记（MODIFIED）、循环重新 spawn + 终止报告指引 + 中途提交口径（MODIFIED）、代码审查读取 git diff 并分级输出发现（MODIFIED：审查范围基线锚定 + 第 2 轮重新 spawn）。
- `subagent-agent-config`：回退显式状态标记（MODIFIED）。

## 文档同步

- `AGENTS.md` / `README.md` 中"第 2 轮起继续与同一批审查 subagent 会话对话（subagent 具备轮间记忆）…无需 session_id/resume"、以及"沿用同一批审查 subagent"的过时措辞，随本 change 同步为"第 2 轮起重新 spawn 一对全新审查 subagent，增量 TASK 语义保留"。

## 验证策略

- 模板改动为纯文本，不触发 CLI 构建，但执行 `pnpm typecheck && pnpm build && pnpm test` 确认无意外破坏（如有模板内容相关测试需通过）。
- `openspec validate --changes harden-workflow-node-handoff` 校验 delta spec 结构。
- 冒烟验证：手动运行为一次 `@lyx-review-plan` 与一次 `@lyx-apply`（在当前 change 上），确认 spawn → wait → 消费闭环；环境级限制导致无法 spawn 时如实记录回退标记行为。
