## Context

`review-findings.md` 的解决留痕有两条路径：跨 change 解决说明（归档回写）与本 change 内就地标注（固定"未复审"）。复审 `in-change-review-findings-resolution` 的 5 条就地标注后发现：复审结论无处记录，且复审过程暴露 3 处残留（A 全量暂存纳入快照、B 中文 README 缺口、C archive 未传 change 名）。本 change 一并处理，并用新机制为这 5 条补复审说明。

## Goals / Non-Goals

**Goals:**
- 复审结论可留痕，explore 的"未复审"计数在复审成立后能下降。
- 所有 lyx 全量暂存路径都不会提前纳入进行中快照。
- 中英文 README 的快照机制描述一致。
- archive 未传参时只确定一次目标 change。

**Non-Goals:**
- 不为 active 快照引入复审说明（同一 change 内重跑审查会整节替换，本身即复审）。
- 不引入状态字段、复审台账或自动复审。
- 不修改 `worktree-create-before-propose` 中已过时的 WIP 命令示例文本（该 spec 早已与模板的 `-F "$MSG_FILE"` 写法脱节，属既存漂移，排除约束以 `review-findings-snapshot` 为权威）。

## Decisions

**D1 复审说明复用解决说明的整套机制**
锚点、归档后目录读取、写入时点（OpenSpec 移动后、归档 commit 前）、幂等（按 change 名）、失败逐条跳过、同一归档 commit 落库，全部与「追加式解决说明」一致。备选"在已归档快照上直接手工编辑"被否决：破坏"冻结后只经归档回写追加"的约束且无幂等保证。

**D2 声明用独立小节 `## 复审的审查未修项`**
不复用 `## 解决的审查未修项`：两者语义不同（解决 vs 判断已有修复），混用需要额外字段区分且让已有解析逻辑变复杂。结论写在锚点后的括注 `（结论：成立|不成立）`，锚点解析截止到全角左括号。

**D3 复审前提 = 目标条目已有解决子项**
复审对象是"修复"，没有解决说明的条目无物可审；此时跳过并报告，避免把复审说明误用为"解决"的替代品。

**D4 explore 计数：未复审与复审未通过互斥**
- 未复审 = 有"未复审"就地标注 且 无任何复审说明。
- 复审未通过 = 最后一条复审说明结论为"不成立"。
- 最后一条为"成立" → 两者都不计。
复审说明不计入"已标注解决"。多次复审取最后一行，与"按归档先后追加"天然对齐，无需时间戳比较。

**D5 全量暂存排除用 pathspec**
`git add -A -- ':/' ':(top,exclude,glob)openspec/changes/*/review-findings.md'`。正向 pathspec 用 `':/'`、排除 pathspec 带 `top` 魔法，二者都以仓库顶层为锚点——若写成 `.` / 不带 `top`，在子目录执行时暂存范围会缩到当前子目录、排除规则也失配，反而比原 `git add -A`（全仓）范围更小（已在临时仓库实测）。显式加 `glob` 魔法使 `*` 不跨 `/`，只匹配 active change 一层，不波及 `archive/<日期>-<name>/` 下已跟踪快照。落点：`commit.md` 的 `--all` 分支、`propose.md` 两处 WIP commit（切新分支 / 留在当前分支共用同一段文案）。已被跟踪的快照不自动 `git rm --cached`，仅如实报告。

**D6 archive 传名**
核对段"先确定目标 change"的结果记为 `<change-name>`，委托 `openspec-archive-change` 时作为参数传入；显式参数时行为不变。

**D7 Purpose 直接修订**
`review-findings-snapshot` 的 `## Purpose` 补"复审说明"叙述，按前例在主 spec 直接编辑（delta 不承载 Purpose）。

## Risks / Trade-offs

- [已安装的旧版 `@lyx-archive` 不识别复审声明] → 本 change 归档前 SHALL 先更新本机已安装 skills（重新 `init` / 菜单 update），否则 5 条复审说明不会写入；写入 tasks 与 context.md 作为归档前置提醒。
- [pathspec exclude 对未跟踪目录外路径无副作用，但老版本 git 不支持 `glob` 魔法] → 项目已依赖 `--only` 等较新特性，git ≥ 2.x 均支持 `:(glob)`；不做兼容分支。
- [复审结论"成立"由人判断，可能不准] → 与解决说明同样只是留痕，可由后续 change 追加"不成立"覆盖（以最后一行为准）。
