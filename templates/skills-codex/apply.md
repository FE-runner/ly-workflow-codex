---
name: lyx-apply
description: '当前会话自实施 tasks（单 Agent 模式，无外部委托）：读 tasks.md 逐任务实施+验证+勾选；全部任务完成后立即 commit apply: <change-name>；失败原样呈报转人工（不重试不兜底）'
argument-hint: '[<change-name>]'
---

# Apply

> 调用方式：`@lyx-apply` mention 后跟随的自然语言即参数（如 `@lyx-apply` 带需求描述/选项）；无参数时直接 `@lyx-apply`。

由当前会话直接实施全部 tasks——单 Agent 模式，不委托任何外部 agent、无 wrapper 调用、无 OVERALL 解析、不读取任何实施后端配置。全部任务完成后立即 commit（`apply: <change-name>`），作为 `@lyx-review-code` 的审查对象；未全部完成则原样呈报转人工，不重试、不兜底。隔离 worktree 的询问/新建统一收敛到 `@lyx-propose` 入口，apply 不触发任何 worktree 询问、不做隔离检测——直接在当前工作目录实施。

## 步骤

### 1. 确定目标 change 名

按固定优先级解析：

1. `参数` 中显式且合法的 change 名。
2. `openspec/changes/` 下唯一未归档的 change。
3. 无法唯一确定 → 直接询问用户。

任一步骤无法唯一确定时，不得继续执行后续步骤。

### 2. 读取 tasks.md 并逐任务实施（当前会话自实施）

1. 读取 `openspec/changes/<change-name>/tasks.md`，确认全部未完成任务（`- [ ]` 条目）；按需读取同目录 `proposal.md`/`design.md` 及任务引用的上下文文件，理解现有模式。
2. 自顶向下逐任务实施，每完成一个任务立即验证：
   - 只修改任务列出的文件，不添加任务之外的功能/重构/注释；
   - 按 tasks.md 指定的验证方式运行验证（如 typecheck/build/test），失败则修复后重试，每个任务最多 3 次修复尝试；
   - 验证通过后，把 tasks.md 中对应条目从 `- [ ]` 改为 `- [x]`，继续下一个任务。
3. 不询问——任务描述有歧义时按最简方案处理，直接落地并在最终报告中说明选择。
4. 全部任务勾选完毕后，暂存本次实施实际改动的文件（若实施前已存在与本次无关的预存改动，只 `git add` 本次改动的文件，SHALL NOT 将预存改动一并暂存/提交，并在报告中说明"预存改动未被提交"），进入下方"提交"。
5. 任一步骤验证反复失败（单任务超 3 次修复尝试）或 tasks.md 存在无法完成的条目 → 进入下方"失败处理"。

### 提交（全部任务完成时执行）

1. `git commit -m "apply: <change-name>"`
2. `apply: <change-name>` commit 即 `@lyx-review-code` 的审查对象。
3. 无可提交内容（如 tasks 本身无产出、或已被上一轮 `@lyx-review-code` 审查循环提交）则跳过，不创建空 commit。
4. 若 `git commit` 失败，如实报告 Git 返回的原始错误，不中断后续提示。

### 失败处理（未全部完成时执行）

列出 tasks.md 中仍未勾选的条目，停止执行，**不执行任何提交**。改动可能已部分落地在工作区，保留原状，由用户决定后续处理。
