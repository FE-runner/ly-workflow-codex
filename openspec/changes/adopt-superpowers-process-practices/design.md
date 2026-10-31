## Context

当前共享 skill 都安装为单文件 `templates/skills/<command>.md` 到 `<skillsDir>/lyx-<command>/SKILL.md`，安装器只渲染并写这一个文件。`review-plan.md`、`review-code.md` 各约 38 KB，`propose.md` 约 31 KB；Claude Code 在上下文压缩后只重新挂载每个 skill 的前 20,000 字符，后部规则存在丢失风险。现有测试主要是模板字符串断言，能防止规则被误删，却不能证明 agent 在压力场景下执行正确。执行状态目前散落在 `tasks.md`、`context.md`、会话记忆和 git commit 中，恢复依赖人工重建。

## Goals / Non-Goals

**Goals:**

- 让长 skill 的主文件低于 20,000 字节，并把可延迟读取的长规则放进同目录 references。
- 为四个高风险流程建立可人工复跑、可记录证据的行为评测格式。
- 建立结构化 run-state，使 propose / review / apply / archive 的状态和新鲜验证证据可恢复。
- 把计划实施就绪、系统调试和证据化完成声明作为现有流程的增量规则。

**Non-Goals:**

- 不复制 Superpowers 的完整插件、命令体系或 per-task subagent 默认模式。
- 不新增用户可调用 skill，不改变现有 15 个命令。
- 不在本 change 引入自动调用真实模型的 CI 评测器；先建立可复跑场景和人工证据门禁。
- 不改变现有 Critical/Warning/Info 判级、终止条件、提交 trailer 或配置字段。

## Decisions

### D1：references 使用独立共享源目录

新增 `templates/skill-references/<command>/` 作为 sidecar 源。安装器根据命令把其中所有 Markdown 文件渲染后复制到 `<skillsDir>/lyx-<command>/references/`。主 `SKILL.md` 使用相对路径引用，例如“执行审查循环前读取 `references/review-loop.md`”。

选择原因：不改动 `templates/skills/` 的“一命令一 Markdown 文件”注册假设，不增加新命令，也避免把 references 当作可安装 skill。替代方案是把 `templates/skills/<command>/SKILL.md` 改成目录结构，但会迫使安装器、打包测试和模板断言全面迁移，收益不足。

### D2：只拆分三个超限 skill

本次只拆 `propose`、`review-plan`、`review-code`。共享逻辑优先抽出：

- `propose/references/isolation-and-commit.md`
- `propose/references/review-pipeline.md`
- `review-*/references/review-loop.md`
- `review-*/references/snapshot-and-report.md`
- `review-*/references/host-protocol.md`

主文件保留：何时触发、目标和前置检查、阶段入口、何时读取哪个 reference、终态输出。references 单文件不设 20 KB 上限，因为它们不随会话启动自动加载。

### D3：description 只表达触发条件

三个核心 skill 的 frontmatter 只说明何时使用、输入是什么和不适用边界，不再总结审查循环或提交顺序。理由与 Superpowers 的发现一致：流程摘要会诱导 agent 只读 description 就执行简化版流程。

### D4：行为评测先采用 Markdown 场景与证据记录

新增 `evals/skills/README.md` 和四个核心 skill 的场景文件。每个场景包含：

- 前置仓库与配置
- 用户请求
- 必须调用的工具或命令
- 禁止动作
- 可接受输出
- 通过/失败判定
- 基线行为与修改后证据

本次不新增 agent API runner：真实模型调用成本高、输出非确定，且会引入新的外部依赖。先让维护者能在 Codex / Claude Code 中手工复跑，并要求高风险模板变更提交证据。未来可在此格式之上增加脚本化 runner。

### D5：run-state 作为受版本控制的 change artifact

`run-state.md` 放在 change 目录并由各阶段 commit 管理，而不是保持未跟踪。状态文件属于交付审计材料，跟踪后可跨 checkout、worktree 和压缩恢复；不沿用 `review-findings.md` 的未跟踪生命周期，避免所有脏工作区与暂存规则再增加一类例外。

固定结构：

```md
# Run State

- Change:
- Stage:
- Source branch:
- Development branch:
- Last good commit:
- Next safe action:

## Task Evidence

## Review State

## Verification

## Rulings
```

`context.md` 记录“为什么这样做”，run-state 记录“现在做到哪、证据是什么、下一步是什么”。review 将 run-state 视为恢复和证据输入，不把它当源码审查对象。

### D6：就绪检查进入 propose 自审和 review-plan

propose 负责在生成阶段补齐机械缺失，review-plan 负责独立验证“无历史实施者能否直接开始”。判据固定为文件/锚点、接口、验证命令、预期结果、独立交付边界五项。这样可以保留 `tasks.md`，不新增默认 `plan.md`。

### D7：调试规则只在 fix 的 bug 分支启用

`@lyx-fix` 处理需求时仍走轻量流程；只有 bug、测试失败或异常行为进入系统调试门槛。连续 3 次修复失败是架构质疑信号，不是继续尝试第 4 个补丁的许可。

### D8：证据格式统一写入 run-state 和最终报告

每条验证记录使用“命令 + 退出码 + 结果摘要”。subagent 自报成功只作为待核验输入，主会话仍需看 diff 或文件清单。archive 重跑慢验证并记录最终证据。

## Risks / Trade-offs

- [主文件拆分后 agent 可能不读 references] → 在每个关键步骤用强制语句指向具体 reference，并在安装校验与行为评测中覆盖缺失/漏读场景。
- [references 增加安装器复杂度] → 保持源目录与目标目录一一对应，文件级复制并在打包测试中枚举完整性。
- [run-state 成为额外维护成本] → 固定最小字段，只在阶段转换、任务、审查轮次和验证后更新，不记录大段日志。
- [行为评测仍依赖人工] → 明确未执行状态，禁止以文本断言冒充行为通过；后续再考虑自动化 runner。
- [多个长模板一次性拆分风险高] → 先机械搬移现有规则，不重写语义；用渲染结果大小和关键字断言保护。

## Migration Plan

这是向后兼容的产物扩展。用户运行 `lycx update` 或重装后，安装目录会出现 `references/`；旧版没有 references 的 skill 仍按单文件方式工作。回滚时可恢复旧版包并重装，旧 references 目录由卸载或强制更新清理。
