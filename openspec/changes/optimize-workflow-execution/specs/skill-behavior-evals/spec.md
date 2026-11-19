## MODIFIED Requirements

### Requirement: 评测结果形成仓库内可审计报告
实际执行 baseline/current 评测后，仓库 SHALL 保存精简报告，列出运行命令、运行环境、每个 case/version 的 passed/failed/not-executed 状态和关键证据，并把 baseline/current 结论与报告引用回写到四个场景文件的 `Evidence Record`。原始 transcript MAY 保存在临时目录，但 SHALL NOT 提交凭据、完整环境、cookie 或无关的用户数据。实现该评测的 change SHALL 在 apply 阶段运行本 change 修改过的 propose / apply / review-plan / review-code fixture 对应场景的两个版本；环境不可用时按既有规则记录 `not-executed` 与原因。证据 SHALL 写入最终报告、场景 `Evidence Record` 或阶段 commit 正文；SHALL NOT 创建或更新 `run-state.md`。

#### Scenario: 八个评测单元全部执行
- **WHEN** 四个场景分别运行 baseline 与 current
- **THEN** 报告包含 8 行结果，每行 link 到对应 transcript 的临时摘要或记录关键最终输出，不使用占位 `not-executed` 冒充执行

#### Scenario: current 场景失败
- **WHEN** current 版本任一场景未满足通过条件
- **THEN** 报告标记 failed，记录原始关键输出与失败原因，并停止宣称该行为已通过

## REMOVED Requirements

### Requirement: 全自动跨阶段续跑具备真实行为评测
**Reason**: 原评测夹具依赖 run-state 和“最后一个动作是所有阶段完成”的固定路径；新流程改为无状态、安静输出的同回合续跑。
**Migration**: 使用不含 run-state 的 fixture，分别验证阶段交接、子代理复用、安静报告和最终产物。

## ADDED Requirements

### Requirement: 全自动无账本流水线具备行为评测
行为评测运行器 SHALL 至少维护一个不包含 `run-state.md` 的全自动场景：fixture 只提供 propose commit、tasks、context 与正常清零所需的审查输入，验证同一回合实际执行 review-plan → apply → review-code。评测 SHALL 同时检查最终终态、apply commit、review-code 结果和不存在新 run-state，但 SHALL NOT 要求中间阶段重复输出完整报告。

#### Scenario: 无 run-state 连续完成
- **WHEN** fixture 包含完整 artifacts、tasks 和阶段 commit，但不包含 run-state
- **THEN** 被测 agent 在同一回合完成受测流水线，生成预期的 apply/review 结果，且没有创建 run-state

#### Scenario: 中间输出保持安静
- **WHEN** 全自动路径正常跨阶段
- **THEN** 评测允许每个中间阶段只输出一行状态，只要求一份最终报告承载关键结论

#### Scenario: 停在中间报告时失败
- **WHEN** agent 只输出 review-plan 清零摘要而未继续 apply
- **THEN** 场景 failed，并报告缺失的 apply 证据

### Requirement: 多轮审查复用具备行为评测
评测 SHALL 覆盖第 2 轮 review-plan 或 review-code 优先复用同一子代理的路径。fixture SHALL 提供首轮报告和复用失败可选分支，验证默认复用、复用失败后才重新 spawn，并保留增量 TASK 内容。

#### Scenario: 第二轮优先复用
- **WHEN** 首轮审查结束且存在 Critical 修复
- **THEN** 评测要求第二轮 trace 出现 `send_input` / `SendMessage`，而不是新的 spawn

#### Scenario: 复用失败后回退
- **WHEN** fixture 声明复用错误
- **THEN** 评测允许重新 spawn，并要求报告复用失败原因
