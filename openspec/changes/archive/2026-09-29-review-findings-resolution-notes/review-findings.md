# 审查未修项快照

## 方案审查

- 轮次：1
- 记录时间：2026-09-29T16:04:17+0800
- 基线：propose 阶段 commit `8e5b89c779aa359d8af8c5396ddc5461f061a625`

1. [design.md] — D5 说主 spec 的 Purpose 文本“等 OpenSpec 归档时由 delta 合并即可”，但当前 delta spec 没有 `## Purpose` 修改块，只修改了 Requirements。归档后基线 Purpose 仍会保留“只读留痕……不承担跟踪或关闭职责”的旧叙述，容易与新允许的追加式解决说明口径脱节。
   建议: 要么在 delta 中补 `## Purpose` 修改，要么把 D5 改成明确“Purpose 是非规范性叙述，本次不改，只由 Requirement 收敛语义”，不要暗示会自动合并。

2. [design.md] — Context 定义“归档前/归档后”两个时点，并称解决说明必须落在“归档后（已跟踪、内容冻结）”；D2 又把写入放在“opsx:archive 成功之后、归档 commit 之前”。这两个口径有时间差，实施者可能误解为必须在 commit 后写入，从而与“不新增提交”冲突。
   建议: 把生命周期改写为三段：active -> OpenSpec archive 移入 archive -> git archive commit 后冻结；明确解决说明只在第二段末尾、`git add openspec/` 前追加。

3. [specs/review-findings-snapshot/spec.md] — 锚点依赖“对应编号条目”和缩进子项，但 spec 未定义快照条目的最小 Markdown 结构，也没有说明历史快照没有显式编号时序号如何定位。机械计数、追加位置和“解决子项不参与 Warning 计数”都可能因实现者理解不同而漂移。
   建议: 补一个最小结构示例，明确顶层 Warning 条目格式、元信息位置、解决行缩进，以及旧快照无显式编号时是否按出现顺序定位、还是按无效锚点跳过并报告。

4. [design.md / specs/review-findings-snapshot/spec.md] — 失败路径覆盖了锚点非法、序号越界、目标缺失/不可读和 active 引用，但未覆盖“锚点有效、文件也可读，但追加写入失败”的情况，如磁盘错误、权限错误或归档过程中文件被占用。
   建议: 明确该情况也逐条报告且决定是否跳过，或者明确阻断归档；不要把“失败必须可见”只留在 design 风险描述里。

### Info（供参考，最后一轮结果）

1. [proposal.md / specs/ly-propose-flow/spec.md] — 声明小节要求“引用 + 一句说明”和“每条引用独占一个列表项”，但没有给出完整列表项示例或分隔符。
   建议: 补一个固定示例，例如 `- <归档快照路径>#<节名>#<序号> — <说明>`，避免实施时出现同一行、嵌套列表或换行说明的解析差异。

## 代码审查

- 轮次：2
- 记录时间：2026-09-29T16:29:19+0800
- 基线：apply 阶段 commit `761680d580c8ccc08db835ec9b0f11934961fcad`（循环修复 commit `a073e0b`）

1. [templates/skills-codex/archive.md:25] — 回写步骤要求在“opsx archive 成功把本 change 移入 archive 之后”读取“本 change 的 `proposal.md`”，但未显式说明此时应读取 `openspec/changes/archive/<日期>-<change-name>/proposal.md`。严格按字面理解可能继续访问已不存在的 active change 路径。
   建议: 补充明确路径：归档后从归档后的 change 目录读取 `proposal.md`，不要使用 `openspec/changes/<change-name>/proposal.md`。

2. [templates/skills-codex/archive.md:28] — active 快照引用被“拒绝”，但“拒绝”后的处理口径没有显式并入“跳过、报告且不阻断归档”的失败容错规则。失败容错段落只列了锚点解析失败和写入失败，可能被理解为 active 引用需要单独停止或另行处理。
   建议: 明确 active 快照引用也属于“逐条拒绝/跳过并报告”，并显式说明不阻断归档、不改写 active 快照。
