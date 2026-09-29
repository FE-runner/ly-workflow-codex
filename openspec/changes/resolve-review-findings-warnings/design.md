## Context

上一 change（`review-findings-resolution-notes`）归档后留下 6 条 Warning：方案审查 4 条、代码审查 2 条（见 `proposal.md` 的「解决的审查未修项」与原快照）。它们都指向契约表述不完整（Purpose 口径、生命周期、最小结构、失败路径），不是运行时缺陷，因此本 change 只收紧 spec 与模板，不改 `src/` 运行时代码。

## Goals / Non-Goals

**Goals:**

- 让快照最小结构与锚点定位只有一种解释，旧快照也有确定规则。
- 让归档回写的生命周期、`proposal.md` 读取路径、失败容错口径无歧义。
- 修正主 spec Purpose，使其与追加式解决说明能力一致。

**Non-Goals:**

- 不重写已归档 change 的 `design.md` / `proposal.md`（历史产物保持原样）。
- 不修改历史快照里已有的 Warning 原文。
- 不引入 open/closed 状态字段或自动关闭流程。

## Decisions

**D1：主 spec Purpose 直接修正，不走 delta。**
OpenSpec 的 delta 不支持修改 `## Purpose`，而 `/ly:propose` 的提交范围只含 change 目录。因此本 change 在 **apply 阶段**直接编辑 `openspec/specs/review-findings-snapshot/spec.md` 的 Purpose，并把它纳入 apply 阶段 commit 的待提交清单。替代方案（在 delta 里塞 Purpose 块）会被 OpenSpec 忽略，等于没修。

**D2：快照最小结构写进 spec 与两个 review 模板。**
锚点 `<路径>#<节名>#<序号>` 依赖"顶层编号条目 + 缩进子项"这一结构。spec 定义结构，`review-plan.md` / `review-code.md` 按同一结构产出，避免只有编号要求而没有层级约定。

**D3：旧快照定位 = 顶层 Warning 条目出现顺序；无法唯一解析按锚点无效处理。**
归档前写入的旧快照可能没有显式编号；按出现顺序从 1 起定位可继续支持回写。替代方案"拒绝一切无编号旧快照"会白白丢掉对历史快照的回写能力；替代方案"猜测性匹配内容"会误标，故不采用。

**D4：生命周期三段写进 spec 与 archive 模板，并明确 proposal.md 读取路径。**
active（`openspec/changes/<change-name>/`）→ archive 目录（`openspec/changes/archive/<日期>-<change-name>/`）→ 归档 commit 后冻结；解决说明写入发生在第二段末尾、`git add -- openspec/` 之前，避免被理解成"必须在 commit 之后写"。

**D5：active 引用与写入失败并入统一失败容错：逐条跳过并如实报告，不阻断归档。**
留痕不是归档门禁；阻断归档会把"记录缺失"升级成流程失败，与既有"快照缺失只是留痕丢失"的口径冲突。替代方案"写入失败即阻断归档"被否。

## Risks / Trade-offs

- **apply 阶段直接改主 spec Purpose 可能游离在提交之外** → 在 tasks 中显式要求把它纳入 apply 阶段待提交清单，并由 `git show --name-only` 校验。
- **旧快照按出现顺序定位是启发式** → 只对确实没有显式编号的旧快照生效；新快照有编号，不受影响；无法唯一解析时按锚点无效处理而非猜测。
- **失败只报告不阻断** → 通过"逐条如实报告"保证可见；报告缺失会被审查者视为漏执行。

## Migration Plan

- 模板改动随 npm 包升级落到 `~/.agents/skills/lyx-*/`。
- 主 spec Purpose 一次性修正；历史已归档快照不回填编号，仅在后续回写时按出现顺序定位。
- 回滚策略：恢复 Purpose 原文、删除模板中的最小结构与生命周期段落即可；已追加的解决说明为普通文本，保留无害。
