## ADDED Requirements

### Requirement: 追加式解决说明

当且仅当某 change 在其 `proposal.md` 的 `## 解决的审查未修项` 小节显式声明解决了历史 `review-findings.md` 中的 Warning 时，`@lyx-archive` SHALL 在归档该 change 时把对应解决说明追加到**已归档**快照的对应 Warning 条目之下。解决说明 SHALL 采用 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>` 形式，作为该编号条目的缩进子项；原 Warning 的位置、问题、建议原文 SHALL 逐字保持不变，SHALL NOT 改写、删除或重排编号。引用 SHALL 采用 `<归档快照路径>#<节名>#<序号>`，节名仅允许 `方案审查` / `代码审查`，序号为该节 Warning 条目的 1 起编号。仅 SHALL 引用已归档快照（`openspec/changes/archive/**/review-findings.md`）；引用 active（未归档）快照 SHALL 拒绝并如实报告。同一 Warning 下已存在同一 `<change-name>` 的解决说明时 SHALL NOT 重复追加；多个 change 解决同一 Warning 时 SHALL 按归档先后追加多行。锚点无法解析（节名非法、序号越界、目标文件缺失或不可读）时 SHALL 跳过该条并如实报告原因，SHALL NOT 阻断归档、SHALL NOT 改写其他条目、SHALL NOT 猜测性匹配。解决说明的写入 SHALL 发生在归档 commit 之前，使该改动随既有 `git add -- openspec/` 一并落库；SHALL NOT 为其新增独立提交或独立归档步骤。解决说明 SHALL NOT 引入 open/closed 状态字段、查询接口或自动关闭流程——它只是留痕，不改变 `@lyx-explore` 的扫描与询问流程。

#### Scenario: 声明后归档追加解决说明

- **WHEN** 某 change 的 `proposal.md` 声明解决了 `openspec/changes/archive/2026-09-23-review-findings-snapshot/review-findings.md#代码审查#2`，`@lyx-archive` 归档该 change
- **THEN** 归档前在该 Warning 条目之下追加 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>`，并随归档 commit 落库

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
- **THEN** 命令拒绝该条并如实报告"仅可引用已归档快照"，SHALL NOT 写入未归档快照

#### Scenario: 锚点无法解析时跳过且不阻断归档

- **WHEN** `proposal.md` 引用的节名非法、序号越界或目标文件缺失
- **THEN** 命令跳过该条并如实报告原因，其余条目照常处理，归档流程 SHALL NOT 因该条失败而中断

#### Scenario: 无声明时不追加

- **WHEN** 某 change 的 `proposal.md` 没有 `## 解决的审查未修项` 小节
- **THEN** `@lyx-archive` SHALL NOT 修改任何历史快照，归档流程与现有行为一致

#### Scenario: 归档 commit 包含解决说明

- **WHEN** 解决说明已成功追加，`@lyx-archive` 执行归档 commit
- **THEN** 该说明随既有 `git add -- openspec/` 一并提交，SHALL NOT 产生独立提交

## MODIFIED Requirements

### Requirement: 快照文件的位置与格式

审查未修项快照 SHALL 位于 `openspec/changes/<change-name>/review-findings.md`，采用单文件两节结构：`## 方案审查`（来源 `@lyx-review-plan`）与 `## 代码审查`（来源 `@lyx-review-code`）。快照 SHALL 只收录 Warning——SHALL NOT 收录 Info，SHALL NOT 收录 Critical。每节 SHALL 记录该审查类型**最近一轮**未被自动修复的发现，逐字保留该轮审查发现的原文与位置、问题、建议，并附轮次与基线元信息（执行轮次、记录时间、基线 commit 引用或明确的基线状态）。"该轮审查发现的原文"按执行者路径取值：`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文，`reviewExecutor = "main"`（默认）时为主 agent 在本轮审查报告中产出的原文——SHALL NOT 因 main 路径不存在 subagent 而跳过记录或虚构 subagent 原文。两节内的 Warning 条目 SHALL 使用从 1 起的连续编号，作为 `<归档路径>#<节名>#<序号>` 解决说明锚点的定位基础。快照 SHALL NOT 引入 open/closed 状态字段，SHALL NOT 承担状态流转或自动关闭职责；但 SHALL 允许后续 change 以追加式解决说明留下"已解决"记录（见「追加式解决说明」Requirement）——该说明只增不改，不构成状态。某一节零 Warning 时 SHALL NOT 写该节；两节都为空时 SHALL NOT 创建文件。

#### Scenario: 有 Warning 时按节写入

- **WHEN** 某 change 的审查循环结束时该类型审查的最后一轮存在两条 Warning
- **THEN** 快照对应节记录这两条 Warning 的逐字原文（位置 + 问题 + 建议）与轮次/基线元信息，不写入其他内容

#### Scenario: Warning 条目连续编号

- **WHEN** 某节记录两条或更多 Warning
- **THEN** 条目按出现顺序使用 1、2、3 的连续编号，供 `#<节名>#<序号>` 锚点稳定定位

#### Scenario: 某节零 Warning 时不写该节

- **WHEN** 某 change 的 review-plan 最后一轮存在 1 条 Warning，而 review-code 最后一轮零 Warning
- **THEN** 快照只包含 `## 方案审查` 节，SHALL NOT 写入空的 `## 代码审查` 节

#### Scenario: 两节都为空时不创建文件

- **WHEN** 某 change 的 review-plan 与 review-code 最后一轮都没有 Warning
- **THEN** 不创建 `review-findings.md` 文件

#### Scenario: 只收 Warning 不收 Info 与 Critical

- **WHEN** 某轮审查同时返回 Critical、Warning 与 Info
- **THEN** 快照只收录 Warning；Critical 由修复循环处理、Info 不写入快照

### Requirement: @lyx-explore 先询问后列出快照

`@lyx-explore` 进入时 SHALL 扫描 active（`openspec/changes/*/review-findings.md`）与 archive（`openspec/changes/archive/*/review-findings.md`）两个位置的快照。存在命中时 SHALL **先询问**用户是否列出，SHALL NOT 直接列出；用户同意后 SHALL 按 change 分组展示（change 名、各节 Warning 计数、其中已标注解决的条数与一行摘要），active 的快照标注"进行中"、archive 的标注归档日期。个别快照读取失败时 SHALL 跳过该条并如实注明，SHALL NOT 中断扫描或虚构内容。用户拒绝列出、或扫描无命中时 SHALL NOT 展示任何快照内容，直接进入正常探索讨论。该询问与列出 SHALL 发生在委托 `opsx:explore` 之前，且 SHALL NOT 改变 `$ARGUMENTS` 的原样转发。

#### Scenario: 有命中时先询问

- **WHEN** 用户运行 `@lyx-explore`，扫描发现 2 个 change 留有快照
- **THEN** 命令先询问"是否列出审查未修项快照"，SHALL NOT 在询问前直接列出内容

#### Scenario: 用户同意后按 change 分组列出

- **WHEN** 用户对上述询问回答"是"
- **THEN** 命令按 change 分组展示各快照（change 名 + 方案/代码审查各自的 Warning 计数 + 其中已标注解决的条数 + 一行摘要），用户可进一步要求展开原文

#### Scenario: 已标注解决的条目在列出时可见

- **WHEN** 某归档快照的 `## 代码审查` 节共 3 条 Warning，其中 1 条带解决说明
- **THEN** 列出时显示该节 `3 条 Warning，其中 1 条已标注解决`，SHALL NOT 改变先询问后列出的流程

#### Scenario: 用户拒绝列出

- **WHEN** 用户对询问回答"否"
- **THEN** 命令不展示任何快照内容，直接进入正常探索讨论

#### Scenario: 无命中时不询问

- **WHEN** 用户运行 `@lyx-explore`，active 与 archive 下都没有快照
- **THEN** 命令 SHALL NOT 发出该询问，直接进入正常探索讨论

#### Scenario: 个别快照不可读时跳过并注明

- **WHEN** 用户运行 `@lyx-explore`，扫描命中 2 个快照，其中 1 个无法读取
- **THEN** 命令跳过该条并如实注明读取失败，其余快照照常处理，SHALL NOT 中断扫描或虚构其内容

### Requirement: 快照随归档落库

`@lyx-archive` 现有的 `git add -- openspec/` SHALL 覆盖 change 目录下的快照，使其随归档 commit 落库，并随 change 目录搬入 `openspec/changes/archive/<日期>-<change-name>/`——SHALL NOT 依赖任何额外的归档专门步骤。审查阶段已写快照（未跟踪），archive 阶段 SHALL NOT 重新生成或重建**当前 change 的快照内容**。此外，`@lyx-archive` MAY 按「追加式解决说明」Requirement 向**更早 change 的已归档快照**追加解决说明——该追加不是对当前 change 快照的重新生成或重建，且 SHALL 复用同一次归档提交。未归档的 change 其快照 SHALL 保持未跟踪状态。

#### Scenario: 归档后快照进入 archive 目录

- **WHEN** 某 change 存在未跟踪的 `review-findings.md`，用户运行 `@lyx-archive` 成功归档
- **THEN** 该文件随归档 commit 落库，并出现在 `openspec/changes/archive/<日期>-<change-name>/review-findings.md`

#### Scenario: 追加解决说明不重建当前快照

- **WHEN** `@lyx-archive` 为历史快照追加解决说明，同时当前 change 带有自己的未跟踪快照
- **THEN** 当前 change 的快照内容原样搬入 archive、不被重新生成；历史快照的追加与当前快照的落库在同一次归档 commit 内完成

#### Scenario: 未归档的 change 快照保持未跟踪

- **WHEN** 某 change 已写入快照但尚未归档
- **THEN** 快照保持未跟踪状态，不因 review-plan / apply / review-code 的提交而被提前纳入
