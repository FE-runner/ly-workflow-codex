## Context

见 `proposal.md`。现状约束：`review-findings.md` 由 review-plan / review-code 按节 upsert 写入，正常清零场景在统一 commit 之后写成未跟踪文件，随后由 `@lyx-archive` 的既有 `git add -- openspec/` 随 change 目录搬进 `archive/`。快照的生命周期因此有明确的两个时点：**归档前**（未跟踪、可被重跑替换）与**归档后**（已跟踪、内容冻结）。解决说明必须落在后者，否则锚点不稳定。

## Goals / Non-Goals

**Goals:**

- 历史 Warning 被后续 change 解决后，在原始条目原地留下可追溯的解决说明。
- 原始 Warning 的位置/问题/建议逐字不动，说明只增不改。
- 回写复用 `@lyx-archive` 既有归档 commit，不新增提交、不新增归档步骤、不新增状态文件。

**Non-Goals:**

- 不引入 open/closed 状态字段、状态流转或全局 backlog 看板。
- 不自动扫描或语义推断"哪条 Warning 被解决了"；只处理 `proposal.md` 显式声明的引用。
- 不回写 active（未归档）快照；不修改 Warning 原文；不做查询/关闭接口。

## Decisions

**D1：声明载体 = `proposal.md` 的固定小节 `## 解决的审查未修项`，不用 `context.md`，不新增独立文件。**
`context.md` 是给 subagent 的软上下文（≤100 行、记文档之外的讨论结论），塞入待回写的机械引用会偏离定位；独立文件会增加 change 目录的搬运面。proposal 本身就是"本 change 做什么"的范围声明，归档步骤直接读取即可。替代方案（在 `context.md` 追加）被否：语义错位且 context.md 被排除在审查对象之外，声明得不到审查。

**D2：回写时机 = `@lyx-archive` 的 opsx:archive 成功之后、归档 commit 之前。**
此时 change 已被 OpenSpec 归档，回写目标（更早的归档快照）与"本 change 已落地"均成立；放在 commit 之前可让改动随既有 `git add -- openspec/` 一并落库，零新增提交。替代方案"propose 阶段就回写"被否：propose 只是方案，change 可能不实施；"独立 commit 回写"被否：会把一次归档拆成两个提交，且与 archive 的分支收尾/清理流程错位。

**D3：引用锚点 = `<归档快照路径>#<节名>#<序号>`，序号为节内从 1 起的连续编号。**
归档后节内容冻结，序号稳定；替代方案"给每条 Warning 发明稳定 ID"需要在 review 写入格式里新增字段且改变现有快照形态，成本高于收益；替代方案"用内容哈希定位"对原文微调即失效。为让序号可定位，本 change 顺带把"Warning 条目连续编号"写进快照格式，并要求 review-plan / review-code 模板一致产出。

**D4：只允许引用已归档快照（`openspec/changes/archive/**/review-findings.md`）。**
active 快照未跟踪且可被重跑 upsert 替换，序号与内容都会变，引用不可靠。引用 active 快照时拒绝该条并报告。

**D5：解决说明仅追加，不改原文，不引入状态字段。**
格式固定为 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>`，作为对应编号条目的缩进子项。快照 Purpose 的"不承担跟踪或关闭职责"由「快照文件的位置与格式」Requirement 的 MODIFIED 内容收敛为"不允许状态枚举与自动关闭，但允许追加不可篡改的解决说明"——解决说明只记录他人完成的关闭，不构成快照自身的状态。主 spec 的 Purpose 文本不在本 change 内直接改写：`/ly:propose` 的提交范围只含 change 目录，直接改主 spec 会让该文件游离在 propose/apply 的审查范围之外，等 OpenSpec 归档时由 delta 合并即可。

**D6：解决说明里的 change 引用用 change 名 + 归档日期，不含 commit SHA。**
写入发生在归档 commit **之前**，该 commit 的 SHA 尚不存在；硬塞一个拿不到的值会让格式失真。需要定位具体提交时用 `git log` / `git blame` 从该行追溯，信息不丢失。

**D7：幂等键 = `<change-name>`。**
同一 Warning 下已存在同一 change 名的解决行则跳过；不同 change 解决同一条目时按归档先后追加多行，保留历史。

**D8：锚点解析失败逐条跳过并报告，不阻断归档。**
节名非法、序号越界、目标文件缺失/不可读时，只跳过该条并给出原因，其他条目照常处理。解决说明是留痕，不应成为归档的硬门禁；但失败必须可见，不能静默。

**D9：`@lyx-explore` 列出快照时增加"其中已标注解决 M 条"。**
列出仍是先询问后列出；新增的是每节计数里的已解决子计数，让"已处理"在列表层可见。扫描到没有解决说明的历史快照时计数为 0，输出不变形。

**D10：文档同步边界 = `README.md` + `CLAUDE.md`；`CHANGELOG.md` 与 `AGENTS.md` 按仓库既有约定在发版时统一同步。**
仓库历史显示 feature commit 只更新 README/CLAUDE，`chore(release)` 才写 CHANGELOG 并同步 AGENTS.md；本 change 遵循同一分工，不制造发版文档漂移。

## Risks / Trade-offs

- **归档目录从"完全冻结"变为"允许追加解决说明"** → 只允许追加、原文逐字不动，且改动随归档 commit 进入 git 历史；解决说明自带 change 名与日期，可追溯、可审计。
- **序号锚点依赖节内连续编号，若 review 模板未落实编号则锚点失效** → 快照格式 Requirement 明确编号规则，review-plan / review-code 模板同步补充，并在 `host-adapters.test.ts` 加断言。
- **propose 时漏声明导致 Warning 不被标注，之后无法自动补救** → 明确非目标（不做自动语义匹配）；补救方式是在归档前修订 `proposal.md` 并提交，归档步骤读取的是归档当时的最新内容。
- **回写失败被静默忽略** → 逐条如实报告原因；归档流程本身不因该条中断，但报告必须可见。
- **`proposal.md` 声明与实际修复不符（声明了但没真解决）** → 说明记录的是声明者的判断，不做自动验证（与快照"非跟踪台账"一致）；诚信边界由 propose 审查与人工复核承担。

## Migration Plan

- 模板层改动随包升级落到 `~/.agents/skills/lyx-*/`；已安装环境经 `lycx init --force` 或 `npx ly-workflow-codex update` 刷新。
- 无数据迁移：历史归档快照没有解决说明属正常，`@lyx-explore` 展示为 0 条已标注解决；未声明解决项的新 change 行为完全不变。
- 回滚策略：删除 propose 的声明小节规则、archive 的回写段与 explore 的已解决计数即可；已追加的解决说明为普通文本，保留无害。
