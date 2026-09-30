---
name: lyx-archive
description: '归档前先执行项目完整验证（测试/类型检查/构建），通过后按 opsx:archive 编排流程归档完成的 change，完成后 commit'
argument-hint: '[<change-name>]'
---

# Archive

> 调用方式：`@lyx-archive` mention 后跟随的自然语言即参数（如 `@lyx-archive` 带需求描述/选项）；无参数时直接 `@lyx-archive`。

按 `@openspec-archive-change skill`（opsx archive 编排 prompt）定义的流程归档指定 change（`参数` 显式指定 change 名时原样转发；未指定时，由下方「归档前核对」段按 opsx:archive 流程的默认规则确定目标 change，并以该名字作为参数委托，SHALL NOT 让其二次推断或二次询问）。

## 归档前完整验证（SHALL，先于任何归档动作）

在委托 OpenSpec 归档流程**之前**，对当前工作区执行一次项目完整验证，覆盖测试 / 类型检查 / 构建三类：

- 按项目实际提供的脚本选择（例如 `package.json` 的 `scripts.test` / `scripts.typecheck` / `scripts.build`，或项目 README/AGENTS.md 声明的等价命令）。
- 项目未提供的类别 SHALL 跳过并在报告中注明（例如"未提供 typecheck 脚本"），SHALL NOT 因缺失判定失败。
- 全部通过才继续；任一类别失败 SHALL 停止归档，**不移动** `openspec/changes/<change-name>/`，如实报告失败的脚本与原始错误输出。

该验证是慢验证的**唯一执行点**：审查关卡（`@lyx-review-plan` / `@lyx-review-code`）SHALL NOT 重复执行测试 / 类型检查 / 构建（`openspec validate` 仍由 review-plan 每轮执行，不属于本步范围）。

## 归档前核对本 change 未标注 Warning（SHALL，完整验证通过后、委托 OpenSpec 归档之前）

完整验证通过后、委托 OpenSpec 归档流程**之前**（此时快照仍位于 active 路径 `openspec/changes/<change-name>/review-findings.md`），核对当前 change 快照中在本 change 内已修复但尚未标注的 Warning（见 `review-findings-snapshot` 的「本 change 内修复标注」）：

- **先确定目标 change**：未指定参数时，先按 opsx:archive 流程的默认规则确定目标 change；不能唯一确定时询问用户，确定后再做核对。SHALL NOT 猜测 change 名，SHALL NOT 因目标未确定而把"快照不存在"当作跳过核对的理由。此处确定的 `<change-name>` SHALL 在随后委托 `@openspec-archive-change skill` 时作为参数传入，SHALL NOT 让其再次推断或询问目标 change。
- **统计**：统计快照中**没有任何解决子项**的 Warning 条数（按 Warning 顶层条目计）。快照不存在或计数为 0 时 SHALL NOT 询问，直接继续。
- **询问一次**：计数大于 0 时询问一次，例如："快照中有 N 条 Warning 未标注解决，要逐条核对是否已在本 change 内修复吗？(y/N)"——默认不核对；用户拒绝时快照保持原样，直接继续归档。
- **候选 commit**：用户同意后逐条处理。取该条目**所在节**元信息中的基线 commit，以 `git log <基线>..HEAD -- <位置文件>` 列出候选修复 commit（位置涉及多个文件时取并集；位置无可解析文件时视为无候选）。候选可能包含审查循环的统一修复 commit 或 apply commit 等噪声，逐条呈现判断供用户甄别。
- **基线不可用**：节基线缺失或不是可解析的 commit（如元信息只记录了 `--no-commit` 等基线状态）时，只展示条目，由用户直接提供修复 commit hash；该 hash SHALL 能被解析为已存在的 commit，否则跳过并说明。
- **逐条确认后标注**：用户逐条确认后，在该 Warning 顶层条目下追加 `- 解决：本 change 内修复（未复审，commit <短 hash>）— <一句说明>`；无候选、用户否认或未提供 hash 的条目跳过并如实说明。同一 Warning 下已有引用同一 commit 的就地标注时跳过（幂等）。
- **原文不变 / 不新增提交**：原 Warning 原文与编号逐字不变；标注只改工作区中的快照，随后续 `git add -- openspec/` 进入归档 commit，SHALL NOT 单独提交。该就地标注只追加解决子项，SHALL NOT 被视为重新生成或重建当前 change 快照。
- **失败容错**：写入失败或条目无法唯一定位时逐条跳过并如实报告原因，SHALL NOT 猜测性匹配，SHALL NOT 阻断归档。

## 回写审查未修项解决说明（SHALL，opsx 归档完成后、提交归档改动之前）

快照生命周期 SHALL 分三段：active（`openspec/changes/<change-name>/`）→ OpenSpec archive 把 change 移入 `openspec/changes/archive/<日期>-<change-name>/` → 归档 commit 后**原 Warning 原文与编号冻结**。冻结后仅允许追加式解决说明与追加式复审说明（均由后续 change 的归档回写追加，见下），SHALL NOT 改写、删除或重排原有条目。本步骤位于第二段末尾、第三段开始之前——SHALL NOT 被理解为"必须在归档 commit 之后写入"。

opsx:archive 成功把本 change 移入归档目录之后、执行下面的"提交归档改动"之前，SHALL 从**归档后目录**读取本 change 的 `proposal.md`（`openspec/changes/archive/<日期>-<change-name>/proposal.md`；SHALL NOT 继续使用已不存在的 `openspec/changes/<change-name>/proposal.md`）中的可选小节 `## 解决的审查未修项`，并按条回写历史快照：

- **触发条件**：仅处理该小节显式列出的引用；没有该小节时跳过本步骤，SHALL NOT 扫描或推断哪条 Warning 被解决（不做自动语义匹配）。
- **引用格式**：`<归档快照路径>#<节名>#<序号>`，节名仅允许 `方案审查` / `代码审查`，序号为该节 Warning 条目的 1 起连续编号；路径 SHALL 指向已归档快照（`openspec/changes/archive/**/review-findings.md`）。
- **旧快照定位**：引用没有显式编号的旧快照时，序号按该节内顶层 Warning 条目的出现顺序从 1 起定位；无法唯一解析时按锚点无法解析处理（跳过并如实报告），SHALL NOT 猜测性匹配。
- **追加内容**：在该 Warning 顶层条目之下追加缩进子项 `- 解决：<change-name>（归档于 <YYYY-MM-DD>）— <说明>`（序号仅用于引用与计数，不要求原条目已有显式编号）；原 Warning 的位置 / 问题 / 建议原文与编号 SHALL 逐字保持不变，SHALL NOT 改写、删除或重排。
- **幂等**：同一 Warning 下已存在同一 `<change-name>` 的解决说明时跳过，不重复追加；不同 change 解决同一 Warning 时按归档先后追加多行。
- **失败容错**：引用 active（未归档）快照、锚点无法解析（节名非法、序号越界、目标文件缺失 / 不可读）、或锚点有效但追加写入失败（磁盘错误、权限错误、文件被占用等）时，一律逐条跳过并如实报告原因，SHALL NOT 猜测性匹配、SHALL NOT 改写其他条目、SHALL NOT 改写 active 快照、SHALL NOT 阻断归档；其余条目照常处理。此处"SHALL NOT 改写 active 快照"只约束跨 change 回写，SHALL NOT 禁止上一节对本 change 自身 active 快照的就地标注。
- **落库**：回写只改工作区文件，SHALL NOT 单独 commit；解决说明随下面的既有 `git add -- openspec/` 一并进入归档 commit，SHALL NOT 新增独立提交或独立归档步骤。
- **无状态**：回写 SHALL NOT 引入 open/closed 状态字段、状态流转或关闭接口——解决说明只是追加留痕。

## 回写审查未修项复审说明（SHALL，紧接上一节、提交归档改动之前）

在上一节解决说明回写完成之后、执行"提交归档改动"之前，从同一份**归档后目录** `proposal.md`（`openspec/changes/archive/<日期>-<change-name>/proposal.md`）读取可选小节 `## 复审的审查未修项`，按条向历史快照追加复审说明（见 `review-findings-snapshot` 的「追加式复审说明」）：

- **触发条件**：仅处理该小节显式列出的条目；没有该小节时跳过本步骤，SHALL NOT 推断哪些条目已被复审。
- **声明格式**：`- <归档快照路径>#<节名>#<序号>（结论：成立|不成立）— <说明>`；锚点解析截止到全角左括号 `（`，节名仅允许 `方案审查` / `代码审查`，路径 SHALL 指向已归档快照。结论缺失或取 `成立` / `不成立` 之外的值时逐条跳过并如实报告。
- **前提**：目标 Warning 顶层条目下 SHALL 已存在至少一条 `- 解决：` 子项（跨 change 解决说明或本 change 内就地标注均可，含上一节刚追加的）；不存在时逐条跳过并报告"无可复审的解决说明"。
- **追加内容与位置**：在该 Warning 现有全部子项之后追加缩进子项 `- 复审：<change-name>（归档于 <YYYY-MM-DD>，结论：成立|不成立）— <说明>`；同一 change 同时声明解决与复审同一条目时，解决说明先于复审说明。原 Warning 原文、编号与既有子项（含"未复审"就地标注）SHALL 逐字保持不变；复审说明不计入 Warning 计数、不触发编号重排、不计为解决子项。
- **幂等与多次复审**：同一 Warning 下已存在同一 `<change-name>` 的复审说明时跳过；不同 change 复审同一条目时按归档先后追加多行，以最后一行为当前复审结论。结论为"不成立"时 SHALL NOT 删除或改写已有解决说明。
- **失败容错**：引用 active（未归档）快照、锚点无法解析（节名非法、序号越界、目标文件缺失 / 不可读）、或追加写入失败时，一律逐条跳过并如实报告原因，SHALL NOT 猜测性匹配、SHALL NOT 改写其他条目、SHALL NOT 阻断归档；其余条目照常处理。
- **落库与无状态**：只改工作区文件，随下面的既有 `git add -- openspec/` 进入同一次归档 commit，SHALL NOT 新增独立提交或独立归档步骤；SHALL NOT 引入 open/closed 状态字段或关闭接口。

## 提交归档改动

归档会把 `openspec/changes/<change-name>/` 移动到 `openspec/changes/archive/`，并可能同步更新 `openspec/specs/`。提交涉及的全部文件：

```bash
MSG_FILE="$(git rev-parse --git-path COMMIT_EDITMSG)"
git add -- openspec/
# 先将完整 message 写入 "$MSG_FILE"：
# chore(openspec): 归档 <change-name>
#
# - 动机：完成 <change-name> 的归档收尾
# - 改动：移动 change 目录并同步 openspec/specs
# - 影响：归档后的 change 不再作为活跃 change
#
# Change-Stage: archive
# Change-Name: <change-name>
git commit -F "$MSG_FILE"
```

change 目录下若存在审查阶段写入的未跟踪 `review-findings.md`（审查未修项快照，见 `review-findings-snapshot`），随既有 `git add -- openspec/` 一并落库并随 change 目录搬入 `archive/`，无需额外步骤——SHALL NOT 为它新增任何专门的归档命令。归档前核对追加的就地标注只追加解决子项，不属于对当前 change 快照的重新生成或重建；向更早 change 已归档快照追加的解决说明与复审说明同理，都只是追加子项，不属于重建当前 change 快照。

message 采用 Conventional Commits 前缀 + 正文 + trailer 结构：先用 `git rev-parse --git-path COMMIT_EDITMSG` 获取 message 路径并按 `@lyx-commit` 规范写入完整 message，CC 前缀固定 `chore(openspec)`，正文包含动机/改动/影响，末尾带 `Change-Stage: archive` 与 `Change-Name: <change-name>` trailer。

若无可提交内容或 `git commit` 失败，跳过提交，如实报告原始错误，不视为归档失败。

## 归档后分支收尾（archive commit 成功后）

archive 阶段 commit 成功后，读取归档后 change 目录下 `.openspec.yaml` 的 `lyx:` metadata，并执行分支收尾：

```yaml
lyx:
  isolation: worktree | branch | none
  sourceBranch: main | null
  developmentBranch: feature/xxx | null
  worktreePath: /abs/path | null
```

### 1. 解析 metadata 与决定目标分支

- `isolation: none`：不提示，直接结束收尾流程。
- `isolation: branch` / `worktree` 且 `sourceBranch` 有值：把该值作为 `targetBranch`。
- 完全缺少 isolation metadata，或 `isolation != none` 且 `sourceBranch` 为 `null` / 空：进入保守路径，提示用户选择目标分支或跳过；SHALL NOT 默认猜 `main` / `master`。用户选择目标分支后，把该分支作为 `targetBranch`。
- 保守路径可推导 `developmentBranch = 当前分支`、`worktreePath = 当前 linked worktree（若存在）`；无法唯一判定当前分支或 worktree 时，跳过收尾并保留现场。

### 2. 展示确认前完成一致性校验

在展示“是否合并/清理”提示前，先校验：

- `targetBranch` SHALL NOT 等于 `developmentBranch`；相等时判定 metadata/目标选择异常并停止。
- `targetBranch` 与 `developmentBranch` 必须存在。
- `isolation: branch` 时，当前分支必须等于 `developmentBranch`。
- `isolation: worktree` 时，`worktreePath` 必须仍是注册的 linked worktree，且该 worktree checkout `developmentBranch`。
- 必须能用 `git worktree list --porcelain` 定位 `targetBranch` 所在 worktree；若该分支未被任何 worktree checkout，则令 `targetWorktree` 为主 worktree，并确认可 checkout `targetBranch`。
- 开发 worktree 与 `targetWorktree` 都必须干净。

任一校验失败：停止收尾，报告不一致项，保留 worktree 与开发分支，SHALL NOT 展示可确认的清理提示，SHALL NOT 自动合并或删除。

### 3. 展示收尾提示

校验通过后才展示确认提示：

- `branch`：是否把 `"<developmentBranch>"` 合并到 `"<targetBranch>"` 并删除开发分支？
- `worktree`：是否把 `"<developmentBranch>"` 合并到 `"<targetBranch>"`，删除 worktree `"<worktreePath>"` 并删除开发分支？

用户选择“否”或取消：不执行任何 Git 写操作，只报告未执行收尾。

### 4. 用户确认后的本地收尾

用户选择“是”后：

1. 在已定位的 `targetWorktree` 中确认已 checkout `"<targetBranch>"`；需要时执行 `git -C "<targetWorktree>" checkout "<targetBranch>"`。
2. 执行 `git -C "<targetWorktree>" merge --no-ff "<developmentBranch>"`。
3. merge 成功后，若 `isolation: worktree`，执行 `git -C "<targetWorktree>" worktree remove "<worktreePath>"`。
4. worktree 删除成功后（或本就不需要删除 worktree），执行 `git -C "<targetWorktree>" branch -d "<developmentBranch>"`。
5. SHALL NOT 自动 `git push`；报告中明确“仅本地合并，未 push”。

失败保留现场规则：

- 定位 `targetBranch` worktree 失败：停止，SHALL NOT 执行 merge、worktree remove 或 branch delete。
- checkout / 切回 `targetBranch` 失败：停止，保留 worktree 与开发分支。
- merge 冲突或失败：停止，保留 worktree 与开发分支。
- worktree 删除失败：停止，SHALL NOT 继续删除开发分支。
- 开发分支删除失败：报告失败原因，保留分支。
