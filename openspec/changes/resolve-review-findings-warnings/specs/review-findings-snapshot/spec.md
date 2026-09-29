## MODIFIED Requirements

### Requirement: 快照文件的位置与格式

审查未修项快照 SHALL 位于 `openspec/changes/<change-name>/review-findings.md`，采用单文件两节结构：`## 方案审查`（来源 `@lyx-review-plan`）与 `## 代码审查`（来源 `@lyx-review-code`）。快照 SHALL 只收录 Warning——SHALL NOT 收录 Info，SHALL NOT 收录 Critical。每节 SHALL 记录该审查类型**最近一轮**未被自动修复的发现，逐字保留该轮审查发现的原文与位置、问题、建议，并附轮次与基线元信息（执行轮次、记录时间、基线 commit 引用或明确的基线状态）。"该轮审查发现的原文"按执行者路径取值：`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文，`reviewExecutor = "main"`（默认）时为主 agent 在本轮审查报告中产出的原文——SHALL NOT 因 main 路径不存在 subagent 而跳过记录或虚构 subagent 原文。两节内的 Warning 条目 SHALL 使用从 1 起的连续编号，作为 `<归档路径>#<节名>#<序号>` 解决说明锚点的定位基础。每节 SHALL 采用最小结构：先写元信息（轮次 / 记录时间 / 基线），再写顶层编号 Warning 条目 `1. [<位置>] — <问题>`，其问题细节与 `建议:` 作为该条目的缩进行；后续追加的 `- 解决：...` 作为缩进子项。解决子项 SHALL NOT 计入 Warning 计数，SHALL NOT 触发编号重排。读取归档前写入、没有显式编号的旧快照时，序号 SHALL 按节内顶层 Warning 条目的出现顺序从 1 起定位；无法唯一解析时按锚点无法解析处理。快照 SHALL NOT 引入 open/closed 状态字段，SHALL NOT 承担状态流转或自动关闭职责；但 SHALL 允许后续 change 以追加式解决说明留下"已解决"记录（见「追加式解决说明」Requirement）——该说明只增不改，不构成状态。某一节零 Warning 时 SHALL NOT 写该节；两节都为空时 SHALL NOT 创建文件。

#### Scenario: 有 Warning 时按节写入

- **WHEN** 某 change 的审查循环结束时该类型审查的最后一轮存在两条 Warning
- **THEN** 快照对应节记录这两条 Warning 的逐字原文（位置 + 问题 + 建议）与轮次/基线元信息，不写入其他内容

#### Scenario: Warning 条目连续编号

- **WHEN** 某节记录两条或更多 Warning
- **THEN** 条目按出现顺序使用 1、2、3 的连续编号，供 `#<节名>#<序号>` 锚点稳定定位

#### Scenario: 快照条目最小结构

- **WHEN** 某节写入 Warning 条目
- **THEN** 该节先写元信息，再写 `1. [<位置>] — <问题>` 形式的顶层条目，`建议:` 与问题细节为缩进行；后续 `- 解决：...` 为缩进子项且不计入 Warning 计数

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

### Requirement: 追加式解决说明

当且仅当某 change 在其 `proposal.md` 的 `## 解决的审查未修项` 小节显式声明解决了历史 `review-findings.md` 中的 Warning 时，`@lyx-archive` SHALL 在归档该 change 时把对应解决说明追加到**已归档**快照的对应 Warning 条目之下。快照生命周期 SHALL 分三段：active（`openspec/changes/<change-name>/`）→ OpenSpec archive 把 change 移入 `openspec/changes/archive/<日期>-<change-name>/` → 归档 commit 后内容冻结；解决说明的写入 SHALL 发生在第二段末尾、归档 commit 之前，SHALL NOT 被理解为"必须在归档 commit 之后写入"。`@lyx-archive` SHALL 从归档后目录读取该 change 的 `proposal.md`（`openspec/changes/archive/<日期>-<change-name>/proposal.md`），SHALL NOT 继续使用已不存在的 active 路径 `openspec/changes/<change-name>/proposal.md`。解决说明 SHALL 采用 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>` 形式，作为该编号条目的缩进子项；原 Warning 的位置、问题、建议原文 SHALL 逐字保持不变，SHALL NOT 改写、删除或重排编号。引用 SHALL 采用 `<归档快照路径>#<节名>#<序号>`，节名仅允许 `方案审查` / `代码审查`，序号为该节 Warning 条目的 1 起编号。引用 SHALL 指向已归档快照（`openspec/changes/archive/**/review-findings.md`）；引用 active（未归档）快照 SHALL 逐条拒绝并如实报告，SHALL NOT 写入未归档快照、SHALL NOT 因此阻断归档。同一 Warning 下已存在同一 `<change-name>` 的解决说明时 SHALL NOT 重复追加；多个 change 解决同一 Warning 时 SHALL 按归档先后追加多行。引用 active 快照、锚点无法解析（节名非法、序号越界、目标文件缺失或不可读）、或锚点有效但追加写入失败（磁盘错误、权限错误、文件被占用等）时，SHALL 逐条跳过并如实报告原因，SHALL NOT 阻断归档、SHALL NOT 改写其他条目、SHALL NOT 改写 active 快照、SHALL NOT 猜测性匹配；其余条目照常处理。解决说明的写入 SHALL 使其随既有 `git add -- openspec/` 一并落库；SHALL NOT 为其新增独立提交或独立归档步骤。解决说明 SHALL NOT 引入 open/closed 状态字段、查询接口或自动关闭流程——它只是留痕，不改变 `@lyx-explore` 的扫描与询问流程。

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
