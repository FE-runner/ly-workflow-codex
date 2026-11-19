## REMOVED Requirements

### Requirement: 审查-修复循环与终止条件（review-code / review-plan 共用）
**Reason**: 原要求强制每轮重新 spawn 并逐字输出全部发现，和“优先复用子代理、安静运行、最终汇总”的新行为冲突。
**Migration**: 使用新的「审查-修复循环、复用与终止条件」要求；修复范围、分级、四象限、收敛刹车和轮数上限保持。

### Requirement: review 在 ask 模式下使用 change 决策
**Reason**: change 级持久决策依赖已删除的 run-state。
**Migration**: review 每次重新解析 effective 配置；`ask` 在当前调用询问，并在同一审查循环内复用。

### Requirement: 审查关卡读取 run-state 作为恢复事实
**Reason**: run-state 已删除，审查只使用 Git 与审查输入文件。
**Migration**: 审查基线通过 commit trailer 和当前 diff 确定；新回合重新定位，不从账本恢复。

### Requirement: 循环结束后统一提交, `--no-commit` 关闭最终提交
**Reason**: 原要求把 run-state 决策写入、消费和 dirty 恢复纳入统一提交，并对不存在的新账本提出额外提交义务。
**Migration**: 仅对审查范围内实际发生变化的代码或 artifacts 统一提交；测试模式选择只存在当前调用内，不产生状态文件提交。

## ADDED Requirements

### Requirement: 审查-修复循环、复用与终止条件
当某一轮审查发现至少一个 Critical 时, `/ly:review-code` 与 `/ly:review-plan` 都必须（SHALL）由当前会话针对该轮全部 Critical 逐条裁决（见「Critical 裁决：认可即修复、不认可必须附可核验依据」）并执行认可部分的修复, 修复完成后必须（SHALL）自动进入下一轮审查。**第 2 轮起 SHALL 优先复用首轮审查 subagent**（Codex `send_input` / Claude `SendMessage`），并向它发送本轮修复说明、上一轮全部 Critical 逐字原文、`影响落地=是` 的 Warning 逐字原文、路径清单和 `context.md` 路径。只有复用失败（会话丢失、续跑报错或宿主不支持）时才 SHALL 重新 spawn 一个全新审查 subagent（非 fork，只携带 TASK），并在本轮报告说明失败原因。不要求用户手动触发。`/ly:review-code` 的修复对象是审查范围指向的应用代码文件（含为验证修复而必须新增/调整的测试文件）；`/ly:review-plan` 的修复对象是该 change 自己的 `proposal.md`/`design.md`/`tasks.md`以及该 change 目录下的 delta spec 文件（`specs/**/*.md`）——例如"spec 未覆盖 proposal 的 What Changes"这类 Critical, 修复方式就是编辑对应的 delta spec 文件, 不属于修复对象之外的私改。两个命令的每轮修复允许改动"当前轮 Critical 报告直接指向的条目"以及"修复该 Critical 所必需的直接依赖条目"（例如一个跨 artifact/跨文件的一致性问题, 需要同步改动多处才能真正修好）, 但不得借机重构、格式化或改动与该 Critical 无关的内容；命中"必需依赖"用时, 本轮报告必须（SHALL）逐项说明每处改动与该 Critical 的关联性。每轮修复完成后必须（SHALL）记录本轮实际改动的文件清单（含修改的 delta spec 文件, 如适用）。`/ly:review-code` 每轮修复后, 若项目存在对应的验证命令（测试/类型检查/构建）, 必须（SHALL）运行与该轮改动范围相称的验证, 验证失败必须作为停止条件处理；`/ly:review-plan` 每轮修复后必须（SHALL）运行 `openspec validate --changes <change-name>` 作为验证步骤, 验证失败同样作为停止条件。循环必须（SHALL）持续到满足以下任一终止条件, 并受一个全局轮数上限的兜底约束（见「全局轮数上限作为最后兜底」）：

**消费判据（四象限）**：每条 Warning 按 `可自动修复` 与 `影响落地` 两根轴决定处置——`可自动修复=是` 且 `影响落地=是` → 与 Critical 一并在本循环内修复，**不限轮次**，并参与正常清零；`可自动修复=是` 且 `影响落地=否` → 不自动修，落快照；`可自动修复=否` 且 `影响落地=是` → 立即停止循环转人工，SHALL NOT 静默落快照；两者皆否 → 落快照。不再存在"只消费首轮"或"降级为否"的路径。下列终止条件 2-6 SHALL 仍以 Critical 为唯一判定对象；条件 7-9 专门约束 `影响落地=是` 的条目。

1. 某一轮审查 Critical 数为 0 **且所有 `影响落地=是` 的 Warning 都已自动修复**（正常清零）。`影响落地=否` 的条目 SHALL NOT 参与本项判定；`可自动修复=否` 且 `影响落地=是` 的条目按条件 8 停止，不进入清零
2. 熔断：同一个 Critical（以"文件路径 + 问题类型 + 定位锚点（`/ly:review-code` 为函数名/路由/调用点；`/ly:review-plan` 为 artifact 内的具体条目/章节）"三者共同判定为同一问题, 不要求问题描述文字完全一致）在相邻两轮审查中都判定仍存在——即上一轮判定为 Critical 并已尝试修复的问题, 在紧接的下一轮复审中仍被判定未解决。若 当前会话 在上一轮对它的判断是"不认可"（未修复）, 相邻两轮再次出现 SHALL NOT 走熔断而走"驳回硬线"（见条件 5）
3. 无法安全自动修复：某个 Critical 的修复需要产品/业务决策、依赖当前会话不具备的外部凭据、会改变已发布的公开 API 或接口契约, 或 当前会话 判断当前上下文不足以给出确认性修复——命中时不做猜测性修改
4. 修复后验证失败：`/ly:review-code` 该轮修复后运行的测试/类型检查/构建未通过, 或 `/ly:review-plan` 该轮修复后 `openspec validate` 未通过
5. **驳回硬线**（二选一命中即触发）：（a）逐条口径——当前会话 对某个 Critical 判断为不认可（附可核验依据）, 该 Critical 在下一轮审查中仍被提出, 且 当前会话 依然不认可；（b）整轮口径——连续 2 轮审查中, 当前会话 对当轮**全部** Critical 均不认可（零认可、零修复, 即使各轮 Critical 的判同键互不相同）——整轮口径防的是"主会话系统性驳回一切发现"的裁决失效, 命中任一口径立即停止循环, 报告并列展示审查 subagent 各轮原始发现与 当前会话 各轮可核验依据, 判定需要人工介入, 不得继续自动修复或自动放弃
6. 审查对象类型持续系统性误判:连续 3 轮（含本轮）审查中每一轮的全部 Critical 都被 当前会话 判定为同一大类系统性误判——即审查 agent 反复以"该轮 Critical 所依据的类型不属于当前命令的审查范畴"为由被 当前会话 判定不认可（例如 `/ly:review-plan` 连续 3 轮的 Critical 均以"代码库尚未实现该方案条目"为理由），不要求这 3 轮之间 Critical 的文件/类别/锚点互相一致, 只要求"判定为不认可的原因类型"在这 3 轮中一致
7. **影响项熔断**：同一条 `影响落地=是` 的 Warning（判同键采用与上一条 Critical 相同的三元组：文件路径 + 问题类别 + 定位锚点）在相邻两轮审查中仍被判定存在 → 立即停止循环转人工；影响项 SHALL NOT 被降级为「否」或静默放行
8. **不可自动修的影响项**：某条 Warning `可自动修复=否` 且 `影响落地=是` → 立即停止循环转人工，SHALL NOT 落快照后继续执行
9. **第 3 轮起新增影响项**：第 3 轮及以后审查中新出现 `影响落地=是` 的 Warning（其判同键不在前两轮出现过的集合中） → 立即停止循环转人工

出现终止条件 2-9 中任一条时, 命令必须（SHALL）立即停止循环, 在报告中明确指出触发的具体条件、涉及的问题（文件、类别、锚点、判断依据）, 并说明需要人工介入, 不得继续自动修复；这些条件时命令 SHALL NOT 提交任何改动（见下方）——已产生的改动留在工作区交由人工处理。**终止报告的末尾 SHALL 附"下一步可用命令指引"**（如：可用 `@lyx-review-plan <change-name>` 重跑审查；`@lyx-apply` 暂不实施——按当前终止原因；改动保留在工作区，可先 `git diff` 查看），供用户在"断在明确节点、人工自行触发下一步"口径下续接。循环期间的 Warning 与 Info 发现不参与循环终止判定（`影响落地=是` 的 Warning 例外：它们参与条件 1 的正常清零判定，并触发条件 7-9）, 只在循环结束后的最终报告列出最后一轮的结果, 不跨轮次合并。

**下一轮 TASK 保持增量传递语义**：每一轮修复后, 下一轮任务必须（SHALL）包含上一轮全部 Critical 的逐字原文, 以及"本轮改动文件 + 上一轮全部 Critical 指向的文件"的路径清单（`/ly:review-plan` 场景下含 delta spec 文件）——即使某条未修改, 其指向的文件路径也要纳入, 否则审查 agent 无法读取当前内容判断问题是否仍存在。**上一轮 `影响落地=是` 的 Warning 条目 SHALL 同样以逐字原文进入下一轮 TASK**。复用失败而重新 spawn 时，每一轮 TASK SHALL 继续保持该 change 目录下 `context.md` 的路径引用；`context.md` 只作背景引用，不计入"路径清单"所指的修复对象范围。若某条上一轮 Critical 位置字段缺失可解析路径, 命令必须保守处理（一般是将该轮已知的兜底路径集合纳入清单, 不得静默丢弃）。若上一轮某条 Critical 指向的文件被删除或重命名, 路径清单改用新路径并说明状态变化。命令必须（SHALL）指示审查 agent 自行读取路径当前内容, 判断:（a）上轮各 Critical 是否已解决；（b）本轮改动是否引入新问题。未被"本轮改动"和"上一轮任一 Critical 指向"覆盖的文件 SHALL NOT 重新整段传入。

**报告保持安静但有证据**：正常运行轮只 SHALL 记录轮次、Critical/Warning/Info 数量、修复文件清单和验证结果，不要求在终端逐字复制审查 subagent 全部原文。最终报告 SHALL 汇总最后一轮分级发现、每轮 Critical 修复摘要、审查基线和验证命令；触发终止条件时 SHALL 立即展示终止条件、相关原文和当前会话裁决依据。SHALL NOT 为展示完整历史而重复生成大段 Markdown；完整原文 MAY 保留在工具原始输出或临时 transcript 中。

**审查修复循环期间不提交，快照提交为独立例外**：每一轮修复完成、验证通过后, SHALL NOT 立即为审查修复执行 git commit——改动保持在当前状态, 直到循环正常清零后由主会话统一提交一次（见「循环结束后统一提交, `--no-commit` 关闭最终提交」）；`review-findings.md` 按 `review-findings-snapshot` 的「快照提交」规则，在正常清零或任一非正常终止后独立提交；`--no-commit` 传入时统一提交与快照提交都不执行。循环期间发生任何非快照的中途提交（无论主会话手滑或外部因素）SHALL 如实报告，并仍以固定基线重新计算 `git diff <固定SHA>` 说明该中途 commit 是否落在审查范围内（核对 ≠ 替换基线），但不以此自动进入终止条件。

#### Scenario: 第二轮优先复用审查 subagent
- **WHEN** `/ly:review-plan` 第一轮发现 Critical 并修复，进入第二轮
- **THEN** 主会话先通过 `send_input` / `SendMessage` 复用首轮 subagent，并发送增量 TASK；只有复用失败才重新 spawn，并在报告说明原因

#### Scenario: 终止报告附下一步指引
- **WHEN** `/ly:review-plan` 因熔断终止
- **THEN** 终止报告在终止详情后列出下一步可用命令（如 `@lyx-review-plan <change-name>` 重跑），并说明改动保留在工作区、可先 `git diff` 查看

#### Scenario: 循环期间发生意外提交
- **WHEN** 审查-修复循环期间工作区出现一次非本循环统一提交的中途 commit
- **THEN** 命令如实报告该提交及其影响，仍以固定基线重新计算审查范围，不静默忽略，也不仅因此自动终止

#### Scenario: 一轮修复后 Critical 清零（review-code）
- **WHEN** `/ly:review-code` 第一轮审查发现 2 个 Critical, 当前会话 修复后自动触发第二轮审查, 第二轮 Critical 数为 0, 且两轮修复后的验证均通过
- **THEN** 循环在第二轮结束, 命令报告"本次已自动修复 2 个 Critical", 列出第二轮的 Warning/Info, 不再触发第三轮

#### Scenario: 一轮修复后 Critical 清零（review-plan）
- **WHEN** `/ly:review-plan` 第一轮审查在 `design.md` 发现 1 个 Critical, 当前会话 修改 `design.md` 后自动触发第二轮, `openspec validate` 通过, 第二轮 Critical 数为 0
- **THEN** 循环在第二轮结束, 命令报告"本次已自动修复 1 个 Critical", 列出最后一轮 Warning/Info

#### Scenario: 修复对象包含 delta spec 文件
- **WHEN** `/ly:review-plan` 某一轮审查发现的 Critical 是 spec 的 Requirement 未覆盖 proposal 的 What Changes, 当前会话 判断认可
- **THEN** 修复该 Critical 的方式是编辑该 delta spec 文件补对 Requirement/Scenario, 这被记录在改动文件清单中, 不视为走出修复对象范围

#### Scenario: 修复后问题转移到不同文件或不同类别, 循环继续
- **WHEN** 第一轮审查在 `a.ts` 发现一个"空指针"类 Critical, 当前会话 修复后, 第二轮审查在 `a.ts` 发现一个不同的“未处理异常”类 Critical
- **THEN** 命令视为新问题, 不判定熔断, 继续处理新 Critical 并触发下一轮

#### Scenario: 同一文件内两个独立的同类问题不被误判为熔断
- **WHEN** 第一轮审查在 `c.ts` 的 `handleLogin` 发现“SQL 注入”类 Critical, 当前会话 修复后第二轮在同一 `c.ts` 但 `handleSearch` 又发现一条“SQL 注入”类 Critical
- **THEN** 命令视为新问题（锚点不同）, 不判定熔断, 继续处理

#### Scenario: 同一问题连续两轮未解决, 触发熔断
- **WHEN** 第一轮审查在 `b.ts` 的 `parseInput` 判定“SQL 注入”类 Critical, 当前会话 认可并尝试修复, 第二轮仍判同一条“SQL 注入”未解决
- **THEN** 命令立即停止循环, 报告标注该问题文件/类别/锚点及两轮判定, 需要人工介入

#### Scenario: 熔断场景同样适用于 review-plan
- **WHEN** review-plan 第一轮判定 `proposal.md` 的章节与 tasks.md 不一致类 Critical, 当前会话 认可并修改后, 第二轮仍判定存在
- **THEN** 命令立即停止循环, 报告该问题所在 artifact/章节/类别及两轮判定, 转人工

#### Scenario: Critical 需要业务决策, 判定为无法安全自动修复
- **WHEN** 某一轮 Critical 是"该接口未做权限校验", 但修复方式依赖产品未明确的权限模型
- **THEN** 命令不做猜测性修改, 立即停止循环, 报告 Critical 原因及无法安全修复的理由

#### Scenario: 修复后验证失败, 触发停止
- **WHEN** review-code 某一轮修复后运行测试失败；或 review-plan 该轮修复后 `openspec validate` 报错
- **THEN** 命令停止循环, 不再继续下一轮, 报告本轮改动文件及验证失败的具体错误

#### Scenario: 循环中途 Warning/Info 变化不影响终止判定
- **WHEN** 某一轮 Critical 清零、所有 `影响落地=是` 的条目已解决, 但 `影响落地=否` 的 Warning 数量较上一轮增加
- **THEN** 循环仍按正常清零在该轮结束, 最终报告只列出最后一轮的 Warning

#### Scenario: 修复范围扩展到必需的依赖条目, 并说明关联性
- **WHEN** review-plan 的 Critical 锚定 proposal.md, 但真正修复需同时改 `tasks.md`
- **THEN** 当前会话 同时改 proposal.md 和 tasks.md, 本轮报告逐项说明改动与 Critical 的关联

#### Scenario: 连续 3 轮同类系统性误判, 触发新终止条件
- **WHEN** review-plan 连续 3 轮的 Critical 都以“代码库尚未实现该方案条目”为理由, 当前会话 每轮不认可并说明“方案阶段正常状态”
- **THEN** 命令在第 3 轮后停止, 报告"审查对象类型持续系统性误判", 列出 3 轮摘要与判定理由, 转人工

#### Scenario: 系统性误判类别不连续, 不触发新终止条件
- **WHEN** 第一、三轮 Critical 均以“代码库尚未实现”而被判不认可, 但第二轮是一条被认可并修复的真实文档缺陷
- **THEN** 不触发“持续系统性误判”, 循环按原有终止条件继续判定

#### Scenario: 连续 2 轮全部驳回, 触发驳回硬线（整轮口径）
- **WHEN** review-code 连续 2 轮审查中, 当前会话 对当轮全部 Critical 均不认可且每条均附可核验依据
- **THEN** 触发"驳回硬线"终止条件, 立即停止循环, 报告并列展示 2 轮原文与依据

#### Scenario: 部分认可部分驳回时不触发整轮口径
- **WHEN** 连续 2 轮审查中, 每轮当前会话都认可并修复了至少 1 条 Critical
- **THEN** "驳回硬线"整轮口径不触发, 被驳回条目若复现且再被驳回, 由逐条口径判定

#### Scenario: 第二轮 TASK 路径清单覆盖改动文件与全部上一轮 Critical 指向的文件
- **WHEN** review-code 第一轮 3 个 Critical, 当前会话 认可并修复 2 个（涉及 a.ts/b.ts）, 不认可第 3 个（指向 c.ts）
- **THEN** 第二轮 TASK 包含 3 条 Critical 逐字原文及路径清单 a.ts、b.ts、c.ts

#### Scenario: 跨文件/范围性 Critical 的路径列出全部相关文件
- **WHEN** review-plan 第一轮为 proposal.md Impact 与 tasks.md 范围不一致
- **THEN** 该 Critical 的位置字段列出 proposal.md 与 tasks.md 两个路径；第二轮路径清单同时包含两个

#### Scenario: Critical 位置字段缺失可解析路径, 保守纳入全部 artifact
- **WHEN** 某轮一条 Critical 缺失可解析路径
- **THEN** 命令将该 change 目录全部 artifact/delta spec 路径纳入下一轮路径清单, 并在报告说明已扩大范围

#### Scenario: 正常轮报告保持安静
- **WHEN** 某轮返回 2 个 Critical 和 3 个 Warning，均为修复或快照可处理
- **THEN** 报告记录数量和最终结果，不在正常中间输出中逐字复制全部 Warning/Info

#### Scenario: 复用失败后重新 spawn
- **WHEN** `/ly:review-plan` 第 2 轮尝试复用首轮 subagent 但续跑失败
- **THEN** 命令重新 spawn（非 fork，只携带 TASK），并在报告说明复用失败原因；TASK 仍包含上一轮 Critical 原文、路径清单与 context.md 引用

#### Scenario: 首轮 Critical 为 0 但存在影响项时进入验证轮
- **WHEN** 首轮 Critical 数为 0 且存在 `影响落地=是` 且 `可自动修复=是` 的 Warning，当前会话修复该条后进入下一轮
- **THEN** 下一轮按正常清零判定结束循环，并在报告与统一提交中体现该条修复

#### Scenario: 首轮影响项在次轮仍存在时停止转人工
- **WHEN** 影响项修复后下一轮审查仍判定其存在，且 Critical 数为 0
- **THEN** 触发影响项熔断，循环停止转人工

### Requirement: review ask 决策使用当前调用
review-plan 与 review-code 在 effective 配置为 `ask` 时 SHALL 优先复用同一未中断全自动回合已有的 `normal` / `off` 选择；没有可复用选择时 SHALL 询问一次，并在当前审查循环及正常清零提交内复用。命令 SHALL NOT 写入 run-state；新的直接命令调用、新用户回合或中断后 SHALL 重新询问。显式项目或宿主配置优先；旧 `.openspec.yaml lyx.testModeDecision` MAY 只读兼容但不改写。

#### Scenario: 同一循环复用选择
- **WHEN** effective 配置为 `ask`，用户在 review-code 第一轮选择 `off`
- **THEN** 后续轮次继续使用 `off`，不重复询问

#### Scenario: 新 review 调用重新询问
- **WHEN** 用户稍后重新调用 `@lyx-review-code`
- **THEN** 命令重新解析配置，并在仍为 ask 时重新询问

### Requirement: 审查证据不依赖运行账本
review-plan 与 review-code SHALL 在最终报告记录审查基线、轮次、最后一轮发现数量、修复文件和验证结果。正常运行轮 SHALL NOT 要求把每轮全部原文写入磁盘或重复输出；触发终止条件时 SHALL 展示相关原文与裁决依据。命令 SHALL NOT 创建 run-state 或其他审查状态文件。

#### Scenario: 正常清零
- **WHEN** 审查在第二轮清零
- **THEN** 最终报告包含基线、两轮数量和修复文件，不创建 run-state

#### Scenario: 终止
- **WHEN** 审查触发驳回硬线
- **THEN** 报告展示涉及 Critical 的原始文本和每轮裁决依据

### Requirement: 审查正常清零后统一提交实际差异
review-plan 与 review-code SHALL 在循环期间保持修复未提交；仅在正常清零时对审查目标内实际变化的文件执行一次统一提交。review-plan 的目标是该 change 的 artifacts 与 delta spec，review-code 的目标是审查范围代码与循环修复；`review-findings.md` 继续按快照规则独立提交。命令 SHALL NOT 因 ask 选择、run-state 或其他不存在状态文件创建额外 commit。非正常终止时 SHALL NOT 提交审查修复；`--no-commit` 时统一提交和快照提交均跳过。提交使用 `Change-Stage: review-plan-fix` 或 `Change-Stage: review-code-fix` trailer，并校验 `git show --name-only` 不超出目标范围。

#### Scenario: review-plan 正常清零提交 artifacts
- **WHEN** review-plan 修复了 design 和 delta spec 后清零
- **THEN** 只提交该 change 的 artifacts 与 delta spec，不创建 run-state

#### Scenario: review-code 正常清零提交代码修复
- **WHEN** review-code 修复 Critical 后清零
- **THEN** 只提交审查范围内的代码与必要测试修复

#### Scenario: 本轮无实际变化
- **WHEN** 审查正常清零但没有认可任何修复或 artifact 改动
- **THEN** 不创建空 commit

#### Scenario: 非清零终止
- **WHEN** 审查触发驳回硬线、熔断或调用失败
- **THEN** 修复改动留在工作区，不提交审查修复

#### Scenario: no-commit
- **WHEN** 用户传入 `--no-commit`
- **THEN** 不执行统一提交或快照提交
