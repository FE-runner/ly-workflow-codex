# review-findings-snapshot Specification

## Purpose

定义 change 目录下 `review-findings.md` 审查未修项快照的完整生命周期：审查关卡循环结束时按节写入、随归档 commit 落库、`@lyx-explore` 先询问后列出。它是只读留痕（供事后回看某次审查提出过哪些未处理的 Warning），不承担跟踪或关闭职责。

## Requirements

### Requirement: 快照文件的位置与格式

审查未修项快照 SHALL 位于 `openspec/changes/<change-name>/review-findings.md`，采用单文件两节结构：`## 方案审查`（来源 `@lyx-review-plan`）与 `## 代码审查`（来源 `@lyx-review-code`）。快照 SHALL 只收录 Warning——SHALL NOT 收录 Info，SHALL NOT 收录 Critical。每节 SHALL 记录该审查类型**最近一轮**未被自动修复的发现，逐字保留该轮审查发现的原文与位置、问题、建议，并附轮次与基线元信息（执行轮次、记录时间、基线 commit 引用或明确的基线状态）。"该轮审查发现的原文"按执行者路径取值：`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文，`reviewExecutor = "main"`（默认）时为主 agent 在本轮审查报告中产出的原文——SHALL NOT 因 main 路径不存在 subagent 而跳过记录或虚构 subagent 原文。快照 SHALL NOT 承担 open/closed 跟踪状态或关闭职责。某一节零 Warning 时 SHALL NOT 写该节；两节都为空时 SHALL NOT 创建文件。

#### Scenario: 有 Warning 时按节写入

- **WHEN** 某 change 的审查循环结束时该类型审查的最后一轮存在两条 Warning
- **THEN** 快照对应节记录这两条 Warning 的逐字原文（位置 + 问题 + 建议）与轮次/基线元信息，不写入其他内容

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

`@lyx-archive` 现有的 `git add -- openspec/` SHALL 覆盖 change 目录下的快照，使其随归档 commit 落库，并随 change 目录搬入 `openspec/changes/archive/<日期>-<change-name>/`——SHALL NOT 依赖任何额外的归档专门步骤。审查阶段已写快照（未跟踪），archive 阶段 SHALL NOT 重新生成或重建快照内容。未归档的 change 其快照 SHALL 保持未跟踪状态。

#### Scenario: 归档后快照进入 archive 目录

- **WHEN** 某 change 存在未跟踪的 `review-findings.md`，用户运行 `@lyx-archive` 成功归档
- **THEN** 该文件随归档 commit 落库，并出现在 `openspec/changes/archive/<日期>-<change-name>/review-findings.md`

#### Scenario: 未归档的 change 快照保持未跟踪

- **WHEN** 某 change 已写入快照但尚未归档
- **THEN** 快照保持未跟踪状态，不因 review-plan / apply / review-code 的提交而被提前纳入

### Requirement: @lyx-explore 先询问后列出快照

`@lyx-explore` 进入时 SHALL 扫描 active（`openspec/changes/*/review-findings.md`）与 archive（`openspec/changes/archive/*/review-findings.md`）两个位置的快照。存在命中时 SHALL **先询问**用户是否列出，SHALL NOT 直接列出；用户同意后 SHALL 按 change 分组展示（change 名、各节 Warning 计数与一行摘要），active 的快照标注"进行中"、archive 的标注归档日期。个别快照读取失败时 SHALL 跳过该条并如实注明，SHALL NOT 中断扫描或虚构内容。用户拒绝列出、或扫描无命中时 SHALL NOT 展示任何快照内容，直接进入正常探索讨论。该询问与列出 SHALL 发生在委托 `opsx:explore` 之前，且 SHALL NOT 改变 `$ARGUMENTS` 的原样转发。

#### Scenario: 有命中时先询问

- **WHEN** 用户运行 `@lyx-explore`，扫描发现 2 个 change 留有快照
- **THEN** 命令先询问"是否列出审查未修项快照"，SHALL NOT 在询问前直接列出内容

#### Scenario: 用户同意后按 change 分组列出

- **WHEN** 用户对上述询问回答"是"
- **THEN** 命令按 change 分组展示各快照（change 名 + 方案/代码审查各自的 Warning 计数 + 一行摘要），用户可进一步要求展开原文

#### Scenario: 用户拒绝列出

- **WHEN** 用户对询问回答"否"
- **THEN** 命令不展示任何快照内容，直接进入正常探索讨论

#### Scenario: 无命中时不询问

- **WHEN** 用户运行 `@lyx-explore`，active 与 archive 下都没有快照
- **THEN** 命令 SHALL NOT 发出该询问，直接进入正常探索讨论

#### Scenario: 个别快照不可读时跳过并注明

- **WHEN** 用户运行 `@lyx-explore`，扫描命中 2 个快照，其中 1 个无法读取
- **THEN** 命令跳过该条并如实注明读取失败，其余快照照常处理，SHALL NOT 中断扫描或虚构其内容
