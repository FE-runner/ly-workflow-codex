## ADDED Requirements

### Requirement: 审查 subagent 轮内纪律（同轮 wait、禁止口头分发、消费完即关闭）

review-plan 与 review-code 的主会话 spawn 审查 subagent 后 SHALL 遵守轮内纪律：

1. **同轮等待结果**：spawn 之后 SHALL 在本轮内等待子 agent 返回（wait），收到结果先逐字转达给用户/报告再判定；SHALL NOT 在 spawn 后结束本轮回合（子 agent 返回的结果必须由本轮主会话消费，不允许"结果回来了但无人消费"的断链状态）。
2. **禁止口头分发代替工具调用**：主会话 SHALL NOT 仅以自然语言描述"已分发/将分发审查任务给 subagent"代替实际 spawn 调用；每一步 spawn/wait/交换结论都 SHALL 落到宿主工具调用，不产出口头占位。
3. **消费完即关闭**：子 agent 结果消费完毕（结论归并/判定完成，不再需要该 agent）SHALL 关闭它，SHALL NOT 假设 subagent 跨用户回合存活。

#### Scenario: spawn 后同轮等待结果
- **WHEN** 主会话 spawn 两个审查 subagent 并等待其返回
- **THEN** 主会话在本轮内完成 wait 并消费结果，不结束回合留下"子 agent 已返回但主会话已退出"的状态

#### Scenario: 口头描述分发不视为执行
- **WHEN** 主会话输出"我将 spawn 审查 subagent"但未实际调用 spawn 工具
- **THEN** 该输出不视为分发动作，SHALL NOT 据此结束本轮或进入下一阶段；主会话必须实际完成 spawn + wait 才推进

### Requirement: 审查返回有效性判定

主会话判断一轮审查返回结果是否有效：审查 subagent 返回 SHALL 包含可识别的分级结论（Critical/Warning/Info 计数与条目）或明确的"无发现"声明。空响应、内容疑似截断（token 截断、输出被中断）、或仅有过程描述而无结论的返回，SHALL 视为无效返回，按"审查调用失败视为独立终止条件"的运行期失败处理，如实报告原始返回内容与判定理由，SHALL NOT 被误判为"本轮无 Critical"或视为清零通过。

#### Scenario: 返回仅为过程描述
- **WHEN** 审查 subagent 返回"已审完 proposal 与 design，未发现异常"但没有任何分级条目、也无明确的"无发现"声明格式
- **THEN** 视为无效返回，按运行期失败终止并报告，不按清零处理

#### Scenario: 返回内容疑似截断
- **WHEN** 审查 subagent 返回的分级条目在末尾明显中断（无收尾、无总计数）
- **THEN** 按无效返回处理，如实报告"疑似截断，视为无效"，进入终止条件，不猜测补全

## MODIFIED Requirements

### Requirement: 审查调用失败视为独立终止条件

`/ly:review-code` 与 `/ly:review-plan` 必须（SHALL）区分四类审查调用失败：**运行期失败**（spawn 后等待超时/卡死、返回内容格式不符或不含有效结论（含空响应与疑似截断，见"审查返回有效性判定"）、双审查任一 agent 调用失败且无法按回退口径继续、回退不可行或回退后仍失败）视为独立终止条件, 如实报告原因并停止循环, 不得把失败等同于"本轮无 Critical"或视为清零通过；**环境级不可用**（宿主无 subagent 能力、初始 spawn 不可用）按 `subagent-agent-config` 的回退口径处理——回退当前会话直接执行审查, 并如实报告带显式状态标记的回退（`[回退] subagent 不可用: <原始报错>`）, SHALL NOT 视为流程失败中断整体编排。当失败可归因于单一 agent 且另一 agent 结论完整时, SHALL 以完整一方结论继续审查并如实报告降级（含失败 agent 与原因）, SHALL NOT 归入"分歧未决"（环境级失败非意见分歧）；是否补跑或重试由主会话决定。配置读取失败（缺文件或解析错误）SHALL 视为"配置状态未知", 明确提示"无法读取配置, 请运行 `lycx doctor` 检查", SHALL NOT 按"未配置"静默继承回退。**交换结论长链失败兜底**：双审查 agent 交换结论过程中任一次等待/发送失败，SHALL 立即终止本轮并如实报告（说明卡在交换结论的哪一步、涉及哪个 agent），SHALL NOT 用推测补全对方结论后再归并。

#### Change: 运行期失败补充"等待超时/卡死"与"交换结论长链失败兜底"；环境级回退补充显式状态标记。

#### Scenario: 审查调用超时
- **WHEN** 审查 subagent 调用超过预设时限未返回有效结论
- **THEN** 命令按独立终止条件处理, 如实报告超时事实与已取得的部分结论（如有）, 不进入下一轮

#### Scenario: 交换结论时等待失败
- **WHEN** 主会话把审查 agent A 的结论发送给 agent B 等待复核时，等待失败（超时或 agent 无响应）
- **THEN** 命令终止本轮，如实报告"交换结论阶段失败（agent B 复核等待超时）"，不推测补全 B 的意见，不进入归并


#### Scenario: 返回内容格式不符
- **WHEN** 审查 subagent 返回内容不符合约定输出结构, 无法解析出 Critical/Warning/Info
- **THEN** 命令按独立终止条件处理, 报告原始返回内容与解析失败原因, 不猜测改写后继续


#### Scenario: 双审查 agent 均调用失败
- **WHEN** 两个审查 subagent 均无法产出结论（spawn 失败或超时）
- **THEN** 按独立终止条件结束审查, 如实报告"审查调用失败"及原因, 不进入下一轮


#### Scenario: 环境级 subagent 不可用, 回退当前会话直接审查
- **WHEN** 当前 codex 环境无 subagent 能力或在初始 spawn 即不可用, 用户运行 `/ly:review-plan` 或 `/ly:review-code`
- **THEN** 命令回退为当前会话直接执行审查并如实报告"已回退, 原因：subagent 不可用", SHALL NOT 视为流程失败中断整体编排


#### Scenario: 单一 agent 失败且另一 agent 结论完整
- **WHEN** 双审查中一个审查 agent 调用失败, 另一个 agent 返回完整结论
- **THEN** 命令以完整一方结论继续审查并如实报告降级（含失败 agent 与原因）, 不归入"分歧未决"; 是否补跑或重试由主会话决定


#### Scenario: 模板运行前读取配置失败
- **WHEN** 审查 subagent spawn 前读取 `~/.ly/config.toml` 失败（缺文件或解析错误）
- **THEN** 命令明确提示"无法读取配置, 请运行 `lycx doctor` 检查", 按"配置状态未知"处理, SHALL NOT 按"未配置"静默继承回退

### Requirement: 审查-修复循环与终止条件（review-code / review-plan 共用）

当某一轮审查发现至少一个 Critical 时, `/ly:review-code` 与 `/ly:review-plan` 都必须（SHALL）由当前会话针对该轮全部 Critical 逐条判断（见"Critical 需先经当前会话判断是否认可"）并执行认可部分的修复, 修复完成后必须（SHALL）自动进入下一轮审查——**第 2 轮起重新 spawn 一对全新审查 subagent（fork 当前会话上下文，上下文包含上一轮结论与修复后的现状；TASK 仍按增量语义携带上一轮全部 Critical 逐字原文 + 路径清单）**。主会话 SHALL 不依赖"跨轮续聊"假设：子 agent 会话随主会话回合结构而存在，回合结束即失去访问能力，因此每轮都以独立 spawn + 同轮 wait 执行，SHALL NOT 假定上一轮 spawn 的 subagent 仍可被调用。不要求用户手动触发。`/ly:review-code` 的修复对象是审查范围指向的应用代码文件（含为验证修复而必须新增/调整的测试文件）；`/ly:review-plan` 的修复对象是该 change 自己的 `proposal.md`/`design.md`/`tasks.md`以及该 change 目录下的 delta spec 文件（`specs/**/*.md`）——例如"spec 未覆盖 proposal 的 What Changes"这类 Critical, 修复方式就是编辑对应的 delta spec 文件, 不属于修复对象之外的私改。两个命令的每轮修复允许改动"当前轮 Critical 报告直接指向的条目"以及"修复该 Critical 所必需的直接依赖条目"（例如一个跨 artifact/跨文件的一致性问题, 需要同步改动多处才能真正修好）, 但不得借机重构、格式化或改动与该 Critical 无关的内容；命中"必需依赖"用时, 本轮报告必须（SHALL）逐项说明每处改动与该 Critical 的关联性。每轮修复完成后必须（SHALL）记录本轮实际改动的文件清单（含修改的 delta spec 文件, 如适用）。`/ly:review-code` 每轮修复后, 若项目存在对应的验证命令（测试/类型检查/构建）, 必须（SHALL）运行与该轮改动范围相称的验证, 验证失败必须作为停止条件处理；`/ly:review-plan` 每轮修复后必须（SHALL）运行 `openspec validate --changes <change-name>` 作为验证步骤, 验证失败同样作为停止条件。循环必须（SHALL）持续到满足以下任一终止条件, 并受一个全局轮数上限的兜底约束（见"全局轮数上限作为最后兜底"）：

1. 某一轮审查 Critical 数为 0（正常清零）
2. 熔断：同一个 Critical（以"文件路径 + 问题类型 + 定位锚点（`/ly:review-code` 为函数名/路由/调用点；`/ly:review-plan` 为 artifact 内的具体条目/章节）"三者共同判定为同一问题, 不要求问题描述文字完全一致）在相邻两轮审查中都判定仍存在——即上一轮判定为 Critical 并已尝试修复的问题, 在紧接的下一轮复审中仍被判定未解决。若 当前会话 在上一轮对它的判断是"不认可"（未修复）, 相邻两轮再次出现 SHALL NOT 走熔断而走"分歧未决"（见下）
3. 无法安全自动修复：某个 Critical 的修复需要产品/业务决策、依赖当前会话不具备的外部凭据、会改变已发布的公开 API 或接口契约, 或 当前会话 判断当前上下文不足以给出确认性修复——命中时不做猜测性修改
4. 修复后验证失败：`/ly:review-code` 该轮修复后运行的测试/类型检查/构建未通过, 或 `/ly:review-plan` 该轮修复后 `openspec validate` 未通过
5. 分歧未决：当前会话 对某个 Critical 判断为不认可（详见下一条 Requirement）, 且该 Critical 在下一轮审查中仍被审查 agent 判定为同一问题存在；双审查 subagent 意见分歧、首轮经主会话无法确认判定为 Critical 进入修复循环后，下一轮复审两 agent 仍分歧且主会话仍无法确认时，最终落入本终止条件（与 Requirement"审查关卡以双审查 subagent 执行"的"分歧时序"两轮规则一致）——此时判定为 Critical（red）
6. 审查对象类型持续系统性误判:连续 3 轮（含本轮）审查中每一轮的全部 Critical 都被 当前会话 判定为同一大类系统性误判——即审查 agent 反复以"该轮 Critical 所依据的类型不属于当前命令的审查范畴"为由被 当前会话 判定不认可（例如 `/ly:review-plan` 连续 3 轮的 Critical 均以"代码库尚未实现该方案条目"为理由），不要求这 3 轮之间 Critical 的文件/类别/锚点互相一致, 只要求"判定为不认可的原因类型"在这 3 轮中一致

出现终止条件 2-6 中任一条时, 命令必须（SHALL）立即停止循环, 在报告中明确指出触发的具体条件、涉及的问题（文件、类别、锚点、判断依据）, 并说明需要人工介入, 不得继续自动修复；这些条件时命令 SHALL NOT 提交任何改动（见下方）——已产生的改动留在工作区交由人工处理。**终止报告的末尾 SHALL 附"下一步可用命令指引"**（如：可用 `@lyx-review-plan <change-name>` 重跑审查；`@lyx-apply` 暂不实施——按当前终止原因；改动保留在工作区，可先 `git diff` 查看），供用户在"断在明确节点、人工自行触发下一步"口径下续接。循环期间的 Warning 与 Info 发现不参与循环终止判定, 只在循环结束后的最终报告列出最后一轮的结果, 不跨轮次合并。

**下一轮 TASK 保持增量传递语义**：每一轮修复后, 下一轮任务必须（SHALL）包含上一轮全部 Critical 的逐字原文, 以及"本轮改动文件 + 上一轮全部 Critical 指向的文件"的路径清单（`/ly:review-plan` 场景下含 delta spec 文件）——即使某条未修改, 其指向的文件路径也要纳入, 否则审查 agent 无法读取当前内容判断问题是否仍存在。若某条上一轮 Critical 位置字段缺失可解析路径, 命令必须保守处理（一般是将该轮已知的兜底路径集合纳入清单, 不得静默丢弃）。若上一轮某条 Critical 指向的文件被删除或重命名, 路径清单改用新路径并说明状态变化。命令必须（SHALL）指示审查 agent 自行读取路径当前内容, 判断:（a）上轮各 Critical 是否已解决；（b）本轮改动是否引入新问题。未被"本轮改动"和"上一轮任一 Critical 指向"覆盖的文件 SHALL NOT 重新整段传入。subagent fork 的当前会话上下文提供连续性，但不替代 TASK 的逐字原文——每条 Critical 的逐字文本仍然要显式传, 避免审查 agent 依据模糊记忆断言。

**报告逐轮展示审查 agent 原始发现**：`/ly:review-code`/`/ly:review-plan` 的每一轮审查调用（包括首轮 Critical 为 0 不进入循环的情况）都必须在报告中包含独立区块, 逐字展示该轮双审查 subagent 返回的原始 Critical/Warning/Info 内容（不经概括、改写或合并）, 并与 当前会话 对该轮每条 Critical 的认可/不认可判定并排列出（若该轮无 Critical, 只展示原文）。该区块必须在该轮审查调用返回后于本轮报告呈现。

**报告格式**: 循环终止原因、总轮数、已修复的 Critical 摘要（含每轮改动文件清单）、最后一轮 Warning/Info。仅当全程无任何 Critical/Warning/Info 时才可以使用"未发现问题"表述；只要发现并修复过 Critical, 报告必须明确"本次已自动修复 N 个 Critical"。每条 Critical 摘要用相关人员易懂的语言概括问题与已做改动, 逐字原文区块作为补充材料并存。

**循环期间不提交, 仅在正常清零后统一提交一次**：每一轮修复完成、验证通过后, SHALL NOT 立即执行 git commit——改动保持在当前状态, 直到循环正常清零后由主会话统一提交一次（见"循环结束后统一提交"）；`--no-commit` 传入时连清零后的统一提交也不执行。循环期间发生任何中途提交（无论主会话手滑或外部因素）SHALL 如实报告，并仍以固定基线重新计算 `git diff <固定SHA>` 说明该中途 commit 是否落在审查范围内（核对 ≠ 替换基线），但不以此自动进入终止条件。

#### Change: 第 2 轮起改为"重新 spawn 全新审查 subagent + 增量 TASK"，删除"沿用同一批会话、SHALL NOT 重新 spawn"的跨轮续聊假设；终止报告补下一步可用命令指引；循环期间发生中途提交的如实报告口径。

#### Scenario: 第二轮重新 spawn 审查 subagent
- **WHEN** `/ly:review-plan` 第一轮发现 Critical 并修复，进入第二轮
- **THEN** 主会话重新 spawn 一对全新审查 subagent（fork 含上一轮结论与修复现状的上下文），TASK 增量携带第一轮全部 Critical 逐字原文与原路径清单，不假定第一轮 subagent 仍存活

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
- **WHEN** `/ly:review-plan` 第 2 轮重新 spawn 一对全新审查 subagent（fork 当前会话上下文）
- **THEN** TASK 仍只包含上一轮全部 Critical 逐字原文 + 路径清单（增量），不整段重新传入基线 artifact 全文；fork 的当前会话上下文提供连续性，不代表 TASK 可省略逐字 Critical 原文

### Requirement: 代码审查读取 git diff 并分级输出发现

`/ly:review-code` 必须（SHALL）以目标 change 的最近一期 `apply:` commit 作为审查基线（编排方 `@lyx-apply` 在实施完成后立即提交，提交信息为 `apply: <change-name>`）：先按目标 change 优先级解析 change（显式参数 → `openspec/changes/` 下唯一未归档 change → 询问用户），再用 `git log --grep="^apply: <change-name>"` 取 HEAD 侧最近一期匹配 commit；该 commit 存在时，审查范围 = 该 `apply:` commit 的差异（`git show <commit>`）+ 当前 `git diff HEAD` + `git status --porcelain` 过滤出的未跟踪路径清单，工作区/暂存区干净时仍按该 commit 审查，SHALL NOT 报"无变更可审查"。**首轮确定该 commit 后 SHALL 固定该 SHA 作为基线锚点**：后续轮次的工作区/暂存区差异一律以 `git diff <固定SHA>` 计算，SHALL NOT 在循环期间重新执行 `git log --grep` 或重算 HEAD 作基线。该 commit 不存在时，检查最近一期 `propose: <change-name>` commit（`git log --grep="^propose: <change-name>" -1`）：存在则审查范围 = 该 `propose:` commit 差异 + 当前 `git diff HEAD` + 未跟踪路径清单，工作区/暂存区干净时仍按该 commit 审查；首轮确定后同样固定该 SHA 为基线锚点，后续轮次以 `git diff <固定SHA>` 计算。两者都不存在时退化为"有未提交变更"组合：`git diff HEAD`（覆盖已暂存+未暂存）+ `??` 未跟踪路径清单；仓库零 commit（`git rev-parse HEAD` 失败）则使用三条固定命令组合表达审查范围：`git diff --cached` + `git diff` + `git status --porcelain` 过滤 `??` 得到的未跟踪路径清单，不得尝试执行 `git diff HEAD`、`git diff HEAD~1` 或 `git show HEAD`。仅在既无 `apply:`/`propose:` commit、工作区又无任何未提交变更时，命令才报告"无变更可审查"并直接结束。

无论采用上述哪种基线，命令必须（SHALL）额外用 `git status --porcelain` 抓取 `??` 开头的未跟踪文件路径，确保新建但未 `git add` 的文件不被漏审。审查执行方式由"审查关卡以双审查 subagent 执行"定义：两个并行审查 subagent fork 当前会话上下文，模型按 `codexHost.reviewModel`/`reviewModelB` 配置、未配置或空白时继承当前会话模型，对应推理档 `reviewReasoningEffort`/`reviewReasoningEffortB` 非空时随 spawn 传入；命令 SHALL NOT 使用 `codex exec`、`-m`、`session_id` 或 `resume`。首轮确定的审查范围必须（SHALL）被记录并供首轮 TASK 使用：只传基线引用说明（如"审查 `git show <commit>` 的差异"或三条零 commit 命令组合说明）和未跟踪文件路径清单，不把完整 diff 文本拼进 TASK；判定审查范围本身（选哪条分支、取哪个 commit）由当前会话完成，不下放给审查 subagent。第 2 轮起按"审查-修复循环与终止条件（review-code / review-plan 共用）"的增量语义继续，重新 spawn 一对全新审查 subagent（fork 当前会话上下文，上下文含上一轮结论与修复现状），TASK 仍只含上一轮全部 Critical 逐字原文与路径清单；主会话 SHALL NOT 依赖跨轮续聊（回合结束即失去 subagent 访问）。

命令必须（SHALL）将发现严格分为 Critical、Warning、Info 三个严重度层级。若存在 Critical，命令必须（SHALL）进入审查-修复循环。

#### Scenario: 存在 apply commit 且工作区干净, 仍按该 commit 审查
- **WHEN** 目标 change 存在最近一期 `apply:` commit, 当前工作区与暂存区都干净, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = 该 `apply:` commit 的差异, 命令按该差异审查并输出分级结果, SHALL NOT 报"无变更可审查"

#### Scenario: 无 apply commit 时退化为 propose commit
- **WHEN** 目标 change 尚无 `apply:` commit, 但存在最近一期 `propose:` commit, 当前工作区干净, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = 该 `propose:` commit 的差异, 命令按该差异审查并输出分级结果, SHALL NOT 回退到任意更早历史 commit

#### Scenario: 存在未提交变更且无 Critical
- **WHEN** 目标 change 无相关 `apply:`/`propose:` commit, 当前工作区存在未提交变更, 审查 subagent 审查后未发现任何 Critical
- **THEN** 审查范围 = `git diff HEAD` + 未跟踪文件路径清单, 发现按 Critical/Warning/Info 分级输出, 命令直接结束, 不进入修复循环

#### Scenario: 工作区干净但有历史提交, 报告无变更
- **WHEN** 目标 change 既无 `apply:` commit 也无 `propose:` commit, 仓库有 HEAD 且当前工作区与暂存区都干净, 用户运行 `/ly:review-code`
- **THEN** 命令报告"无变更可审查"并直接结束, SHALL NOT 审查 `git diff HEAD~1` 或 `git show HEAD`

#### Scenario: 已跟踪的修改与新建的未跟踪文件同时存在
- **WHEN** 目标 change 无相关 commit, 工作区既有已跟踪文件的修改, 也有新建的未跟踪文件, 用户运行 `/ly:review-code`
- **THEN** 审查范围 = `git diff HEAD` + 未跟踪文件路径清单; TASK 只包含基线引用说明和未跟踪路径, 审查 subagent 自行读取实际内容, 未跟踪文件不被静默遗漏

#### Scenario: 仓库尚无任何 commit
- **WHEN** 目标 change 无相关 commit, 且 `git rev-parse HEAD` 失败, 用户运行 `/ly:review-code`
- **THEN** 审查范围用 `git diff --cached` + `git diff` + 未跟踪路径清单三条固定命令表达, 不因缺失 HEAD 报错; TASK 只传命令组合说明, 不由当前会话把内容整段贴入

#### Scenario: 仓库只有一个 commit 且工作区干净
- **WHEN** 目标 change 无相关 `apply:`/`propose:` commit, 仓库只有一个不匹配该 change 的历史 commit 且工作区干净, 用户运行 `/ly:review-code`
- **THEN** 命令报告"无变更可审查"并直接结束, SHALL NOT 审查该单个 commit 的完整内容

#### Scenario: 无发现
- **WHEN** 审查 subagent 没有返回任何问题
- **THEN** 命令明确说明未发现问题, 而不是保持沉默

#### Scenario: 首轮 TASK 不预先拼贴完整 diff 文本
- **WHEN** 首轮按某 `apply:` commit 确定审查范围, 且该 commit 差异有数百行
- **THEN** 传给审查 subagent 的 TASK 只包含基线引用说明及未跟踪路径清单, 不包含当前会话预读拼接的完整 diff; 审查 subagent 自行执行对应命令获取实际内容

#### Scenario: 审查模型未配置时回退当前会话模型
- **WHEN** 用户未配置 `codexHost.reviewModel` 或 `reviewModelB`（或配置为空白）, 然后运行 `/ly:review-code`
- **THEN** 对应审查 agent 的模型回退继承当前会话模型; spawn SHALL NOT 携带 shell 层 `-m` 参数

#### Scenario: 推理档未配置时不传; 非空时随对应模型传入
- **WHEN** 用户运行 `/ly:review-code`, `reviewReasoningEffort` 为空白而 `reviewReasoningEffortB = "low"`
- **THEN** 审查 agent A 不传推理档参数, 审查 agent B 以 `reviewReasoningEffortB` 的 trim 后原值随 `reviewModelB` 传入 `reasoning_effort`, SHALL NOT 使用任何模型名到档位的硬编码映射

#### Scenario: 第 2 轮以 resume 模式续聊同一会话
- **WHEN** `/ly:review-code` 首轮存在未清零 Critical, 循环进入第 2 轮
- **THEN** 第 2 轮重新 spawn 一对全新审查 subagent（fork 当前会话上下文）, TASK 只包含上一轮全部 Critical 逐字原文与路径清单; SHALL NOT 构造 shell 层 `codex exec resume <session_id>`，也不重新拼贴完整基线 diff, 不依赖上一轮 subagent 会话存活

#### Change: 审查范围补基线锚定（首轮固定 commit SHA）；第 2 轮改为重新 spawn 审查 subagent，不依赖跨轮续聊。
