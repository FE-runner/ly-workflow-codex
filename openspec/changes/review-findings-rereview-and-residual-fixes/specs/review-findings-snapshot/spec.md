## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 快照随归档落库

`@lyx-archive` 现有的 `git add -- openspec/` SHALL 覆盖 change 目录下的快照，使其随归档 commit 落库，并随 change 目录搬入 `openspec/changes/archive/<日期>-<change-name>/`——SHALL NOT 依赖任何额外的归档专门步骤。审查阶段已写快照（未跟踪），archive 阶段 SHALL NOT 重新生成或重建**当前 change 的快照内容**；归档前核对按「本 change 内修复标注」Requirement 追加的就地标注只追加解决子项、不改动原 Warning 条目，SHALL NOT 被视为重新生成或重建。此外，`@lyx-archive` MAY 按「追加式解决说明」与「追加式复审说明」Requirement 向**更早 change 的已归档快照**追加解决说明或复审说明——该追加不是对当前 change 快照的重新生成或重建，且 SHALL 复用同一次归档提交。未归档的 change 其快照 SHALL 保持未跟踪状态：除 review-plan / apply / review-code 的提交外，lyx 模板中的**全量暂存路径**（`@lyx-commit --all` 在暂存区为空时的全量暂存、`@lyx-propose` 切分支 / 留在当前分支前的 WIP commit）SHALL 排除进行中 change 目录下的 `review-findings.md`（仅匹配 `openspec/changes/<change-name>/review-findings.md` 一层，SHALL NOT 波及 `archive/` 下已跟踪的快照），SHALL NOT 将其提前纳入提交。排除后该路径保持未跟踪；若快照已被意外跟踪，命令 SHALL 如实报告，SHALL NOT 自动 `git rm --cached` 或改写历史。

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
