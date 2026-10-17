## MODIFIED Requirements

### Requirement: 快照文件的位置与格式

审查未修项快照 SHALL 位于 `openspec/changes/<change-name>/review-findings.md`，采用单文件两节结构：`## 方案审查`（来源 `@lyx-review-plan`）与 `## 代码审查`（来源 `@lyx-review-code`）。快照 SHALL 只收录**未被自动修复的 Warning**——SHALL NOT 收录 Info，SHALL NOT 收录 Critical。**收录口径自 `add-autofixable-warning-axis` 起按「可自动修复」标注细分**：标注为「否」的 Warning 一律收录；标注为「是」但因非正常终止（熔断 / 驳回硬线 / 无法安全修复 / 修复无法落盘 / 审查调用失败 / 达到轮数上限 / 审查对象类型持续系统性误判）、`--no-commit`、统一 commit 失败或首轮「是」条目在次轮复审仍存在而降级等原因**未被修完**的，SHALL 照样收录；标注为「是」且已在本 change 内修复并进入统一 commit 的，SHALL NOT 收录。未修的 Critical SHALL NOT 被收录，Info 一律不收录。每节 SHALL 记录该审查类型**最近一轮**未被自动修复的发现，逐字保留该轮审查发现的原文与位置、问题、建议，并附轮次与基线元信息（执行轮次、记录时间、基线 commit 引用或明确的基线状态）。"该轮审查发现的原文"按执行者路径取值：`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文，`reviewExecutor = "main"`（默认）时为主 agent 在本轮审查报告中产出的原文——SHALL NOT 因 main 路径不存在 subagent 而跳过记录或虚构 subagent 原文。两节内的 Warning 条目 SHALL 使用从 1 起的连续编号，作为 `<归档路径>#<节名>#<序号>` 解决说明锚点的定位基础。每节 SHALL 采用最小结构：先写元信息（轮次 / 记录时间 / 基线），再写顶层编号 Warning 条目 `1. [<位置>] — <问题>`，其问题细节与 `建议:` 作为该条目的 3 空格缩进行；后续追加的 `- 解决：...` 作为缩进子项。解决子项 SHALL NOT 计入 Warning 计数，SHALL NOT 触发编号重排。读取归档前写入、没有显式编号的旧快照时，序号 SHALL 按节内顶层 Warning 条目的出现顺序从 1 起定位；无法唯一解析时按锚点无法解析处理。快照 SHALL NOT 引入 open/closed 状态字段，SHALL NOT 承担状态流转或自动关闭职责；但 SHALL 允许后续 change 以追加式解决说明留下"已解决"记录（见「追加式解决说明」Requirement）——该说明只增不改，不构成状态。某一节零未收录条目时 SHALL NOT 写该节；两节都为空时 SHALL NOT 创建文件。

#### Scenario: 有 Warning 时按节写入

- **WHEN** 某 change 的审查循环结束时该类型审查的最后一轮存在两条未被自动修复的 Warning
- **THEN** 快照对应节记录这两条 Warning 的逐字原文（位置 + 问题 + 建议）与轮次/基线元信息，不写入其他内容

#### Scenario: Warning 条目连续编号

- **WHEN** 某节记录两条或更多 Warning
- **THEN** 条目按出现顺序使用 1、2、3 的连续编号，供 `#<节名>#<序号>` 锚点稳定定位

#### Scenario: 快照条目最小结构

- **WHEN** 某节写入 Warning 条目
- **THEN** 该节先写元信息，再写 `1. [<位置>] — <问题>` 形式的顶层条目，`建议:` 与问题细节为 3 空格缩进行；后续 `- 解决：...` 为缩进子项且不计入 Warning 计数

#### Scenario: 旧快照无显式编号时按出现顺序定位

- **WHEN** 归档回写读取一份归档前写入、没有显式编号的旧快照
- **THEN** 序号按节内顶层 Warning 条目的出现顺序从 1 起定位；无法唯一解析时按锚点无法解析处理（跳过并如实报告）

#### Scenario: 某节零 Warning 时不写该节

- **WHEN** 某 change 的 review-plan 最后一轮存在 1 条未被自动修复的 Warning，而 review-code 最后一轮的 Warning 全部已自动修复
- **THEN** 快照只包含 `## 方案审查` 节，SHALL NOT 写入空的 `## 代码审查` 节

#### Scenario: 两节都为空时不创建文件

- **WHEN** 某 change 的 review-plan 与 review-code 最后一轮都没有未被自动修复的 Warning
- **THEN** 不创建 `review-findings.md` 文件

#### Scenario: 只收 Warning 不收 Info 与 Critical

- **WHEN** 某轮审查同时返回 Critical、Warning 与 Info，其中部分 Warning 标注为「是」且已修复
- **THEN** 快照只收录未被自动修复的 Warning；已修复的「是」条目、Critical 与 Info 均不写入快照

#### Scenario: 标注为「是」且已修复的条目不入快照

- **WHEN** 首轮 1 条「是」Warning 经当前会话修复，第 2 轮审查确认已解决，循环以正常清零结束并完成统一 commit
- **THEN** 该条目 SHALL NOT 出现在快照中（其修复已随统一 commit 落库）

#### Scenario: 标注为「是」但未修完的条目照常入快照

- **WHEN** 循环因达到全局轮数上限终止，最后一轮仍存在 1 条标注为「是」但未修复的 Warning
- **THEN** 快照收录该条 Warning 的逐字原文（含其「是」标注），并在元信息中如实记录终止后的基线状态

#### Scenario: 首轮「是」条目降级后入快照

- **WHEN** 首轮 1 条「是」条目在次轮审查仍被判定存在而被降级为「否」
- **THEN** 该条以「否」的最终取值写入快照，SHALL NOT 因它曾是「是」而被排除

### Requirement: 审查关卡在循环结束时按节写入快照

`@lyx-review-plan` 与 `@lyx-review-code` SHALL 在审查-修复循环结束时按节 upsert 写入快照——替换本类型旧节、保留另一节。重跑同类审查后该类型**无可收录条目**（即未被自动修复的 Warning 数为 0）时 SHALL 移除该类型旧节（SHALL NOT 保留过期内容）：移除后若另一节仍存在则文件保留，若两节均不存在则删除该文件。写入时机 SHALL 为循环结束后：正常清零场景 SHALL 在统一 commit **之后**写入（快照保持未跟踪状态，SHALL NOT 进入该 commit）；非正常终止场景（熔断 / 驳回硬线 / 无法安全修复 / 修复无法落盘 / 审查调用失败 / 达到轮数上限 / 审查对象类型持续系统性误判）SHALL 照写。`--no-commit`、统一 commit 失败、本轮无实际改动不建 commit 等场景下 SHALL 照写快照，并在元信息中如实记录基线状态，SHALL NOT 为快照补建 commit。SHALL NOT 在循环进行中逐轮写入——快照只承载最后一轮结论。快照文件缺失容错：写入前不存在该文件时 SHALL 创建，存在时 SHALL 只替换本类型节。非正常终止时未修的 Critical SHALL NOT 写入快照。

#### Scenario: 正常清零后在统一 commit 之后写入

- **WHEN** review-code 循环以正常清零结束并执行了统一 commit
- **THEN** 快照在 commit 之后写入，保持未跟踪状态，该 commit 的文件集合不含 `review-findings.md`

#### Scenario: 非正常终止时照写 Warning 快照

- **WHEN** review-code 循环以熔断终止，最后一轮存在 2 条未被自动修复的 Warning、若干个未修 Critical
- **THEN** 快照写入这 2 条 Warning，SHALL NOT 写入未修的 Critical

#### Scenario: 按节 upsert 保留另一节

- **WHEN** review-plan 已写入 `## 方案审查` 节，随后 review-code 写入 `## 代码审查` 节
- **THEN** `## 方案审查` 节内容保持不变，只新增/替换 `## 代码审查` 节

#### Scenario: 重跑同类审查刷新该节

- **WHEN** 某 change 已存在快照，用户再次运行 review-code 并产生新的一轮未被自动修复的 Warning
- **THEN** `## 代码审查` 节被最后一轮结果替换，`## 方案审查` 节不受影响

#### Scenario: 重跑后该类零 Warning 时移除旧节

- **WHEN** 某 change 已存在含 `## 代码审查` 节的快照，重跑 review-code 后该类 Warning 全部已被自动修复（即无可收录条目）
- **THEN** `## 代码审查` 旧节被移除；若 `## 方案审查` 节仍存在则保留文件，若两节都不存在则删除该文件，SHALL NOT 保留过期的旧节内容

#### Scenario: main 执行者路径下记录主 agent 审查原文

- **WHEN** 未配置 `reviewExecutor`（等价 `main`），review-plan 循环结束时最后一轮存在未被自动修复的 Warning
- **THEN** 快照记录主 agent 本轮审查报告中产出的原文，SHALL NOT 因不存在审查 subagent 而跳过记录或虚构 subagent 原文

#### Scenario: 自动修条目不导致该节残留

- **WHEN** 某 change 既有快照含 `## 代码审查` 节，重跑 review-code 后最后一轮仅存在若干标注为「是」且已在本轮修复的 Warning
- **THEN** 该类型无可收录条目，`## 代码审查` 节按上一条 Scenario 被移除，SHALL NOT 因"本轮曾出现 Warning"而保留旧节
