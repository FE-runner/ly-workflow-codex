## ADDED Requirements

### Requirement: 审查发现的自动修复标注

`/ly:review-code` 与 `/ly:review-plan` 的审查发现 SHALL 在既有严重度分级（Critical / Warning / Info）之外，为**每条 Warning** 附一项正交标注 `可自动修复：是 / 否`。Critical 与 Info SHALL NOT 被标注——不可安全自动修复的 Critical 由既有终止条件「无法安全自动修复」处理。该标注 SHALL 由审查者产出：`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文，`reviewExecutor = "main"`（默认）时为主 agent 在本轮审查报告中产出的标注；两条执行者路径 SHALL 使用同一份判据，SHALL NOT 因路径不同而放宽或收紧。命令 SHALL 把该标注视为待当前会话确认的建议值：当前会话 SHALL 可覆盖任一方向，但必须（SHALL）在报告中逐条列出被覆盖的条目、原标注、覆盖后取值与理由，SHALL NOT 静默覆盖。

判「是」的四条须同时成立：**目标唯一**（要改的东西已存在，且以谁为准是确定的——另一方是权威或事实）；**不新造决策**（不引入新格式 / 默认值 / 命名 / 口径 / 分支选择）；**改法机械**（只改审查范围内文件，SHALL NOT 动公开 API / 接口契约 / DB schema / 依赖版本）；**可验证**（现有类型检查 / 测试 / `openspec validate` 可确认未改坏，或纯文档改动的一致性可机械核对）。

命中以下任一即判「否」：建议句含「要么…要么…」「二选一」「取决于」等需要拍板的分支；需要新定格式 / 默认值 / 命名 / 口径；需要产品业务判断，或依赖当前会话不具备的凭据与环境；需要改公开 API / 接口契约 / DB schema / 依赖版本；只要求"提高覆盖率"而未点名具体用例；纯风格偏好或抽象层次之争；审查者自述带不确定性（"可能""疑似"）。

**例外**：建议句虽含分支，但同时显式给出推荐方向时 SHALL 判「是」；采纳该方向后 SHALL 在报告中写明采纳了哪条建议与依据。

**必须判「是」的反向清单**（防借"不可自动修"逃避）：同一事实在两处表述不一致且权威方明确；已点名的漏改或漏同步（含项目「改动对称清单」覆盖的 i18n 文案键、宿主片段、命令表、README 双语）；明确缺陷且写法唯一（如漏捕获异常、漏设错误标志、用错函数）；审查者已点名具体用例的测试补齐。

一条 Warning 含多个子问题时 SHALL 整条判级：任一部分需要判断即整条判「否」，SHALL NOT 半修。

#### Scenario: 机械性条目判「是」

- **WHEN** 某轮 review-code 的 Warning 为「`archive.md` 未说明归档后应读取归档目录下的 `proposal.md`」且建议是单方向补写路径说明
- **THEN** 该条标注为 `可自动修复：是`，进入自动修复候选

#### Scenario: 需要拍板的分支判「否」

- **WHEN** 某轮 review-plan 的 Warning 建议为「要么在 delta spec 补 `## Purpose` 修改块，要么把 design 的措辞改成不暗示自动合并」
- **THEN** 该条标注为 `可自动修复：否`

#### Scenario: 建议显式给出推荐方向时判「是」并留痕

- **WHEN** 某轮 Warning 的建议为「二选一；建议改 design 措辞（推荐），因为 Purpose 属非规范性叙述」
- **THEN** 该条标注为 `可自动修复：是`，且命令在报告中写明采纳了哪条建议与依据

#### Scenario: 多子问题条目整条判「否」

- **WHEN** 一条 Warning 同时涉及三处修复点，其中一处需要业务判断
- **THEN** 整条标注为 `可自动修复：否`，SHALL NOT 只修其中可机械修的子项

#### Scenario: Critical 与 Info 不标注

- **WHEN** 某轮审查返回 1 条 Critical、2 条 Warning 与 1 条 Info
- **THEN** 只有那 2 条 Warning 带 `可自动修复` 标注；Critical 与 Info 不带该标注

#### Scenario: 主会话覆盖标注并在报告中留痕

- **WHEN** 审查者把某条 Warning 标注为「是」，当前会话依据"该修复会变更已发布的公开接口契约"覆盖为「否」
- **THEN** 报告逐条列出该条目、原标注「是」、覆盖后取值「否」与上述理由

### Requirement: 自动修只消费首轮发现且不返工

**进入条件（与既有条件叠加）**：首轮存在标注为「是」的 Warning 时，该轮除本能力既有的进入条件外，MUST 同样进入审查-修复循环（既有的"存在 Critical 则进入循环"SHALL NOT 被理解为排他条件）。进入循环后，仅**首轮（第 1 轮）**标注为「是」的 Warning SHALL 被纳入自动修复。第 2 轮起新出现的「是」条目 SHALL 直接进入审查未修项快照，SHALL NOT 进入修复循环、SHALL NOT 参与正常清零判定。首轮标注为「是」的条目若在紧接的下一轮复审中仍被判定存在，当前会话 SHALL 将其降级为「否」并附依据，落快照后不再重试。因此该机制 SHALL 最多让循环比"仅 Critical"场景多执行 1 轮，且仅当首轮 Critical 数为 0 而存在「是」条目时发生；它 SHALL NOT 延长或绕开既有全局轮数上限。

熔断、驳回硬线、无法安全自动修复、修复后验证失败、审查调用失败与「审查对象类型持续系统性误判」这些终止条件 SHALL 仍以 Critical 为唯一判定对象，SHALL NOT 因「是」条目触发。每轮修复后构造下一轮任务时，SHALL 在既有 TASK 构造规则之上叠加：TASK 除既有内容（上一轮全部 Critical 逐字原文、路径清单、`context.md` 路径引用）外，还须携带首轮全部「是」条目的逐字原文（与 Critical 同一增量语义），供新 spawn 的审查者判断其是否已修复；未纳入该原文的「是」条目 SHALL NOT 被当作已修复。

#### Scenario: 首轮「是」条目修完即清零

- **WHEN** 首轮 Critical 数为 0、存在 2 条「是」Warning，当前会话修复后第 2 轮复审判定两条均已解决且 Critical 仍为 0
- **THEN** 循环在第 2 轮以正常清零结束（比仅 Critical 场景多 1 轮），统一提交包含这两条修复

#### Scenario: 首轮 0 Critical 且无「是」条目不额外跑轮

- **WHEN** 首轮 Critical 数为 0 且不存在「是」条目
- **THEN** 循环在该轮立即结束，不多跑验证轮

#### Scenario: 次轮新出现的「是」条目不进循环

- **WHEN** 首轮 1 条「是」条目修复后，第 2 轮复审新提出 2 条标注为「是」的 Warning
- **THEN** 这 2 条 SHALL NOT 进入修复循环、SHALL NOT 参与清零判定，直接写入快照

#### Scenario: 首轮「是」条目次轮仍存在时降级

- **WHEN** 首轮 1 条「是」条目经当前会话修复后，第 2 轮复审仍判定该条目存在
- **THEN** 当前会话将其降级为「否」并附依据，写入快照且不再重试；循环按清零或既有 Critical 终止条件继续

#### Scenario: 「是」条目不触发熔断与驳回硬线

- **WHEN** 首轮 1 条「是」条目连续两轮未修好，且全程无任何 Critical
- **THEN** SHALL NOT 触发熔断或驳回硬线；该条按降级规则落快照后循环结束

#### Scenario: 增量 TASK 携带首轮「是」条目逐字原文

- **WHEN** 循环进入第 2 轮
- **THEN** TASK 同时包含首轮全部「是」条目的逐字原文、首轮全部 Critical 的逐字原文、路径清单与该 change 目录下 `context.md` 的路径引用

## MODIFIED Requirements

### Requirement: 审查-修复循环与终止条件（review-code / review-plan 共用）
当某一轮审查发现至少一个 Critical 时, `/ly:review-code` 与 `/ly:review-plan` 都必须（SHALL）由当前会话针对该轮全部 Critical 逐条裁决（见「Critical 裁决：认可即修复、不认可必须附可核验依据」）并执行认可部分的修复, 修复完成后必须（SHALL）自动进入下一轮审查——**第 2 轮起重新 spawn 一个全新审查 subagent（非 fork，只携带 TASK；TASK 仍按增量语义携带上一轮全部 Critical 逐字原文 + 路径清单 + 该 change 目录下 `context.md` 的路径引用）**。主会话 SHALL 不依赖"跨轮续聊"假设：子 agent 会话随主会话回合结构而存在，回合结束即失去访问能力，因此每轮都以独立 spawn + 同轮 wait 执行，SHALL NOT 假定上一轮 spawn 的 subagent 仍可被调用。不要求用户手动触发。`/ly:review-code` 的修复对象是审查范围指向的应用代码文件（含为验证修复而必须新增/调整的测试文件）；`/ly:review-plan` 的修复对象是该 change 自己的 `proposal.md`/`design.md`/`tasks.md`以及该 change 目录下的 delta spec 文件（`specs/**/*.md`）——例如"spec 未覆盖 proposal 的 What Changes"这类 Critical, 修复方式就是编辑对应的 delta spec 文件, 不属于修复对象之外的私改。两个命令的每轮修复允许改动"当前轮 Critical 报告直接指向的条目"以及"修复该 Critical 所必需的直接依赖条目"（例如一个跨 artifact/跨文件的一致性问题, 需要同步改动多处才能真正修好）, 但不得借机重构、格式化或改动与该 Critical 无关的内容；命中"必需依赖"用时, 本轮报告必须（SHALL）逐项说明每处改动与该 Critical 的关联性。每轮修复完成后必须（SHALL）记录本轮实际改动的文件清单（含修改的 delta spec 文件, 如适用）。`/ly:review-code` 每轮修复后, 若项目存在对应的验证命令（测试/类型检查/构建）, 必须（SHALL）运行与该轮改动范围相称的验证, 验证失败必须作为停止条件处理；`/ly:review-plan` 每轮修复后必须（SHALL）运行 `openspec validate --changes <change-name>` 作为验证步骤, 验证失败同样作为停止条件。循环必须（SHALL）持续到满足以下任一终止条件, 并受一个全局轮数上限的兜底约束（见「全局轮数上限作为最后兜底」）：

**自动修复条目的适用范围**：首轮标注为 `可自动修复：是` 的 Warning 与 Critical 一并在本循环内修复（见「审查发现的自动修复标注」与「自动修只消费首轮发现且不返工」）。第 2 轮起新出现的「是」条目 SHALL NOT 进入本循环、SHALL NOT 参与下列终止判定；首轮「是」条目若在下一轮复审中仍被判定存在, SHALL 被降级为「否」并落快照, 不再重试。下列终止条件 2-6 SHALL 仍以 Critical 为唯一判定对象。

1. 某一轮审查 Critical 数为 0 **且首轮标注为「是」的 Warning 条目已全部确认修复**（正常清零）。第 2 轮起新出现的「是」条目 SHALL NOT 参与本项判定；首轮「是」条目一经降级为「否」即退出本项判定
2. 熔断：同一个 Critical（以"文件路径 + 问题类型 + 定位锚点（`/ly:review-code` 为函数名/路由/调用点；`/ly:review-plan` 为 artifact 内的具体条目/章节）"三者共同判定为同一问题, 不要求问题描述文字完全一致）在相邻两轮审查中都判定仍存在——即上一轮判定为 Critical 并已尝试修复的问题, 在紧接的下一轮复审中仍被判定未解决。若 当前会话 在上一轮对它的判断是"不认可"（未修复）, 相邻两轮再次出现 SHALL NOT 走熔断而走"驳回硬线"（见条件 5）
3. 无法安全自动修复：某个 Critical 的修复需要产品/业务决策、依赖当前会话不具备的外部凭据、会改变已发布的公开 API 或接口契约, 或 当前会话 判断当前上下文不足以给出确认性修复——命中时不做猜测性修改
4. 修复后验证失败：`/ly:review-code` 该轮修复后运行的测试/类型检查/构建未通过, 或 `/ly:review-plan` 该轮修复后 `openspec validate` 未通过
5. **驳回硬线**（二选一命中即触发）：（a）逐条口径——当前会话 对某个 Critical 判断为不认可（附可核验依据）, 该 Critical 在下一轮审查中仍被提出, 且 当前会话 依然不认可；（b）整轮口径——连续 2 轮审查中, 当前会话 对当轮**全部** Critical 均不认可（零认可、零修复, 即使各轮 Critical 的判同键互不相同）——整轮口径防的是"主会话系统性驳回一切发现"的裁决失效, 命中任一口径立即停止循环, 报告并列展示审查 subagent 各轮原始发现与 当前会话 各轮可核验依据, 判定需要人工介入, 不得继续自动修复或自动放弃
6. 审查对象类型持续系统性误判:连续 3 轮（含本轮）审查中每一轮的全部 Critical 都被 当前会话 判定为同一大类系统性误判——即审查 agent 反复以"该轮 Critical 所依据的类型不属于当前命令的审查范畴"为由被 当前会话 判定不认可（例如 `/ly:review-plan` 连续 3 轮的 Critical 均以"代码库尚未实现该方案条目"为理由），不要求这 3 轮之间 Critical 的文件/类别/锚点互相一致, 只要求"判定为不认可的原因类型"在这 3 轮中一致

出现终止条件 2-6 中任一条时, 命令必须（SHALL）立即停止循环, 在报告中明确指出触发的具体条件、涉及的问题（文件、类别、锚点、判断依据）, 并说明需要人工介入, 不得继续自动修复；这些条件时命令 SHALL NOT 提交任何改动（见下方）——已产生的改动留在工作区交由人工处理。**终止报告的末尾 SHALL 附"下一步可用命令指引"**（如：可用 `@lyx-review-plan <change-name>` 重跑审查；`@lyx-apply` 暂不实施——按当前终止原因；改动保留在工作区，可先 `git diff` 查看），供用户在"断在明确节点、人工自行触发下一步"口径下续接。循环期间的 Warning 与 Info 发现不参与循环终止判定（首轮标注为「是」的 Warning 例外，它们只参与条件 1 的正常清零判定）, 只在循环结束后的最终报告列出最后一轮的结果, 不跨轮次合并。

**下一轮 TASK 保持增量传递语义**：每一轮修复后, 下一轮任务必须（SHALL）包含上一轮全部 Critical 的逐字原文, 以及"本轮改动文件 + 上一轮全部 Critical 指向的文件"的路径清单（`/ly:review-plan` 场景下含 delta spec 文件）——即使某条未修改, 其指向的文件路径也要纳入, 否则审查 agent 无法读取当前内容判断问题是否仍存在。**首轮标注为「是」的 Warning 条目 SHALL 同样以逐字原文进入第 2 轮 TASK**（见「自动修只消费首轮发现且不返工」）。**每一轮 TASK（含第 2 轮起）必须（SHALL）同时保持该 change 目录下 `context.md` 的路径引用**——非 fork spawn 每轮都是全新子代理、无任何历史记忆，缺少该引用即彻底失去软上下文通道（见 `review-context-artifact` 能力「审查与实施 subagent 经 context.md 获取软上下文」）；`context.md` 仍只作背景引用，不计入"路径清单"所指的修复对象范围。若某条上一轮 Critical 位置字段缺失可解析路径, 命令必须保守处理（一般是将该轮已知的兜底路径集合纳入清单, 不得静默丢弃）。若上一轮某条 Critical 指向的文件被删除或重命名, 路径清单改用新路径并说明状态变化。命令必须（SHALL）指示审查 agent 自行读取路径当前内容, 判断:（a）上轮各 Critical 是否已解决；（b）本轮改动是否引入新问题。未被"本轮改动"和"上一轮任一 Critical 指向"覆盖的文件 SHALL NOT 重新整段传入。**非 fork spawn 不携带任何会话历史**——上一轮 Critical 的逐字原文与路径清单是审查 agent 判断"问题是否已解决"的唯一依据, 必须显式传, 避免审查 agent 依据模糊记忆断言。

**报告逐轮展示审查 agent 原始发现**：`/ly:review-code`/`/ly:review-plan` 的每一轮审查调用（包括首轮 Critical 为 0 不进入循环的情况）都必须在报告中包含独立区块, 逐字展示该轮审查 subagent 返回的原始 Critical/Warning/Info 内容（不经概括、改写或合并）, 并与 当前会话 对该轮每条 Critical 的裁决（认可/不认可及可核验依据）并排列出（若该轮无 Critical, 只展示原文）。该区块必须在该轮审查调用返回后于本轮报告呈现。

**报告格式**: 循环终止原因、总轮数、已修复的 Critical 摘要（含每轮改动文件清单）、最后一轮 Warning/Info。仅当全程无任何 Critical/Warning/Info 时才可以使用"未发现问题"表述；只要发现并修复过 Critical, 报告必须明确"本次已自动修复 N 个 Critical"。每条 Critical 摘要用相关人员易懂的语言概括问题与已做改动, 逐字原文区块作为补充材料并存。自动修复的「是」条目 SHALL 在报告中单独列出修复结果（已修 / 降级为「否」及依据）。

**循环期间不提交, 仅在正常清零后统一提交一次**：每一轮修复完成、验证通过后, SHALL NOT 立即执行 git commit——改动保持在当前状态, 直到循环正常清零后由主会话统一提交一次（见「循环结束后统一提交, `--no-commit` 关闭最终提交」）；`--no-commit` 传入时连清零后的统一提交也不执行。循环期间发生任何中途提交（无论主会话手滑或外部因素）SHALL 如实报告，并仍以固定基线重新计算 `git diff <固定SHA>` 说明该中途 commit 是否落在审查范围内（核对 ≠ 替换基线），但不以此自动进入终止条件。

#### Scenario: 第二轮重新 spawn 审查 subagent
- **WHEN** `/ly:review-plan` 第一轮发现 Critical 并修复，进入第二轮
- **THEN** 主会话重新 spawn 一个全新审查 subagent（非 fork, 只携带 TASK），TASK 增量携带第一轮全部 Critical 逐字原文、原路径清单与该 change 目录下 `context.md` 的路径引用，不假定第一轮 subagent 仍存活

#### Scenario: 终止报告附下一步指引
- **WHEN** `/ly:review-plan` 因熔断终止
- **THEN** 终止报告在终止详情后列出下一步可用命令（如 `@lyx-review-plan <change-name>` 重跑），并说明改动保留在工作区、可先 `git diff` 查看

#### Scenario: 循环期间发生意外提交
- **WHEN** 审查-修复循环期间工作区出现一次非本循环统一提交的中途 commit
- **THEN** 命令如实报告该提交及其影响（仍以固定基线重新计算 `git diff <固定SHA>`，核对该中途 commit 是否落在审查范围内，核对不等于替换基线），不静默忽略，也不仅因此自动终止

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
- **WHEN** 某一轮 Critical 清零、首轮无「是」条目, 但 Warning 数量较上一轮增加
- **THEN** 循环仍按正常清零在该轮结束, 最终报告只列出最后一轮的 Warning, 不合并此前轮

#### Scenario: 修复范围扩展到必需的依赖条目, 并说明关联性
- **WHEN** review-plan 的一个 Critical “proposal.md 的 Impact 章节与 tasks.md 任务不一致”, 该 Critical 锚定 proposal.md, 但真正修复需同时改 `tasks.md`
- **THEN** 当前会话 同时改 proposal.md 和 tasks.md, 本轮报告逐项说明改动与 Critical 的关联, 不视为违反修复范围

#### Scenario: 连续 3 轮同类系统性误判, 触发新终止条件
- **WHEN** review-plan 连续 3 轮的 Critical 都以“代码库尚未实现该方案条目”为理由（各轮具体任务不同）, 当前会话 每轮不认可并说明“方案阶段正常状态”
- **THEN** 命令在第 3 轮后停止, 报告"审查对象类型持续系统性误判", 列出 3 轮原文与判定理由, 转人工（如检查角色提示词是否需要调整）

#### Scenario: 系统性误判类别不连续, 不触发新终止条件
- **WHEN** 第一、三轮 Critical 均以“代码库尚未实现”而被判不认可, 但第二轮是一条被认可并修复的真实文档缺陷
- **THEN** 不触发“持续系统性误判”（未连续 3 轮), 循环按原有终止条件继续判定

#### Scenario: 连续 2 轮全部驳回, 触发驳回硬线（整轮口径）
- **WHEN** review-code 连续 2 轮审查中, 当前会话 对当轮全部 Critical 均不认可（第 1 轮 2 条、第 2 轮 1 条, 判同键互不相同, 每条均附可核验依据）
- **THEN** 触发"驳回硬线"终止条件（整轮口径）, 立即停止循环, 报告并列展示 2 轮原文与 2 轮可核验依据, 说明需要人工裁决, SHALL NOT 进入第 3 轮

#### Scenario: 部分认可部分驳回时不触发整轮口径
- **WHEN** 连续 2 轮审查中, 每轮当前会话都认可并修复了至少 1 条 Critical（其余不认可）
- **THEN** "驳回硬线"整轮口径不触发（未出现"全部驳回"轮）；被驳回条目若复现且再被驳回, 由逐条口径判定

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
- **WHEN** 某轮返回 2 个 Critical: 当前会话 认可第 1 个并修改 `design.md`, 不认可第 2 个（附可核验依据）
- **THEN** 本轮报告“逐字原文”区块展示 2 条原文, 并排展示 当前会话 对每条裁决及依据, 用户直接对照

#### Scenario: 第 2 轮重新 spawn 全新审查 subagent
- **WHEN** `/ly:review-plan` 第 2 轮重新 spawn 一个全新审查 subagent（非 fork, 无会话历史）
- **THEN** TASK 仍包含上一轮全部 Critical 逐字原文 + 路径清单 + `context.md` 路径引用（增量），不整段重新传入基线 artifact 全文；上一轮原文是审查 agent 判断"问题是否已解决"的唯一依据, SHALL NOT 因 TASK 精简而省略

#### Scenario: 首轮 Critical 为 0 但存在「是」条目时进入验证轮

- **WHEN** 首轮 Critical 数为 0 且存在 1 条标注为「是」的 Warning，当前会话修复该条后进入第 2 轮
- **THEN** 第 2 轮按正常清零判定（Critical 为 0 且该「是」条目已确认修复）结束循环，并在报告与统一提交中体现该条修复

#### Scenario: 首轮「是」条目在次轮仍存在时降级并结束

- **WHEN** 首轮 1 条「是」条目经修复后，第 2 轮复审仍判定其存在，且 Critical 数为 0（无其他 Critical）
- **THEN** 该条降级为「否」并写入快照，循环按正常清零结束，报告中列出该条的降级依据

### Requirement: 循环结束后统一提交, `--no-commit` 关闭最终提交
`/ly:review-code` 与 `/ly:review-plan` 默认（不传任何标志）在循环执行期间 SHALL NOT 提交——每一轮修复完成后只运行验证（`/ly:review-code` 为测试/类型检查/构建；`/ly:review-plan` 为 `openspec validate`），不执行 git commit，改动保持在工作区（修复改动一律留在工作区未暂存状态；审查目标本身的原始改动可能已由编排方 `/ly:propose`、`/ly:apply` 暂存，命令 SHALL NOT 主动改变文件的 staged 状态）。仅当循环以"正常清零"结束（某一轮 Critical 数为 0 且首轮标注为「是」的 Warning 条目已全部确认修复）时，命令必须（SHALL）在输出报告之前对**审查目标全部文件**执行一次统一提交：先 `git add` 审查目标范围内的全部文件（`/ly:review-code` 为审查范围圈定的全部代码文件——原始改动 + 循环期间修复的改动全部暂存；`/ly:review-plan` 为目标 change 目录下的 `proposal.md`/`design.md`/`tasks.md` 及全部 delta spec 文件——含编排方早已暂存的产物与循环期间修复的文件，一并暂存），再执行一次 commit（仅暂存并提交这些文件，不做范围外的 `git add`）。

统一提交的 commit message SHALL 采用 `commit-conventions` 定义的结构：CC 前缀为 `fix(<scope>): <subject>`，subject 含目标标识与总轮次说明（例如"review-plan 反馈修复（2 轮）"），末尾带 trailer——`/ly:review-plan` 用 `Change-Stage: review-plan-fix`，`/ly:review-code` 用 `Change-Stage: review-code-fix`，两者均带 `Change-Name: <change-name>`。

**审查目标原始改动的提交归属**：`/ly:review-code` 的审查目标是**审查范围圈定的全部文件**——有 apply 阶段 commit 时为该 commit 的差异（`git show <commit>`）叠加循环期间未提交的修复；仅在无 apply 阶段 commit 的退化场景下才是"当前工作区尚未提交的变更"（`git diff HEAD` 圈定的范围）。两种场景下，循环产生的修复都是在原始内容之上的修正，清零后的统一提交本来就应同时包含"原始内容"与"审查修正"，二者是同一个待提交单元，不需要也不应该被拆开。同样地，`/ly:review-plan` 的审查目标（该 change 的 artifact 与 delta spec 文件）允许在循环开始前处于未暂存或已暂存状态（`/ly:propose` 编排下产物已暂存、独立运行时可能未暂存）。**因此 `review-plan` 场景下不再存在任何"循环开始前已脏的文件被跳过提交"的隔离逻辑**——propose 产物是合法审查对象不是无关脏文件，用户手工编辑的 artifact 同样属于审查目标内容，一并提交；删除对"循环开始前未提交状态文件"的 `git status --porcelain` 预检查和隔离跳过行为。

若循环全程没有任何 Critical 或标注为「是」的 Warning 被认可修复（从未发生实际文件改动），SHALL NOT 创建空 commit。**仅修复「是」条目而不含任何 Critical 修复时，同样 MUST 执行这次统一提交**——判据是"是否发生实际文件改动"，不是"是否修过 Critical"。若循环以其余任一终止条件结束（熔断、无法安全修复、验证失败、驳回硬线、审查对象类型持续系统性误判）或达到全局轮数上限，命令 SHALL NOT 提交，已产生的改动保持在工作区未提交状态，交由人工核实后自行决定是否提交——这些场景本身已经需要人工介入，不适合先自动提交半成品。当编排方（`/ly:propose` 或 `/ly:apply`）按自身规则决定对这类非清零终止的改动是否提交（见 `ly-propose-flow`、`ly-lifecycle-commands` 能力中的手动模式询问规则）时，是编排方层面在循环结束后对暂存区做提交决策，SHALL NOT 被理解为 review 循环自身的行为；循环自身的约束始终是"非清零 SHALL NOT 提交"。若"正常清零"后的这次统一提交本身执行失败（Git hook 拒绝、身份未配置、锁文件冲突等），必须（SHALL）在报告中如实说明该失败，视为"循环已清零, 但统一提交失败"的独立结果——循环本身不重新进入下一轮（因为已经清零, 没有下一轮的意义），但报告必须明确指出还需要人工手动完成这次提交。传入可选标志 `--no-commit` 时，命令 SHALL NOT 执行这次最终统一提交（不管循环以何种方式结束），修复结果始终留给调用方或用户自行处理。

#### Scenario: review-plan 场景下, 编排方暂存的产物与循环修复一并统一提交
- **WHEN** `/ly:propose` 将 `openspec/changes/<change-name>/` 下的产物 `git add` 暂存后调用 `/ly:review-plan <change-name>`; 循环期间因某条 Critical 修复了 `design.md` 与一份 delta spec, 最终清零
- **THEN** 清零后的统一提交先 `git add` 该 change 目录下的全部 artifact 与 delta spec 文件（含编排方已暂存的产物与循环的修复改动）, 再执行一次 commit——产物与修复作为同一待提交单元一并提交, 不存在"循环开始前已脏被跳过"的隔离, commit message 带 `Change-Stage: review-plan-fix` trailer

#### Scenario: review-code 场景下, 被审查的原始改动与修复一并提交
- **WHEN** 用户在触发 `/ly:review-code` 前已有未提交的代码改动（这正是本次的审查对象), 循环期间修复了其中一个 Critical 后清零
- **THEN** 统一提交时先把审查范围内全部文件 `git add`（用户原始改动 + 循环期间修复一并暂存）, 再执行 commit——二者作为同一份改动一起提交, 不做隔离——这是 `/ly:review-code` 的正常预期行为, commit message 带 `Change-Stage: review-code-fix` trailer

#### Scenario: 正常清零后统一提交一次
- **WHEN** 用户（或编排该命令的上层流程）执行 `/ly:review-plan <change-name>`（不带任何标志）, 第一轮发现 1 个 Critical 并修复、`openspec validate` 通过, 第二轮 Critical 数为 0
- **THEN** 循环期间（第一轮修复后）不执行任何 commit; 第二轮清零后, 命令 `git add` 该 change 目录全部 artifact 与 delta spec 文件, 在输出报告之前统一提交, 提交信息形如 `fix(openspec): review-plan 反馈修复（1 轮）` 并带 `Change-Stage: review-plan-fix` / `Change-Name: <change-name>` trailer

#### Scenario: 带 --no-commit 时不做最终提交
- **WHEN** 用户执行 `/ly:review-code --no-commit`, 循环修复了若干 Critical 后清零结束
- **THEN** 命令不执行任何 commit（循环期间和清零后都不提交）, 修改的文件保持在工作区未提交状态

#### Scenario: 循环以非清零终止条件结束, 循环自身不提交已产生的改动
- **WHEN** `/ly:review-code` 第一轮修复 1 个 Critical 后, 第二轮审查判定该问题仍存在（触发熔断）
- **THEN** 循环自身不提交第一轮的改动, 已修改的文件保持在工作区未提交状态, 报告中说明需要人工核实是否保留这次修复; 是否提交改由编排方（`/ly:propose`/`/ly:apply` 手动模式）按自身规则询问用户后决定

#### Scenario: 本轮无实际改动, 不创建空 commit
- **WHEN** 循环从未有任何 Critical 或标注为「是」的 Warning 被 当前会话 判定为认可（因而从未发生实际文件改动), 最终以某种方式清零或终止
- **THEN** 命令不执行 commit, 不产生空提交

#### Scenario: 清零后的统一提交本身失败
- **WHEN** 循环第二轮清零, 命令尝试执行统一提交, 但因 pre-commit hook 拒绝或 Git 身份未配置导致 commit 失败
- **THEN** 命令不重新进入循环（因为已经清零), 在报告中如实说明这次统一提交失败的原始错误信息, 并指出需要人工手动完成提交

#### Scenario: 仅自动修复「是」条目时同样统一提交
- **WHEN** 首轮 Critical 数为 0、存在 2 条标注为「是」的 Warning, 当前会话修复后第 2 轮复审确认已解决并按正常清零结束
- **THEN** 命令 MUST 执行统一提交（判据是发生了实际文件改动），提交信息带该命令对应的 `Change-Stage` trailer 与 `Change-Name: <change-name>`, SHALL NOT 因"没有修过 Critical"而跳过提交
