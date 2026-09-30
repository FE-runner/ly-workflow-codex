# review-findings-snapshot Specification

## Purpose

定义 change 目录下 `review-findings.md` 审查未修项快照的完整生命周期：审查关卡循环结束时按节写入、随归档 commit 落库、后续 change 可在已归档快照上追加解决说明、同一 change 内的修复可在 active 快照上追加"未复审"就地标注（审查后同会话修复或归档前核对）、后续 change 可在已归档快照上追加复审说明（结论成立 / 不成立）、`@lyx-explore` 先询问后列出。它是快照式留痕（供事后回看某次审查提出过哪些未处理的 Warning 及其后续解决与复审情况），允许追加式解决说明与复审说明，但不承担状态跟踪或自动关闭职责。

## Requirements

### Requirement: 快照文件的位置与格式

审查未修项快照 SHALL 位于 `openspec/changes/<change-name>/review-findings.md`，采用单文件两节结构：`## 方案审查`（来源 `@lyx-review-plan`）与 `## 代码审查`（来源 `@lyx-review-code`）。快照 SHALL 只收录 Warning——SHALL NOT 收录 Info，SHALL NOT 收录 Critical。每节 SHALL 记录该审查类型**最近一轮**未被自动修复的发现，逐字保留该轮审查发现的原文与位置、问题、建议，并附轮次与基线元信息（执行轮次、记录时间、基线 commit 引用或明确的基线状态）。"该轮审查发现的原文"按执行者路径取值：`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文，`reviewExecutor = "main"`（默认）时为主 agent 在本轮审查报告中产出的原文——SHALL NOT 因 main 路径不存在 subagent 而跳过记录或虚构 subagent 原文。两节内的 Warning 条目 SHALL 使用从 1 起的连续编号，作为 `<归档路径>#<节名>#<序号>` 解决说明锚点的定位基础。每节 SHALL 采用最小结构：先写元信息（轮次 / 记录时间 / 基线），再写顶层编号 Warning 条目 `1. [<位置>] — <问题>`，其问题细节与 `建议:` 作为该条目的 3 空格缩进行；后续追加的 `- 解决：...` 作为缩进子项。解决子项 SHALL NOT 计入 Warning 计数，SHALL NOT 触发编号重排。读取归档前写入、没有显式编号的旧快照时，序号 SHALL 按节内顶层 Warning 条目的出现顺序从 1 起定位；无法唯一解析时按锚点无法解析处理。快照 SHALL NOT 引入 open/closed 状态字段，SHALL NOT 承担状态流转或自动关闭职责；但 SHALL 允许后续 change 以追加式解决说明留下"已解决"记录（见「追加式解决说明」Requirement）——该说明只增不改，不构成状态。某一节零 Warning 时 SHALL NOT 写该节；两节都为空时 SHALL NOT 创建文件。

#### Scenario: 有 Warning 时按节写入

- **WHEN** 某 change 的审查循环结束时该类型审查的最后一轮存在两条 Warning
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

- **WHEN** 某 change 的 review-plan 最后一轮存在 1 条 Warning，而 review-code 最后一轮零 Warning
- **THEN** 快照只包含 `## 方案审查` 节，SHALL NOT 写入空的 `## 代码审查` 节

#### Scenario: 两节都为空时不创建文件

- **WHEN** 某 change 的 review-plan 与 review-code 最后一轮都没有 Warning
- **THEN** 不创建 `review-findings.md` 文件

#### Scenario: 只收 Warning 不收 Info 与 Critical

- **WHEN** 某轮审查同时返回 Critical、Warning 与 Info
- **THEN** 快照只收录 Warning；Critical 由修复循环处理、Info 不写入快照

### Requirement: 审查关卡在循环结束时按节写入快照

`@lyx-review-plan` 与 `@lyx-review-code` SHALL 在审查-修复循环结束时按节 upsert 写入快照——替换本类型旧节、保留另一节。重跑同类审查后该类型 Warning 为零时 SHALL 移除该类型旧节（SHALL NOT 保留过期内容）：移除后若另一节仍存在则文件保留，若两节均不存在则删除该文件。写入时机 SHALL 为循环结束后：正常清零场景 SHALL 在统一 commit **之后**写入（快照保持未跟踪状态，SHALL NOT 进入该 commit）；非正常终止场景（熔断 / 驳回硬线 / 无法安全修复 / 修复无法落盘 / 审查调用失败 / 达到轮数上限 / 审查对象类型持续系统性误判）SHALL 照写。`--no-commit`、统一 commit 失败、本轮无实际改动不建 commit 等场景下 SHALL 照写快照，并在元信息中如实记录基线状态，SHALL NOT 为快照补建 commit。SHALL NOT 在循环进行中逐轮写入——快照只承载最后一轮结论。快照文件缺失容错：写入前不存在该文件时 SHALL 创建，存在时 SHALL 只替换本类型节。非正常终止时未修的 Critical SHALL NOT 写入快照。

#### Scenario: 正常清零后在统一 commit 之后写入

- **WHEN** review-code 循环以正常清零结束并执行了统一 commit
- **THEN** 快照在 commit 之后写入，保持未跟踪状态，该 commit 的文件集合不含 `review-findings.md`

#### Scenario: 非正常终止时照写 Warning 快照

- **WHEN** review-code 循环以熔断终止，最后一轮存在 2 条 Warning、若干个未修 Critical
- **THEN** 快照写入这 2 条 Warning，SHALL NOT 写入未修的 Critical

#### Scenario: 按节 upsert 保留另一节

- **WHEN** review-plan 已写入 `## 方案审查` 节，随后 review-code 写入 `## 代码审查` 节
- **THEN** `## 方案审查` 节内容保持不变，只新增/替换 `## 代码审查` 节

#### Scenario: 重跑同类审查刷新该节

- **WHEN** 某 change 已存在快照，用户再次运行 review-code 并产生新的一轮 Warning
- **THEN** `## 代码审查` 节被最后一轮结果替换，`## 方案审查` 节不受影响

#### Scenario: 重跑后该类零 Warning 时移除旧节

- **WHEN** 某 change 已存在含 `## 代码审查` 节的快照，重跑 review-code 后该类 Warning 为零
- **THEN** `## 代码审查` 旧节被移除；若 `## 方案审查` 节仍存在则保留文件，若两节都不存在则删除该文件，SHALL NOT 保留过期的旧节内容

#### Scenario: main 执行者路径下记录主 agent 审查原文

- **WHEN** 未配置 `reviewExecutor`（等价 `main`），review-plan 循环结束时最后一轮存在 Warning
- **THEN** 快照记录主 agent 本轮审查报告中产出的原文，SHALL NOT 因不存在审查 subagent 而跳过记录或虚构 subagent 原文

### Requirement: 快照写入失败不改变审查结论

`@lyx-review-plan` / `@lyx-review-code` 在循环结束后写入快照失败时（change 目录不可写、磁盘错误、路径被占用等），SHALL 如实报告写入失败与原始错误，SHALL NOT 因此改变本轮审查结论——Critical 是否清零、是否执行统一提交均不受快照写入结果影响；SHALL NOT 为写入快照而重试、回滚已完成的提交或改变终止判定。快照缺失只是留痕丢失，SHALL NOT 被当作审查失败。

#### Scenario: 写快照失败如实报告且不影响审查结论

- **WHEN** review-code 正常清零并已执行统一 commit，随后写 `review-findings.md` 时因目录不可写失败
- **THEN** 命令如实报告写入失败与原始错误，已完成的统一 commit 不回滚，本轮审查结论仍为"正常清零"

### Requirement: 快照随归档落库

`@lyx-archive` 现有的 `git add -- openspec/` SHALL 覆盖 change 目录下的快照，使其随归档 commit 落库，并随 change 目录搬入 `openspec/changes/archive/<日期>-<change-name>/`——SHALL NOT 依赖任何额外的归档专门步骤。审查阶段已写快照（未跟踪），archive 阶段 SHALL NOT 重新生成或重建**当前 change 的快照内容**；归档前核对按「本 change 内修复标注」Requirement 追加的就地标注只追加解决子项、不改动原 Warning 条目，SHALL NOT 被视为重新生成或重建。此外，`@lyx-archive` MAY 按「追加式解决说明」与「追加式复审说明」Requirement 向**更早 change 的已归档快照**追加解决说明或复审说明——该追加不是对当前 change 快照的重新生成或重建，且 SHALL 复用同一次归档提交。未归档的 change 其快照 SHALL 保持未跟踪状态：除 review-plan / apply / review-code 的提交外，lyx 模板中的**全量暂存路径**（`@lyx-commit --all` 在暂存区为空时的全量暂存、`@lyx-propose` 切分支 / 留在当前分支前的 WIP commit）SHALL 排除进行中 change 目录下的 `review-findings.md`（仅匹配 `openspec/changes/<change-name>/review-findings.md` 一层，SHALL NOT 波及 `archive/` 下已跟踪的快照），SHALL NOT 将其提前纳入提交。脏改动检测（如 propose 的 `git status --porcelain` 处置询问）SHALL 同样忽略这类未跟踪快照；排除后暂存区为空时 SHALL 跳过提交并如实说明，SHALL NOT 以"nothing to commit"报错中断编排。排除后该路径保持未跟踪；若快照已被意外跟踪，命令 SHALL 如实报告，SHALL NOT 自动 `git rm --cached` 或改写历史。

#### Scenario: 归档后快照进入 archive 目录

- **WHEN** 某 change 存在未跟踪的 `review-findings.md`，用户运行 `@lyx-archive` 成功归档
- **THEN** 该文件随归档 commit 落库，并出现在 `openspec/changes/archive/<日期>-<change-name>/review-findings.md`

#### Scenario: 追加解决说明不重建当前快照

- **WHEN** `@lyx-archive` 为历史快照追加解决说明，同时当前 change 带有自己的未跟踪快照
- **THEN** 当前 change 的快照原样搬入 archive、不被重新生成；历史快照的追加与当前快照的落库在同一次归档 commit 内完成

#### Scenario: 归档前就地标注不视为重建

- **WHEN** `@lyx-archive` 归档前核对为当前 change 快照中的 1 条 Warning 追加就地标注
- **THEN** 该快照除新增的解决子项外逐字不变，随归档 commit 一并落库

#### Scenario: 未归档的 change 快照保持未跟踪

- **WHEN** 某 change 已写入快照但尚未归档
- **THEN** 快照保持未跟踪状态，不因 review-plan / apply / review-code 的提交而被提前纳入

#### Scenario: lyx-commit --all 排除进行中快照

- **WHEN** 某 change 留有未跟踪的 `review-findings.md`，用户在暂存区为空时运行 `@lyx-commit --all`
- **THEN** 命令全量暂存其余改动，但该快照 SHALL NOT 被暂存，提交后仍保持未跟踪

#### Scenario: propose WIP commit 排除其他进行中 change 的快照

- **WHEN** 另一个进行中的 change 留有未跟踪快照，用户运行 `@lyx-propose` 并选择 WIP commit 处置脏改动
- **THEN** WIP commit 纳入其余改动，但该快照 SHALL NOT 被纳入

#### Scenario: 仅有进行中快照改动时不中断

- **WHEN** 工作区唯一的改动是另一个进行中 change 的未跟踪 `review-findings.md`，用户运行 `@lyx-propose` 或 `@lyx-commit --all`
- **THEN** propose 视工作区为干净、不发出脏改动询问；`@lyx-commit --all` 暂存后暂存区为空，如实说明没有可提交的改动并结束，SHALL NOT 执行 `git commit` 报错

#### Scenario: 全量暂存排除不波及已归档快照

- **WHEN** 已归档快照 `openspec/changes/archive/<日期>-<name>/review-findings.md` 在工作区有改动，用户运行 `@lyx-commit --all`
- **THEN** 排除规则不匹配该路径，按常规全量暂存处理

### Requirement: 追加式解决说明

当且仅当某 change 在其 `proposal.md` 的 `## 解决的审查未修项` 小节显式声明解决了历史 `review-findings.md` 中的 Warning 时，`@lyx-archive` SHALL 在归档该 change 时把对应解决说明追加到**已归档**快照的对应 Warning 条目之下。快照生命周期 SHALL 分三段：active（`openspec/changes/<change-name>/`）→ OpenSpec archive 把 change 移入 `openspec/changes/archive/<日期>-<change-name>/` → 归档 commit 后**原 Warning 原文与编号冻结**，冻结后仅允许追加式解决说明与追加式复审说明（见「追加式复审说明」Requirement），SHALL NOT 有其他写入；解决说明的写入 SHALL 发生在第二段末尾、归档 commit 之前，SHALL NOT 被理解为"必须在归档 commit 之后写入"。`@lyx-archive` SHALL 从归档后目录读取该 change 的 `proposal.md`（`openspec/changes/archive/<日期>-<change-name>/proposal.md`），SHALL NOT 继续使用已不存在的 active 路径 `openspec/changes/<change-name>/proposal.md`。解决说明 SHALL 采用 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>` 形式，作为该 Warning 顶层条目的缩进子项（序号仅用于引用与计数，不要求原条目已有显式编号）；原 Warning 的位置、问题、建议原文 SHALL 逐字保持不变，SHALL NOT 改写、删除或重排编号。引用 SHALL 采用 `<归档快照路径>#<节名>#<序号>`，节名仅允许 `方案审查` / `代码审查`，序号为该节 Warning 条目的 1 起编号。引用 SHALL 指向已归档快照（`openspec/changes/archive/**/review-findings.md`）；**跨 change** 的解决说明引用 active（未归档）快照 SHALL 逐条拒绝并如实报告，SHALL NOT 写入未归档快照、SHALL NOT 因此阻断归档——该限制只约束本 Requirement 的跨 change 回写，SHALL NOT 禁止「本 change 内修复标注」Requirement 对本 change 自身 active 快照的就地标注。同一 Warning 下已存在同一 `<change-name>` 的解决说明时 SHALL NOT 重复追加；多个 change 解决同一 Warning 时 SHALL 按归档先后追加多行。引用 active 快照、锚点无法解析（节名非法、序号越界、目标文件缺失或不可读）、或锚点有效但追加写入失败（磁盘错误、权限错误、文件被占用等）时，SHALL 逐条跳过并如实报告原因，SHALL NOT 阻断归档、SHALL NOT 改写其他条目、SHALL NOT 改写 active 快照、SHALL NOT 猜测性匹配；其余条目照常处理。解决说明的写入 SHALL 使其随既有 `git add -- openspec/` 一并落库；SHALL NOT 为其新增独立提交或独立归档步骤。解决说明 SHALL NOT 引入 open/closed 状态字段、查询接口或自动关闭流程——它只是留痕，不改变 `@lyx-explore` 的扫描与询问流程。

#### Scenario: 声明后归档追加解决说明

- **WHEN** 某 change 的 `proposal.md` 声明解决了 `openspec/changes/archive/2026-09-23-review-findings-snapshot/review-findings.md#代码审查#2`，`@lyx-archive` 归档该 change
- **THEN** 归档前在该 Warning 条目之下追加 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>`，并随归档 commit 落库

#### Scenario: 归档后从归档目录读取 proposal.md

- **WHEN** `@lyx-archive` 已把 change 移入 `openspec/changes/archive/<日期>-<change-name>/` 并开始回写
- **THEN** 命令从归档后目录读取 `proposal.md`，SHALL NOT 访问已不存在的 `openspec/changes/<change-name>/proposal.md`

#### Scenario: 原 Warning 原文逐字不变

- **WHEN** `@lyx-archive` 为某条 Warning 追加解决说明
- **THEN** 该条目的位置、问题、建议原文与编号保持逐字不变，只有解决说明作为缩进子项被追加

#### Scenario: 同一条目幂等不重复

- **WHEN** 同一 change 的声明被重复处理（如归档重跑），该 Warning 下已存在同一 `<change-name>` 的解决说明
- **THEN** 命令跳过该条，SHALL NOT 追加第二条相同来源的解决说明

#### Scenario: 多个 change 解决同一 Warning

- **WHEN** change A 与 change B 先后声明解决同一条 Warning
- **THEN** 该条目下按归档先后追加两行解决说明，原有说明不被覆盖

#### Scenario: 引用 active 快照被拒绝

- **WHEN** `proposal.md` 引用 `openspec/changes/<未归档-change>/review-findings.md#方案审查#1`
- **THEN** 命令逐条拒绝该条并如实报告"仅可引用已归档快照"，SHALL NOT 写入未归档快照，SHALL NOT 因此阻断归档

#### Scenario: 跨 change 限制不影响本 change 就地标注

- **WHEN** 某 change 在归档前核对中为自身 active 快照追加就地标注，同时其 `proposal.md` 声明了历史已归档快照的解决项
- **THEN** 就地标注照常写入本 change 快照，跨 change 声明照常回写历史已归档快照，二者互不影响

#### Scenario: 追加写入失败逐条跳过且不阻断归档

- **WHEN** 锚点可解析、目标文件可读，但追加写入因磁盘错误 / 权限错误 / 文件被占用失败
- **THEN** 命令逐条跳过并如实报告失败原因，不改变归档结论，其余条目照常处理

#### Scenario: 锚点无法解析时跳过且不阻断归档

- **WHEN** `proposal.md` 引用的节名非法、序号越界或目标文件缺失
- **THEN** 命令跳过该条并如实报告原因，其余条目照常处理，归档流程 SHALL NOT 因该条失败而中断

#### Scenario: 无声明时不追加

- **WHEN** 某 change 的 `proposal.md` 没有 `## 解决的审查未修项` 小节
- **THEN** `@lyx-archive` SHALL NOT 修改任何历史快照，归档流程与现有行为一致

#### Scenario: 归档 commit 包含解决说明

- **WHEN** 解决说明已成功追加，`@lyx-archive` 执行归档 commit
- **THEN** 该说明随既有 `git add -- openspec/` 一并提交，SHALL NOT 产生独立提交

### Requirement: @lyx-explore 先询问后列出快照

`@lyx-explore` 进入时 SHALL 扫描 active（`openspec/changes/*/review-findings.md`）与 archive（`openspec/changes/archive/*/review-findings.md`）两个位置的快照。存在命中时 SHALL **先询问**用户是否列出，SHALL NOT 直接列出；用户同意后 SHALL 按 change 分组展示（change 名、各节 Warning 计数、其中已标注解决的条数、已标注解决条目中的"未复审"条数与"复审未通过"条数、一行摘要），active 的快照标注"进行中"、archive 的标注归档日期。"已标注解决"按 Warning 条目计（该条目下至少一条 `- 解决：` 子项即计 1，无论来源是跨 change 解决说明还是本 change 内就地标注；复审说明 SHALL NOT 计入）；"未复审"按 Warning 条目计（该条目下至少一条带"未复审"的就地标注、且**没有任何**复审说明即计 1）；"复审未通过"按 Warning 条目计（该条目**最后一条**复审说明结论为"不成立"即计 1）；"未复审"与"复审未通过"互斥，最后一条复审结论为"成立"的条目两者均不计。两者均为 0 时 SHALL 省略对应括注。个别快照读取失败时 SHALL 跳过该条并如实注明，SHALL NOT 中断扫描或虚构内容。用户拒绝列出、或扫描无命中时 SHALL NOT 展示任何快照内容，直接进入正常探索讨论。该询问与列出 SHALL 发生在委托 `opsx:explore` 之前，且 SHALL NOT 改变 `$ARGUMENTS` 的原样转发。

#### Scenario: 有命中时先询问

- **WHEN** 用户运行 `@lyx-explore`，扫描发现 2 个 change 留有快照
- **THEN** 命令先询问"是否列出审查未修项快照"，SHALL NOT 在询问前直接列出内容

#### Scenario: 用户同意后按 change 分组列出

- **WHEN** 用户对上述询问回答"是"
- **THEN** 命令按 change 分组展示各快照（change 名 + 方案/代码审查各自的 Warning 计数 + 其中已标注解决的条数 + 一行摘要），用户可进一步要求展开原文

#### Scenario: 已标注解决的条目在列出时可见

- **WHEN** 某归档快照的 `## 代码审查` 节共 3 条 Warning，其中 1 条带解决说明
- **THEN** 列出时显示该节 `3 条 Warning，其中 1 条已标注解决`，SHALL NOT 改变先询问后列出的流程

#### Scenario: 未复审条数在列出时可见

- **WHEN** 某快照的 `## 代码审查` 节共 3 条 Warning，3 条均带"本 change 内修复（未复审，…）"就地标注且都没有复审说明
- **THEN** 列出时显示该节 `3 条 Warning，其中 3 条已标注解决（3 条未复审）`

#### Scenario: 复审成立后不再计为未复审

- **WHEN** 某快照的 `## 方案审查` 节共 3 条 Warning，均带"未复审"就地标注，其中 2 条最后一条复审说明结论为"成立"、1 条为"不成立"
- **THEN** 列出时显示该节 `3 条 Warning，其中 3 条已标注解决（1 条复审未通过）`，SHALL NOT 显示未复审条数

#### Scenario: 复审说明不计入已标注解决

- **WHEN** 某 Warning 条目下只有复审说明、没有 `- 解决：` 子项（如历史手工编辑所致）
- **THEN** 该条目 SHALL NOT 计入"已标注解决"

#### Scenario: 用户拒绝列出

- **WHEN** 用户对询问回答"否"
- **THEN** 命令不展示任何快照内容，直接进入正常探索讨论

#### Scenario: 无命中时不询问

- **WHEN** 用户运行 `@lyx-explore`，active 与 archive 下都没有快照
- **THEN** 命令 SHALL NOT 发出该询问，直接进入正常探索讨论

#### Scenario: 个别快照不可读时跳过并注明

- **WHEN** 用户运行 `@lyx-explore`，扫描命中 2 个快照，其中 1 个无法读取
- **THEN** 命令跳过该条并如实注明读取失败，其余快照照常处理，SHALL NOT 中断扫描或虚构其内容

### Requirement: 本 change 内修复标注

当某 change 快照中的 Warning 在**同一 change 内**被修复并已提交时，SHALL 允许在该 change 的 **active** 快照（`openspec/changes/<change-name>/review-findings.md`）对应 Warning 顶层条目之下追加缩进子项 `- 解决：本 change 内修复（未复审，commit <短 hash>）— <一句说明>`。该标注 SHALL 满足：

- **必须引用已存在的修复 commit**：`<短 hash>` SHALL 指向当前仓库中可解析的 commit；修复尚未提交（仅存在于工作区）时 SHALL NOT 标注。
- **固定"未复审"**：就地标注 SHALL 一律带"未复审"字样——同一 change 内重跑同类审查会整节替换快照，因此就地标注在定义上都未经复审；SHALL NOT 产出不带"未复审"的就地标注变体。
- **幂等**：同一 Warning 下已存在引用同一 commit 的就地标注时 SHALL 跳过，SHALL NOT 重复追加；同一 Warning 被多次修复时按提交先后追加多行。
- **原文不变**：原 Warning 的位置 / 问题 / 建议原文与编号 SHALL 逐字保持不变，SHALL NOT 改写、删除或重排；就地标注 SHALL NOT 计入 Warning 计数、SHALL NOT 触发编号重排。
- **不新增提交**：就地标注只改工作区中未跟踪的快照文件，SHALL NOT 为其单独 commit；快照随 `@lyx-archive` 既有的 `git add -- openspec/` 落库。
- **与 upsert 的交互**：之后重跑同类审查时该节按既有 upsert 规则被最后一轮结果整体替换，已有就地标注随旧节一并消失，SHALL NOT 为保留就地标注而合并新旧节。
- **无状态**：SHALL NOT 引入 open/closed 状态字段、查询接口或自动关闭流程。
- **失败容错**：写入失败（目录不可写、文件被占用等）或目标条目无法唯一定位时 SHALL 逐条跳过并如实报告原因，SHALL NOT 猜测性匹配，SHALL NOT 改变审查结论或阻断归档。

就地标注的触发点 SHALL 只有以下两个，SHALL NOT 在其他命令（如 `@lyx-commit`）中自动推断：

1. **审查后同会话修复**：`@lyx-review-plan` / `@lyx-review-code` 写完快照后，同一会话内用户要求修复快照中的 Warning，修复提交完成之后，SHALL 先列出拟标注的条目编号与对应 commit 由用户确认一次，再为被该提交修复的条目追加就地标注，并在报告中列出已标注的条目编号。该修复提交 SHALL 只按路径暂存修复文件，SHALL NOT 把未跟踪的 `review-findings.md` 纳入；快照已被意外跟踪时 SHALL 如实报告，就地标注照常追加并随后续提交落库。
2. **归档前核对**：`@lyx-archive` 在归档前完整验证通过之后、委托 OpenSpec 归档流程之前，SHALL 统计当前 change 快照中**没有任何解决子项**的 Warning 条数；为 0 或快照不存在时 SHALL NOT 询问；大于 0 时 SHALL 询问一次是否逐条核对（默认不核对）。用户同意后 SHALL 逐条以快照基线到 `HEAD` 之间涉及该条目位置文件的提交作为候选修复 commit 呈现判断，由用户逐条确认后才标注；候选取该条目**所在节**的基线；位置涉及多个文件时取并集，无可解析文件时视为无候选。节基线缺失或不是可解析的 commit（元信息仅记录基线状态）时，SHALL 只展示条目、由用户直接提供修复 commit hash，并按"必须引用已存在的修复 commit"校验。找不到候选 commit、用户否认或未提供可解析 hash 的条目 SHALL 跳过并如实说明。用户拒绝核对时 SHALL 直接继续归档。

#### Scenario: 审查后同会话修复并提交后就地标注

- **WHEN** review-code 结束并写入含 3 条 Warning 的 `## 代码审查` 节，同一会话内用户要求修复这 3 条，修复以 commit `0a33558` 提交
- **THEN** active 快照中这 3 条 Warning 下各追加 `- 解决：本 change 内修复（未复审，commit 0a33558）— <说明>`，原文与编号不变，不产生额外提交

#### Scenario: 修复未提交时不标注

- **WHEN** 用户修复了快照中的某条 Warning 但尚未提交
- **THEN** 命令 SHALL NOT 追加就地标注，并提示需先提交修复

#### Scenario: 同一 commit 不重复标注

- **WHEN** 某 Warning 下已有引用 commit `0a33558` 的就地标注，再次对同一条目以同一 commit 标注
- **THEN** 命令跳过该条，SHALL NOT 追加重复行

#### Scenario: 归档前核对发现未标注 Warning

- **WHEN** 用户运行 `@lyx-archive`，完整验证通过，当前 change 快照中有 2 条 Warning 没有任何解决子项
- **THEN** 命令在委托 OpenSpec 归档前询问一次是否逐条核对；用户同意后逐条给出候选修复 commit，用户确认的条目追加就地标注，其余跳过并说明，随后照常归档

#### Scenario: 节基线不可用时由用户提供 hash

- **WHEN** 归档前核对中某条 Warning 所在节的元信息只记录了 `--no-commit` 基线状态
- **THEN** 命令只展示该条目，请用户直接提供修复 commit hash；hash 可解析时追加就地标注，否则跳过并说明

#### Scenario: 审查后修复提交不纳入快照

- **WHEN** 审查后同会话修复 Warning 并提交
- **THEN** 该修复提交只包含修复文件，未跟踪的 `review-findings.md` 不被纳入

#### Scenario: 归档前核对无未标注项时不打扰

- **WHEN** 当前 change 快照不存在，或其中每条 Warning 都已有解决子项
- **THEN** `@lyx-archive` SHALL NOT 发出核对询问，直接继续归档

#### Scenario: 用户拒绝归档前核对

- **WHEN** 归档前核对询问被用户拒绝
- **THEN** 快照保持原样，归档流程照常继续

#### Scenario: 重跑审查后就地标注随旧节消失

- **WHEN** 某节已有就地标注，用户在同一 change 内重跑同类审查并产生新一轮 Warning
- **THEN** 该节被最后一轮结果整体替换，旧的就地标注不被保留或合并

#### Scenario: 就地标注写入失败不阻断

- **WHEN** 归档前核对中某条就地标注因文件被占用写入失败
- **THEN** 命令跳过该条并如实报告原因，其余条目照常处理，归档不被阻断

### Requirement: 追加式复审说明

当且仅当某 change 在其 `proposal.md` 的 `## 复审的审查未修项` 小节显式声明复审了历史快照中的 Warning 时，`@lyx-archive` SHALL 在归档该 change 时把对应复审说明追加到**已归档**快照的对应 Warning 条目之下。复审说明记录的是"对该条已有解决说明的修复是否站得住"的事后判断，SHALL 与解决说明共用同一套锚点、写入时点与落库规则：

- **格式**：`- 复审：<change-name>（归档于 <YYYY-MM-DD>，结论：成立|不成立）— <说明>`，作为该 Warning 顶层条目的缩进子项，追加在该条目现有全部子项之后。结论 SHALL 只取 `成立` / `不成立`；声明中结论缺失或取其他值时 SHALL 逐条跳过并如实报告。
- **锚点**：`<归档快照路径>#<节名>#<序号>`，节名仅允许 `方案审查` / `代码审查`；路径 SHALL 指向已归档快照（`openspec/changes/archive/**/review-findings.md`），引用 active 快照 SHALL 逐条拒绝并如实报告。旧快照无显式编号时按节内顶层 Warning 条目出现顺序定位，无法唯一解析时跳过并报告。
- **前提**：目标 Warning 条目下 SHALL 已存在至少一条 `- 解决：` 子项（跨 change 解决说明或本 change 内就地标注均可）；不存在任何解决子项时 SHALL 逐条跳过并报告"无可复审的解决说明"，SHALL NOT 写入。
- **读取位置与时点**：从归档后目录读取本 change 的 `proposal.md`；写入发生在 OpenSpec 归档移动之后、归档 commit 之前，与追加式解决说明同段执行；同一 change 同时声明解决与复审同一条目时，解决说明先于复审说明追加。
- **原文不变**：原 Warning 的位置 / 问题 / 建议原文、编号与既有子项（含"未复审"就地标注）SHALL 逐字保持不变；复审说明 SHALL NOT 计入 Warning 计数、SHALL NOT 触发编号重排、SHALL NOT 被计为解决子项。
- **幂等与多次复审**：同一 Warning 下已存在同一 `<change-name>` 的复审说明时 SHALL 跳过；不同 change 复审同一 Warning 时按归档先后追加多行，以**最后一行**为该条目当前的复审结论。
- **失败容错**：锚点无法解析、目标文件缺失或不可读、追加写入失败时 SHALL 逐条跳过并如实报告原因，SHALL NOT 猜测性匹配、SHALL NOT 改写其他条目、SHALL NOT 阻断归档。
- **落库**：复审说明随既有 `git add -- openspec/` 进入归档 commit，SHALL NOT 新增独立提交或独立归档步骤。
- **无状态**：SHALL NOT 引入 open/closed 状态字段、查询接口或自动关闭流程；复审结论为"不成立"时 SHALL NOT 删除或改写已有解决说明。

没有 `## 复审的审查未修项` 小节时 `@lyx-archive` SHALL NOT 写入任何复审说明，SHALL NOT 自动推断哪些条目已被复审。

#### Scenario: 声明复审后归档追加复审说明

- **WHEN** 某 change 的 `proposal.md` 声明 `openspec/changes/archive/2026-09-30-in-change-review-findings-resolution/review-findings.md#代码审查#1（结论：成立）— <说明>`，`@lyx-archive` 归档该 change
- **THEN** 归档 commit 前在该 Warning 现有子项之后追加 `- 复审：<change-name>（归档于 <YYYY-MM-DD>，结论：成立）— <说明>`，原文与既有子项逐字不变，随归档 commit 落库

#### Scenario: 目标条目无解决子项时跳过

- **WHEN** 复审声明指向的 Warning 条目下没有任何 `- 解决：` 子项
- **THEN** 命令跳过该条并报告"无可复审的解决说明"，不写入，归档照常继续

#### Scenario: 结论取值非法时跳过

- **WHEN** 复审声明写成 `...#方案审查#1（结论：部分成立）— ...`
- **THEN** 命令逐条跳过并如实报告结论取值非法，其余条目照常处理

#### Scenario: 同一 change 重复处理不重复追加

- **WHEN** 归档重跑，目标 Warning 下已存在同一 `<change-name>` 的复审说明
- **THEN** 命令跳过该条，SHALL NOT 追加第二条

#### Scenario: 多次复审以最后一行为准

- **WHEN** change A 复审结论为"不成立"，之后 change B 复审同一条目结论为"成立"
- **THEN** 该条目下按归档先后保留两行复审说明，当前复审结论取 change B 的"成立"

#### Scenario: 复审不成立不改写解决说明

- **WHEN** 复审声明结论为"不成立"
- **THEN** 该条目已有的解决说明与"未复审"就地标注保持原样，只追加复审说明

#### Scenario: 引用 active 快照被拒绝

- **WHEN** 复审声明引用 `openspec/changes/<未归档-change>/review-findings.md#代码审查#1`
- **THEN** 命令逐条拒绝并报告"仅可引用已归档快照"，SHALL NOT 写入，SHALL NOT 阻断归档
