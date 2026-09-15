## 任务清单

### review-plan 模板加固 `templates/skills-codex/review-plan.md`
- [ ] 在"spawn 双审查 subagent（首轮）"执行指示中插入**轮内纪律**：spawn 后 SHALL 在本轮内 wait 两个审查 subagent 返回，收到结果先逐字转达再判定；禁止以自然语言描述"已分发/将分发"代替实际 spawn 调用；结果消费完毕 SHALL 关闭子 agent，不假设跨用户回合存活
- [ ] 新增**有效返回判定**约束：审查 subagent 返回必须包含可识别的 Critical/Warning/Info 分级结论或明确"无发现"声明；空响应、疑似截断、仅有过程描述无结论的返回视为无效，按运行期失败终止，不得误判为"本轮无 Critical"或清零
- [ ] 在交换结论步骤补**失败兜底**：交换结论过程中任一次等待/发送失败 SHALL 立即终止本轮并如实报告卡点（哪一步、哪个 agent），不得用推测补全对方结论
- [ ] 补**wait 超时终止语义**：等待审查 subagent 返回超时/卡死 SHALL 按运行期失败终止并如实报告（含已取得的部分结论，如有），不得把超时等同于"本轮无 Critical"或清零
- [ ] 将"第 2 轮起沿用同一批审查 subagent 会话（具备轮间记忆），无需重新 spawn"改为**每轮重新 spawn 一对全新审查 subagent**（fork 当前会话上下文，上下文含上一轮结论与修复现状；TASK 仍增量携带上一轮全部 Critical 逐字原文 + 路径清单），不依赖跨轮续聊假设
- [ ] 补**审查基线锚定**：首轮确定审查基线 commit SHA 后固定为基线锚点，后续轮次审查范围 = `git show <固定SHA>` + `git diff <固定SHA>` + 未跟踪文件清单，不每轮重算 HEAD
- [ ] 重申**循环期不 commit**：每轮修复完成、验证通过后不立即提交，统一提交仅发生在正常清零后（`--no-commit` 关闭时连清零后也不提交）；循环期间发生任何中途提交如实报告其影响
- [ ] 终止报告末尾附**下一步可用命令指引**段落（重跑命令、改动保留位置、人工介入提示）
- [ ] 环境级不可用回退时输出显式状态标记 `[回退] subagent 不可用: <原始报错>`

### review-code 模板加固 `templates/skills-codex/review-code.md`
- [ ] 与 review-plan 同步补**轮内纪律**（同轮 wait / 禁止口头分发 / 消费完关闭）
- [ ] 与 review-plan 同步补**有效返回判定**约束（分级结论或无发现声明；空响应/截断/无结论视为无效，按运行期失败终止）
- [ ] 与 review-plan 同步补**交换结论失败兜底**（任一次等待/发送失败即终止并报告卡点，不推测补全）
- [ ] 与 review-plan 同步补**wait 超时终止语义**（等待超时/卡死按运行期失败终止并如实报告，不得视为清零）
- [ ] 与 review-plan 同步改为**每轮重新 spawn** 审查 subagent（增量 TASK 语义保留）
- [ ] 与 review-plan 同步补**审查基线锚定**（首轮固定 commit SHA，后续轮 diff 以固定基线 + 工作区现状为准）
- [ ] 与 review-plan 同步重申**循环期不 commit** 与中途提交的如实报告口径
- [ ] 与 review-plan 同步在终止报告末尾附**下一步可用命令指引**
- [ ] 与 review-plan 同步补**回退显式状态标记** `[回退] subagent 不可用: <原始报错>`

### apply 模板加固 `templates/skills-codex/apply.md`
- [ ] 在"spawn coding subagent 实施 tasks"中补**轮内纪律**：spawn 后 SHALL 在本轮内 wait coding subagent 返回，收到结果先逐字转达再确认；禁止以自然语言描述代替实际 spawn 与等待；消费完毕 SHALL 关闭子 agent
- [ ] 在主会话确认阶段补**文件清单核对**：用 `git status --porcelain` 抓取实际改动清单与 coding subagent 回传清单比对，不一致 SHALL 停止并列出差异，不 commit；一致才允许 `git add` 本次实际改动文件后 `git commit -m "apply: <change-name>"`
- [ ] 环境级不可用回退自实施时输出显式状态标记 `[回退] subagent 不可用: <原始报错>`

### propose 模板加固 `templates/skills-codex/propose.md`
- [ ] 全自动步骤 8 补**进入 apply 的前置校验**：校验 review-plan 以"正常清零结束"收尾（清零报告存在、无未决人工介入项），校验不过停在该节点复用终止报告说明阻断原因，不硬闯 apply
- [ ] 全自动步骤 8 补**进入 review-code 的前置校验**：校验 `apply: <change-name>` commit 已存在（`git log --grep="^apply: <change-name>"` HEAD 侧最近一期非空），校验不过停在该节点如实报告实施收尾失败，不硬闯 review-code
- [ ] 手动步骤 9 询问"要不要现在跑一次 review-plan 审查循环"时附**状态摘要**（当前阶段：`propose: <change-name>` commit 已完成；下一步：`@lyx-review-plan <change-name>`）

### 一致性验证
- [ ] 运行 `openspec validate --changes harden-workflow-node-handoff` 确认 delta spec 结构合法
- [ ] 运行 `pnpm typecheck && pnpm build && pnpm test` 确认模板改动未破坏项目（含模板内容相关测试）
- [ ] 人工复核四个模板与三份 delta spec 的表述一致（轮内纪律、回退标记、前置校验语义未漂移）
- [ ] 冒烟验证：手动运行 `@lyx-review-plan harden-workflow-node-handoff` 与 `@lyx-apply harden-workflow-node-handoff` 各一次，确认 spawn → wait → 消费闭环；环境级限制导致无法 spawn 时如实记录回退标记行为
