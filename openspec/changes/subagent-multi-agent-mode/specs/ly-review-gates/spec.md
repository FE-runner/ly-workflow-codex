## ADDED Requirements

### Requirement: 审查关卡以双审查 subagent 执行
review-plan 与 review-code 两个审查关卡 SHALL 各 spawn 2 个审查 subagent 执行：两个 agent SHALL 并行且各自独立审查（互不见对方结论），随后交换结论并讨论以达成共识。每个审查 subagent SHALL fork 当前会话上下文，并在任务中点名审查范围（review-plan 为"只审 change 产物：proposal/design/specs/tasks"，review-code 为"只审 `apply:`/`propose:` commit 对应 diff 及未跟踪清单"），SHALL NOT 超出点名范围作业。审查任务 SHALL 继续引用各自 ROLE_FILE（`~/.ly/prompts/codex/plan-reviewer.md` / `reviewer.md`），角色词内容不重写。

#### Scenario: 双审查 agent 均通过
- **WHEN** 两个审查 subagent 独立审查后达成一致，均未提出 Critical
- **THEN** 结论直接回主会话（pass / 问题清单），进入下一环节

#### Scenario: 双审查 agent 意见分歧
- **WHEN** 审查 agent A 提出 Critical 而审查 agent B 未提出，或两者结论冲突
- **THEN** 主会话拍板，且 SHALL 显式提示用户"这是审查分歧"；主会话能确认 → 按确认结论处理；不能确认 → 判定 Critical（red）进入修复循环

## MODIFIED Requirements

### Requirement: 审查-修复循环与终止条件（review-code / review-plan 共用）
当某一轮审查发现至少一个 Critical 时, `/ly:review-code` 与 `/ly:review-plan` 都必须（SHALL）由当前会话针对该轮全部 Critical 逐条判断（见"Critical 需先经当前会话判断是否认可"）并执行认可部分的修复, 修复完成后必须（SHALL）自动重新执行双审查 subagent 关卡（spawn ×2：fork 当前上下文 + 范围点名, 见本 delta ADDED Requirement）对更新后的内容进行下一轮审查, 不要求用户手动触发。`/ly:review-code` 的修复对象是审查范围指向的应用代码文件（含为验证修复而必须新增/调整的测试文件）；`/ly:review-plan` 的修复对象是该 change 自己的 `proposal.md`/`design.md`/`tasks.md`以及该 change 目录下的 delta spec 文件（`specs/**/*.md`）——例如"spec 未覆盖 proposal 的 What Changes"这类 Critical, 修复方式就是编辑对应的 delta spec 文件, 不属于修复对象之外的私改。两个命令的每轮修复允许改动"当前轮 Critical 报告直接指向的条目"以及"修复该 Critical 所必需的直接依赖条目"（例如一个跨 artifact/跨文件的一致性问题, 需要同步改动多处才能真正修好）, 但不得借机重构、格式化或改动与该 Critical 无关的内容；命中"必需依赖"用时, 本轮报告必须（SHALL）逐项说明每处改动与该 Critical 的关联性。每轮修复完成后必须（SHALL）记录本轮实际改动的文件清单（含修改的 delta spec 文件, 如适用）。`/ly:review-code` 每轮修复后, 若项目存在对应的验证命令（测试/类型检查/构建）, 必须（SHALL）运行与该轮改动范围相称的验证, 验证失败必须作为停止条件处理；`/ly:review-plan` 每轮修复后必须（SHALL）运行 `openspec validate --changes <change-name>` 作为验证步骤, 验证失败同样作为停止条件。循环必须（SHALL）持续到满足以下任一终止条件, 并受一个全局轮数上限的兜底约束（见"全局轮数上限作为最后兜底"）：

1. 某一轮审查 Critical 数为 0（正常清零）
2. 熔断：同一个 Critical（以"文件路径 + 问题类型 + 定位锚点（`/ly:review-code` 为函数名/路由/调用点；`/ly:review-plan` 为 artifact 内的具体条目/章节）"三者共同判定为同一问题, 不要求问题描述文字完全一致）在相邻两轮审查中都判定仍存在——即上一轮判定为 Critical 并已尝试修复的问题, 在紧接的下一轮复审中仍被判定未解决。若 当前会话 在上一轮对它的判断是"不认可"（未修复）, 相邻两轮再次出现 SHALL NOT 走熔断而走"分歧未决"（见下）
3. 无法安全自动修复：某个 Critical 的修复需要产品/业务决策、依赖当前会话不具备的外部凭据、会改变已发布的公开 API 或接口契约, 或 当前会话 判断当前上下文不足以给出确认性修复——命中时不做猜测性修改
4. 修复后验证失败：`/ly:review-code` 该轮修复后运行的测试/类型检查/构建未通过, 或 `/ly:review-plan` 该轮修复后 `openspec validate` 未通过
5. 分歧未决：当前会话 对某个 Critical 判断为不认可（详见下一条 Requirement）, 且该 Critical 在下一轮审查中仍被审查 agent 判定为同一问题存在；双审查 subagent 意见分歧且主会话无法确认时同样落入本终止条件（见 ADDED Requirement）——此时判定为 Critical（red）
6. 审查对象类型持续系统性误判:连续 3 轮（含本轮）审查中每一轮的全部 Critical 都被 当前会话 判定为同一大类系统性误判——即审查 agent 反复以"该轮 Critical 所依据的类型不属于当前命令的审查范畴"为由被 当前会话 判定不认可（例如 `/ly:review-plan` 连续 3 轮的 Critical 均以"代码库尚未实现该方案条目"为理由），不要求这 3 轮之间 Critical 的文件/类别/锚点互相一致, 只要求"判定为不认可的原因类型"在这 3 轮中一致

出现终止条件 2-6 中任一条时, 命令必须（SHALL）立即停止循环, 在报告中明确指出触发的具体条件、涉及的问题（文件、类别、锚点、判断依据）, 并说明需要人工介入, 不得继续自动修复；这些条件时命令 SHALL NOT 提交任何改动（见下方）——已产生的改动留在工作区交由人工处理。循环期间的 Warning 与 Info 发现不参与循环终止判定, 只在循环结束后的最终报告列出最后一轮的结果, 不跨轮次合并。

**循环期间不提交, 仅在正常清零后统一提交一次**：每一轮修复完成、验证通过后, SHALL NOT 立即执行 git commit——改动保持在当前状态, 直到循环结束。仅当循环以"正常清零"结束（终止条件 1）时, 命令才对循环全程改动的文件执行一次统一提交。若循环以终止条件 2-6 中任一结束或达到全局轮数上限, 命令 SHALL NOT 提交, 改动保持在工作区未提交。

**下一轮 TASK 保持增量传递语义**：每一轮修复后, 下一轮任务必须（SHALL）包含上一轮全部 Critical 的逐字原文, 以及"本轮改动文件 + 上一轮全部 Critical 指向的文件"的路径清单（`/ly:review-plan` 场景下含 delta spec 文件）——即使某条未修改, 其指向的文件路径也要纳入, 否则审查 agent 无法读取当前内容判断问题是否仍存在。若某条上一轮 Critical 位置字段缺失可解析路径, 命令必须保守处理（一般是将该轮已知的兜底路径集合纳入清单, 不得静默丢弃）。若上一轮某条 Critical 指向的文件被删除或重命名, 路径清单改用新路径并说明状态变化。命令必须（SHALL）指示审查 agent 自行读取路径当前内容, 判断:（a）上轮各 Critical 是否已解决；（b）本轮改动是否引入新问题。未被"本轮改动"和"上一轮任一 Critical 指向"覆盖的文件 SHALL NOT 重新整段传入。subagent fork 的会话记忆不替代 TASK 的逐字原文——每条 Critical 的逐字文本仍然要显式传, 避免审查 agent 依据模糊记忆断言。

**报告逐轮展示审查 agent 原始发现**：`/ly:review-code`/`/ly:review-plan` 的每一轮审查调用（包括首轮 Critical 为 0 不进入循环的情况）都必须在报告中包含独立区块, 逐字展示该轮双审查 subagent 返回的原始 Critical/Warning/Info 内容（不经概括、改写或合并）, 并与 当前会话 对该轮每条 Critical 的认可/不认可判定并排列出（若该轮无 Critical, 只展示原文）。该区块必须在该轮审查调用返回后于本轮报告呈现。

**报告格式**: 循环终止原因、总轮数、已修复的 Critical 摘要（含每轮改动文件清单）、最后一轮 Warning/Info。仅当全程无任何 Critical/Warning/Info 时才可以使用"未发现问题"表述；只要发现并修复过 Critical, 报告必须明确"本次已自动修复 N 个 Critical"。每条 Critical 摘要用相关人员易懂的语言概括问题与已做改动, 逐字原文区块作为补充材料并存。

#### Scenario: 一轮修复后 Critical 清零（review-code）
- **WHEN** `/ly:review-code` 第一轮审查发现 2 个 Critical, 当前会话 修复后自动触发第二轮审查, 第二轮 Critical 数为 0, 且两轮修复后的验证均通过
- **THEN** 循环在第二轮结束, 命令报告"本次已自动修复 2 个 Critical", 列出第二轮的 Warning/Info, 不再触发第三轮

#### Scenario: 一轮修复后 Critical 清零（review-plan）
- **WHEN** `/ly:review-plan` 第一轮审查在 `design.md` 发现 1 个 Critical（如"未注明范围"）, 当前会话 修改 `design.md` 后自动触发第二轮, `openspec validate` 通过, 第二轮 Critical 数为 0
- **THEN** 循环在第二轮结束, 命令报告"本次已自动修复 1 个 Critical", 列出最后一轮 Warning/Info

#### Scenario: 修复对象包含 delta spec 文件
- **WHEN** `/ly:review-plan` 某一轮审查发现的 Critical 是"spec 的 Requirement 未覆盖 proposal 的 What Changes"（锚定在 `specs/<capability>/spec.md`）, 当前会话 判断认可
- **THEN** 修复该 Critical 的方式是编辑该 delta spec 文件补对 Requirement/Scenario, 这被记录在改动文件清单中, 不视为走出修复对象范围

#### Scenario: 修复后问题转移到不同文件或不同类别, 循环继续
- **WHEN** 第一轮审查在 `a.ts` 发现一个"空指针"类 Critical, 当前会话 修复后, 第二轮审查在 `a.ts` 发现一个不同的“未处理异常”类 Critical（问题类型不同）
- **THEN** 命令视为新问题, 不判定熔断, 继续处理新 Critical 并触发下一轮

#### Scenario: 同一文件内两个独立的同类问题不被误判为熔断
- **WHEN** 第一轮审查在 `c.ts` 的 `handleLogin` 发现“SQL 注入”类 Critical, 当前会话 修复后第二轮在同一 `c.ts` 但 `handleSearch`（不同锚点）又发现一条“SQL 注入”类 Critical
- **THEN** 命令视为新问题（锚点不同）, 不判定熔断, 继续处理

#### Scenario: 同一问题连续两轮未解决, 触发熔断
- **WHEN** 第一轮审查在 `b.ts` 的 `parseInput` 判定“SQL 注入”类 Critical, 当前会话 认可并尝试修复, 第二轮在同一 `b.ts` 同一 `parseInput` 仍判同一条“SQL 注入”未解决
- **THEN** 命令立即停止循环, 报告标注该问题文件/类别/锚点及两轮判定, 需要人工介入

#### Scenario: 熔断场景同样适用于 review-plan
- **WHEN** review-plan 第一轮审查判定 `proposal.md` 的“Purposes”章节与 tasks.md 不一致类 Critical, 当前会话 认可并修改后, 第二轮在同一章节与类别仍然判定存在
- **THEN** 命令立即停止循环, 报告该问题所在 artifact/章节/类别及两轮判定, 转人工

#### Scenario: Critical 需要业务决策, 判定为无法安全自动修复
- **WHEN** 某一轮 Critical 是"该接口未做权限校验", 但修复方式依赖产品未明确的权限模型
- **THEN** 命令不做猜测性修改, 立即停止循环, 报告 Critical 原因及“无法安全修复”的理由, 以及建议的人工方向

#### Scenario: 修复后验证失败, 触发停止
- **WHEN** review-code 某一轮修复后运行测试失败；或 review-plan 该轮修复后 `openspec validate` 报错
- **THEN** 命令停止循环, 不再继续下一轮, 报告本轮改动文件, 及验证失败的具体错误, 需要人工介入

#### Scenario: 循环中途 Warning/Info 变化不影响终止判定
- **WHEN** 某一轮 Critical 清零但 Warning 数量较上一轮增加
- **THEN** 循环仍按正常清零在该轮结束（终止只看 Critical）, 最终报告只列出最后一轮的 Warning, 不合并此前轮

#### Scenario: 修复范围扩展到必需的依赖条目, 并说明关联性
- **WHEN** review-plan 的一个 Critical “proposal.md 的 Impact 章节与 tasks.md 任务不一致”, 该 Critical 锚定 proposal.md, 但真正修复需同时改 `tasks.md`
- **THEN** 当前会话 同时改 proposal.md 和 tasks.md, 本轮报告逐项说明改动与 Critical 的关联, 不视为违反修复范围

#### Scenario: 连续 3 轮同类系统性误判, 触发新终止条件
- **WHEN** review-plan 连续 3 轮的 Critical 都以“代码库尚未实现该方案条目”为理由（各轮具体任务不同）, 当前会话 每轮不认可并说明“方案阶段正常状态”
- **THEN** 命令在第 3 轮后停止, 报告"审查对象类型持续系统性误判", 列出 3 轮原文与判定理由, 转人工（如检查角色提示词是否需要调整）

#### Scenario: 系统性误判类别不连续, 不触发新终止条件
- **WHEN** 第一、三轮 Critical 均以“代码库尚未实现”而被判不认可, 但第二轮是一条被认可并修复的真实文档缺陷
- **THEN** 不触发“持续系统性误判”（未连续 3 轮), 循环按原有终止条件继续判定

#### Scenario: 第二轮 TASK 路径清单覆盖改动文件与全部上一轮 Critical 指向的文件
- **WHEN** review-code 第一轮 3 个 Critical, 当前会话 认可并修复 2 个（涉及 a.ts/b.ts）, 不认可第 3 个（指向 c.ts 未改动）
- **THEN** 第二轮 TASK 包含: 该 3 条 Critical 逐字原文及路径清单 a.ts、b.ts、c.ts；其它未被本轮改动和未由任何上一轮 Critical 指向的文件不整体传入, 审查 agent 自行读取这 3 个文件判断前 2 条是否已解决、第 3 条是否存在

#### Scenario: 跨文件/范围性 Critical 的路径列出全部相关文件
- **WHEN** review-plan 第一轮“proposal.md Impact 与 tasks.md 范围不一致”（不存在单个目标文件）
- **THEN** 该 Critical 的位置字段列出 proposal.md 与 tasks.md 两个路径；第二轮路径清单必须同时包含两个, 不取其一

#### Scenario: Critical 位置字段缺失可解析路径, 保守纳入全部 artifact
- **WHEN** 某轮一条 Critical 缺失可解析路径（角色提示词未被遵守）
- **THEN** 命令不得静默丢弃, 必须将该 change 目录全部 artifact/delta spec 路径统一纳入下一轮路径清单, 并在报告中说明“该条 Critical 缺少路径, 已扩大范围”

#### Scenario: 每轮报告展示 Codex 原始发现与 当前会话 判定的并排对照
- **WHEN** 某轮返回 2 个 Critical: 当前会话 认可第 1 个并修改 `design.md`, 不认可第 2 个（误报）
- **THEN** 本轮报告“逐字原文”区块展示 2 条原文, 并排展示 当前会话 对每条认可/不认可及理由, 用户直接对照

#### Scenario: 轮间续聊开启时, 第 2 轮仍按增量传递语义构造 TASK
- **WHEN** `/ly:review-plan` 首轮取得 session_id, 第 2 轮以 resume 模式延续会话
- **THEN** TASK 仍只包含上一轮全部 Critical 逐字原文 + 路径清单（增量），不整段重新传入基线 artifact 全文；会话记忆提供上下文，不代表 TASK 可省略逐字 Critical 原文

### Requirement: 审查调用失败视为独立终止条件
原"`codex exec` 调用失败（子会话启动失败、`--json` 解析失败、`resume` 失败等）视为独立终止条件"的语义 SHALL 扩展为：subagent 不可用、spawn 失败、审查 agent 未返回有效结论、或双审查任一 agent 调用失败且无法按回退口径继续时, 均视为独立终止条件, 如实报告原因并停止循环。仅当失败可归因于单一 agent 且另一 agent 结论完整时, 可按"分歧未决"路径交主会话处理。

#### Scenario: 审查调用超时
- **WHEN** 审查 subagent 调用超过预设时限未返回有效结论
- **THEN** 命令按独立终止条件处理, 如实报告超时事实与已取得的部分结论（如有）, 不进入下一轮

#### Scenario: 返回内容格式不符
- **WHEN** 审查 subagent 返回内容不符合约定的输出结构, 无法解析出 Critical/Warning/Info
- **THEN** 命令按独立终止条件处理, 报告原始返回内容与解析失败原因, 不猜测改写后继续

#### Scenario: 双审查 agent 均调用失败
- **WHEN** 两个审查 subagent 均无法产出结论（spawn 失败或超时）
- **THEN** 按独立终止条件结束审查, 如实报告"审查调用失败"及原因, 不进入下一轮

