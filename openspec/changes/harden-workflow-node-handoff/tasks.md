## 任务清单

### review-plan 模板加固 `templates/skills-codex/review-plan.md`
- [x] 在"spawn 双审查 subagent（首轮）"执行指示中插入**轮内纪律**：spawn 后 SHALL 在本轮内 wait 两个审查 subagent 返回，收到结果先逐字转达再判定；禁止以自然语言描述"已分发/将分发"代替实际 spawn 调用；结果消费完毕 SHALL 关闭子 agent，不假设跨用户回合存活（关闭时机在共识归并或主会话裁决之后，不得提前关闭导致"交换结论失败"误判）
- [x] 新增**有效返回判定**约束：审查 subagent 返回必须包含可识别的 Critical/Warning/Info 分级结论或明确"无发现"声明；空响应、疑似截断、仅有过程描述无结论的返回视为无效，按运行期失败终止，不得误判为"本轮无 Critical"或清零
- [x] 在交换结论步骤补**失败兜底**：交换结论过程中任一次等待/发送失败 SHALL 立即终止本轮并如实报告卡点（哪一步、哪个 agent），不得用推测补全对方结论
- [x] 补**wait 超时终止语义**：等待审查 subagent 返回超时/卡死 SHALL 按运行期失败终止并如实报告（含已取得的部分结论，如有），不得把超时等同于"本轮无 Critical"或清零
- [x] 将"第 2 轮起沿用同一批审查 subagent 会话（具备轮间记忆），无需重新 spawn"改为**每轮重新 spawn 一对全新审查 subagent**（fork 当前会话上下文，上下文含上一轮结论与修复现状；TASK 仍增量携带上一轮全部 Critical 逐字原文 + 路径清单），不依赖跨轮续聊假设
- [x] 补**审查基线锚定**：首轮确定审查基线 commit SHA 后固定为基线锚点，后续轮次审查范围 = `git show <固定SHA>` + `git diff <固定SHA>` + 未跟踪文件清单，不每轮重算 HEAD
- [x] 重申**循环期不 commit**：每轮修复完成、验证通过后不立即提交，统一提交仅发生在正常清零后（`--no-commit` 关闭时连清零后也不提交）；循环期间发生任何中途提交如实报告其影响
- [x] 终止报告末尾附**下一步可用命令指引**段落（重跑命令、改动保留位置、人工介入提示）
- [x] 环境级不可用回退时输出显式状态标记 `[回退] subagent 不可用: <原始报错>`
- [x] 同步根文档 `AGENTS.md` 与 `README.md` 中"沿用同一批审查 subagent 会话 / 继续与同一批审查 subagent 会话对话（具备轮间记忆）…无需 session_id/resume"的过时措辞，改为"第 2 轮起重新 spawn 一对全新审查 subagent，增量 TASK 语义保留，不依赖跨轮续聊"

### review-code 模板加固 `templates/skills-codex/review-code.md`
- [x] 与 review-plan 同步补**轮内纪律**（同轮 wait / 禁止口头分发 / 消费完关闭）
- [x] 与 review-plan 同步补**有效返回判定**约束（分级结论或无发现声明；空响应/截断/无结论视为无效，按运行期失败终止）
- [x] 与 review-plan 同步补**交换结论失败兜底**（任一次等待/发送失败即终止并报告卡点，不推测补全）
- [x] 与 review-plan 同步补**wait 超时终止语义**（等待超时/卡死按运行期失败终止并如实报告，不得视为清零）
- [x] 与 review-plan 同步改为**每轮重新 spawn** 审查 subagent（增量 TASK 语义保留）
- [x] 与 review-plan 同步补**审查基线锚定**（首轮固定 commit SHA，后续轮 diff 以固定基线 + 工作区现状为准）
- [x] 与 review-plan 同步重申**循环期不 commit** 与中途提交的如实报告口径
- [x] 与 review-plan 同步在终止报告末尾附**下一步可用命令指引**
- [x] 与 review-plan 同步补**回退显式状态标记** `[回退] subagent 不可用: <原始报错>`

### apply 模板加固 `templates/skills-codex/apply.md`
- [x] 在"spawn coding subagent 实施 tasks"中补**轮内纪律**：spawn 后 SHALL 在本轮内 wait coding subagent 返回，收到结果先逐字转达再确认；禁止以自然语言描述代替实际 spawn 与等待；消费完毕 SHALL 关闭子 agent
- [ ] 在主会话确认阶段补**文件清单核对**：spawn coding subagent 前先记录一次 `git status --porcelain` 快照（实施前基线，subagent 实施与回退自实施两路统一，回退自实施以主会话自己记录的实施改动文件清单充当回传清单）；先识别 partial apply（残留判据限定为"改动路径落在本次实施目标文件集合内"——既存 dirty 路径 ∩ 本次实施目标文件集合 ≠ ∅，或 tasks.md 已勾选但对应改动未提交 → 停止转人工；与本次实施无关的既存改动不算残留）；回传后比对只针对快照之后新增/变化的路径（排除既存改动，快照前已 dirty 的路径出现在回传清单 → 停止转人工并回指 propose 步骤 1 的既存改动处置选择），不一致 SHALL 停止并列出差异，不 commit；一致才提交——提交前显式隔离 index（`git commit --only -- <本次实际改动文件>`，SHALL NOT 用全量 `git commit` 吞并 index 既存 staged 内容，或先 unstage 非本次文件、提交后恢复），提交后以 `git show --name-only` 校验提交文件集合严格等于本次清单，才允许生成 `apply: <change-name>` commit
- [x] 环境级不可用回退自实施时输出显式状态标记 `[回退] subagent 不可用: <原始报错>`
- [x] 实施中/验证失败呈报转人工时，在失败详情后附**下一步可用命令指引**（如 `@lyx-apply <change-name>` 重跑、`@lyx-review-code <change-name>` 暂缓）

### propose 模板加固 `templates/skills-codex/propose.md`
- [x] 全自动步骤 8 补**进入 apply 的前置校验**：判据为本会话记录的 review-plan 循环终止类型 == 正常清零且无未决人工介入项，节点处显式打印一行校验结论（含依据），校验不过停在该节点复用终止报告说明阻断原因，不硬闯 apply
- [ ] 全自动步骤 8 补**进入 review-code 的前置校验**：apply 提交后记录本次 HEAD SHA，校验最近一期 `apply: <change-name>` commit 的 SHA 等于该记录（旧 commit 不得绕过），校验不过停在该节点如实报告实施收尾失败，不硬闯 review-code。注意：`propose.md` 模板步骤 8 第 4 项现落地为旧判据（`git log --grep` 匹配非空即过，纯存在性校验），需替换为——apply 提交后以 `git rev-parse HEAD` 记录本次 SHA，用 `git log --grep="^apply: <change-name>" -1 --format=%H` 取最近一期 `apply:` commit SHA 并相等校验，不等/缺失即停在该节点报告（旧 commit 不得绕过）
- [x] 手动步骤 9 询问"要不要现在跑一次 review-plan 审查循环"时附**状态摘要**（当前阶段：`propose: <change-name>` commit 已完成；下一步：`@lyx-review-plan <change-name>`）
- [ ] 在 propose 模板脏改动处置的"原样保留"文案中补**重叠即停止提示**：明示"若这些改动与后续 apply 的实施目标文件重叠，apply 会直接停止转人工"（"本项目切新分支"与"留在当前分支"两个路径的"原样保留"选项共用该提示），使 apply 阶段的重叠停止报告可回指该处置选择

### 一致性验证
- [x] 运行 `openspec validate --changes harden-workflow-node-handoff` 确认 delta spec 结构合法
- [x] 运行 `pnpm typecheck && pnpm build && pnpm test` 确认模板改动未破坏项目（含模板内容相关测试）
- [ ] 人工复核四个模板与三份 delta spec 的表述一致（轮内纪律、回退标记、前置校验语义未漂移）
- [ ] 冒烟验证：以本 change 加固后的模板执行——手动运行 `@lyx-review-plan harden-workflow-node-handoff` 与 `@lyx-apply harden-workflow-node-handoff` 各一次，确认 spawn → wait → 消费闭环；环境级限制导致无法 spawn 时如实记录回退标记行为
