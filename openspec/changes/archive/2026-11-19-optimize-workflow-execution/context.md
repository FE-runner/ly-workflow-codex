# Context: optimize-workflow-execution

## 执行上下文

- 隔离方式：branch；来源分支：main；开发分支：codex/optimize-workflow-execution。
- 测试模式：normal（项目配置）。
- 执行模式：full-auto（同一未中断回合）。
- worktree：无。

## 核心决策

- 同一未中断全自动回合保存阶段、隔离与测试模式选择；独立 archive 调用只在本次调用内决策。不新增任何替代 `run-state.md` 的状态文件。
- `context.md` 新增简洁的 `## 执行上下文`，只保存人读决策，不保存阶段机、commit 队列或 next action。
- 中断后的可靠性降级为显式人工重入：先读 Git、`tasks.md`、`context.md`、阶段 trailer 和审查快照，再重新调用目标命令。
- 正常审查轮不在终端重复逐字输出全部 Warning/Info；触发终止条件时仍立即展示相关原文与裁决依据。
- 第 2 轮审查优先复用首轮 subagent；只有复用失败才重新 spawn。
- 同一验证命令的连续低风险任务可批量验证；行为、缺陷复现、安全/迁移和独立验收边界保留任务级测试。
- worktree baseline 只做依赖可用性、typecheck 或显式 smoke；完整测试仍由 archive 执行一次。

## 范围边界

- 不删除、迁移或批量改写任何已有 `run-state.md`。
- 不新增 CLI、运行时解析器、配置文件字段或替代账本。
- 不改变 reviewMode、reviewExecutor、codingExecutor、Critical 分级、归档测试门禁和 merge 确认规则。
- 不自动 archive 或 push。

## 已否决备选

- 把状态写回 `.openspec.yaml`：会重新引入双状态源和 OpenSpec 元数据污染。
- 新建 `workflow.md` / `state.yaml`：只是把 run-state 换名，未解决读写和 schema 成本。
- 把每轮审查原文写入另一个日志文件：仍会增加持久写入和清理成本，且终端最终报告足以承载用户结论。

## 方案自审

- 正向闭环：What Changes 1–10 均映射到 tasks 1–7；删除 run-state、压缩自审、安静报告、复用、分批验证、worktree baseline、ask 同回合决策和文档/测试均有任务。
- 反向闭环：tasks 1.1–7.3 均可溯源到至少一条 What Change 或验证义务，无孤儿任务。
- 基线波及：`execution-run-state`、`ly-propose-flow`、`ly-review-gates`、`ly-lifecycle-commands`、`test-mode`、`worktree-create-before-propose`、`archive-verification-gate`、`archive-branch-cleanup`、`skill-behavior-evals`、`skill-reference-bundles`、`risk-based-testing-policy` 均有 delta 覆盖。
- 通用维度：权限与凭据处理不适用；并发通过删除共享状态文件降低冲突；失败路径覆盖复用失败、验证失败、信息缺失和归档阻断；兼容性明确为保留存量 run-state、忽略而不迁移。
- 实施就绪：每个 task 均点名文件/定位范围与验证命令；跨模块契约由 spec 明确；无待用户决策项。
- 验证：`openspec validate --changes optimize-workflow-execution` exit 0，1 passed / 0 failed；仅有“审查终止要求文本过长”的既有规则警告。

## 审查记录

- review-plan：4 轮正常清零；第 1 轮 3 Critical + 1 影响落地 Warning，第 2 轮 2 Critical + 2 影响落地 Warning，第 3 轮 1 影响落地 Warning，第 4 轮无 Critical / 无影响落地 Warning。
- review-code：3 轮正常清零；第 1 轮 2 Critical + 4 影响落地 Warning，第 2 轮 1 Critical + 1 影响落地 Warning，第 3 轮无 Critical / 无影响落地 Warning。

## 实施说明

- 新流程不再创建 `run-state.md`；执行模式、ask 选择与隔离只保存在当前未中断回合或 `context.md` 人读说明。
- 审查正常轮改为一行进度 + 最终汇总；第 2 轮先复用同一 subagent，失败才重新 spawn。
- apply 以相同验证命令划分低风险批次；行为、缺陷复现、安全/迁移与独立验收保留任务级检查点。
- worktree baseline 只检查依赖并运行 typecheck/smoke，完整测试仍由 archive 执行。
- 真实 current evals：`propose`、`apply`、`review-plan`、`review-code`、`propose-self-review-full-auto` 直接通过；`apply-legacy-compat` 在明示旧决策只读复用后通过；`propose-full-auto` 的 side effects 全通过，分类器补充“正常清零结束”等中文终态锚点后对同一 transcript 复核 3/3。
- 最终门禁：`openspec validate` exit 0（仅长 Requirement warning）；`pnpm lint` exit 0；`pnpm typecheck` exit 0；`pnpm test` exit 0，27 files / 471 tests；`git diff --check` exit 0。
