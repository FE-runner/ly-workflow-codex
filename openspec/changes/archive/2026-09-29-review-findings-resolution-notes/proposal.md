## Why

`review-findings.md` 只记录"审查当时未修"的 Warning。后续 change 真正把它修掉之后，原始 Warning 上没有任何痕迹，事后回看快照（尤其是 `@lyx-explore` 列出快照时）无法判断这条 Warning 是否已被处理、由谁处理、怎么处理。需要一个**追加式解决说明**：保持原始 Warning 逐字可追溯，同时在原地留下"已被哪个 change 解决、解决方式"的指向。

## What Changes

- `proposal.md` 新增可选小节 `## 解决的审查未修项`：当本 change 明确解决某条历史 Warning 时，用 `<归档快照路径>#<节名>#<序号>` 精确引用该条并附一句说明；本 change 不解决历史 Warning 时 SHALL 省略该小节。
- `@lyx-archive` 在归档 change 时读取该小节，逐条把 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>` 追加到旧归档 `review-findings.md` 对应 Warning 条目之下；原 Warning 原文（位置 + 问题 + 建议）SHALL 逐字保持不变。
- 只允许引用**已归档**快照；引用 active（未归档）快照、节名非法、序号越界、目标文件缺失时，跳过该条并如实报告，SHALL NOT 阻断归档。
- 幂等：同一 Warning 下已存在同一 change 名的解决行时不重复追加；同一 Warning 被多个 change 解决时按归档先后追加多行。
- 快照语义调整：仍 SHALL NOT 引入 open/closed 状态字段、仍 SHALL NOT 做自动语义匹配；现有"不承担关闭职责"的口径放宽为"允许追加不可篡改的解决说明"。
- `@lyx-explore` 列出快照时，在各节 Warning 计数之外标注"已标注解决 M 条"。
- 为保证 `#<节名>#<序号>` 锚点可定位，两节内的 Warning 条目 SHALL 使用连续编号，解决说明作为缩进子项追加在对应编号条目之下。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `review-findings-snapshot`: 新增"追加式解决说明"要求（锚点格式与编号、只引用已归档快照、append-only 不改原文、幂等、失败不阻断归档）；同时修正「快照文件的位置与格式」Requirement 中"不承担关闭职责"的口径为"不允许状态枚举与自动关闭，但允许追加不可篡改的解决说明"，并为 Warning 条目补上稳定编号以支撑锚点。
- `ly-propose-flow`: `proposal.md` 新增可选"解决的审查未修项"声明小节与精确引用格式，作为归档回写的唯一触发入口。

## Impact

- 模板：`templates/skills-codex/propose.md`（声明小节产出规则）、`archive.md`（回写步骤）、`review-plan.md` / `review-code.md`（Warning 条目稳定编号）、`explore.md`（展示已标注解决的条数）
- Specs：`review-findings-snapshot`、`ly-propose-flow`
- 测试：`src/utils/__tests__/host-adapters.test.ts` 增加四类模板断言
- 文档：`README.md`（英文对外）、`CLAUDE.md`（精简导航）同步行为摘要；`AGENTS.md` 与 `CHANGELOG.md` 按仓库既有约定在发版时统一同步，本次 SHALL NOT 改动
- 兼容性：不改动 `src/` 运行时代码；未声明解决项的 change 行为完全不变；历史归档快照无解决说明仍正常读取
