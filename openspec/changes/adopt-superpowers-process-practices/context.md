# Context

## 关键决策

- 只吸收 Superpowers 的流程工程质量，不引入其完整工作流、插件或默认 per-task subagent 模式。
- references 使用 `templates/skill-references/<command>/` 独立源目录，避免改变现有“一命令一 Markdown 文件”的注册与打包假设。
- 行为评测先采用可人工复跑的 Markdown 场景和证据记录，不新增真实模型调用 runner。
- `run-state.md` 作为受版本控制的 change artifact，与 `context.md` 分离：前者记录状态和证据，后者记录软上下文。
- 实施就绪检查并入现有 propose 自审和 review-plan，不新增默认 `plan.md`。
- bug 调试门槛只用于 `@lyx-fix` 的 bug/异常分支；目标仍是单 commit。

## 已否决方案

- 将 `templates/skills/<command>.md` 改为目录结构：会让安装器、注册表、打包和测试全面迁移，超出本次可靠性目标。
- 将 run-state 保持未跟踪到归档：会让所有脏工作区、暂存和审查范围规则新增一类例外，维护成本高于受控提交。
- 新增自动 agent 评测 runner：真实模型调用成本高且结果非确定，本次先固化场景和证据格式。
- 新增 `@lyx-plan` 或 `@lyx-debug` 命令：现有 15 命令已足够，新命令会扩大安装和文档同步面。

## 范围边界

- 只拆 `propose`、`review-plan`、`review-code` 三个超限模板。
- 行为评测先覆盖四个高风险 skill，各至少一个场景。
- 不改现有 Critical/Warning/Info 判级、终止条件、reviewMode、testMode 或提交 trailer。
- 不实现 Superpowers 的并行实施、全程自主 ruling 或 worktree 收尾模型。

## 已知风险

- references 被拆出后，主文件若漏写读取步骤会让 agent 跳过细则；用强制读取语句、引用存在性测试和行为场景共同约束。
- run-state 可能与 git 事实漂移；恢复时必须以 git、tasks 和文件内容核对并记录冲突。
- 人工行为评测可能被跳过；提交证据必须显式写“未执行”及原因，不得用字符串断言冒充通过。
