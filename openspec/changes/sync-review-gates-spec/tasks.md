## 1. 更新主 spec 的 Purpose

- [ ] 1.1 使用 `apply_patch` 改写 `openspec/specs/ly-review-gates/spec.md` 的 `## Purpose` 段，使其描述为"两个由双审查 subagent 支撑的审查关卡，模型经 `[codexHost] reviewModel`/`reviewModelB` 与对应推理档字段落实，未配置回退当前会话模型"，删除 `codex exec`、`{{REVIEW_MODEL}}`、`docs/codex-exec-contract.md` 与旧双模型替代描述；验证 `sed -n '1,6p' openspec/specs/ly-review-gates/spec.md` 显示新 Purpose 且不含被删除旧短语。

## 2. 对齐代码审查与方案审查正文

- [ ] 2.1 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `代码审查读取 git diff 并分级输出发现` 全文重写主 spec 对应 requirement 块（含全部 Scenario），使审查基线为 `apply:` commit → `propose:` commit 退化，删除"工作区干净即无变更 / 不回退历史 commit"旧语义；`codex exec`/`-m`/`session_id`/`resume` 仅允许以 `SHALL NOT` 禁止条款形式保留，不再作为肯定性调用机制出现；验证 `openspec validate --changes sync-review-gates-spec` 通过且主 spec 该 requirement 中不再出现肯定性旧调用语义或 `docs/codex-exec-contract`。
- [ ] 2.2 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `方案审查分级输出发现` 全文重写主 spec 对应 requirement 块（含全部 Scenario），调用方式改为双审查 subagent + 配置模型/推理档字段，保留首轮路径清单、基线 spec 引用检测和 spec 未覆盖 What Changes 检查；删除 `sanitizeReviewModel` 旧语义，`codex exec`/`-m` 仅允许以 `SHALL NOT` 禁止条款形式保留；验证 `openspec validate --changes sync-review-gates-spec` 通过且主 spec 该 requirement 中不再出现 `sanitizeReviewModel` 或肯定性旧调用语义。

## 3. 对齐审查-修复循环的次轮续接语义

- [ ] 3.1 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `审查-修复循环与终止条件（review-code / review-plan 共用）` 全文重写主 spec 对应 requirement 块（含全部 Scenario），把"修复完成后自动重新执行双审查 subagent 关卡（spawn ×2…，见本 delta ADDED Requirement）"改写为"第 2 轮起沿用同一批审查 subagent 会话（具备轮间记忆），SHALL NOT 重新 spawn"，并删除全部失效的 delta 引用；验证 `openspec validate --changes sync-review-gates-spec` 通过且主 spec 该 requirement 中不再出现 `spawn ×2` 或任何 `ADDED Requirement` 字样。

## 4. 把补丁式条款并成权威正文

- [ ] 4.1 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `审查调用失败视为独立终止条件` 全文重写主 spec 对应 requirement 块（含全部 Scenario），把"原 `codex exec` 调用失败...SHALL 调整为..."改写为直接的四类失败处理语义（运行期失败 / 环境级不可用 / 单 agent 失败 / 配置读取失败按配置状态未知处理）并补环境级不可用、单 agent 成功的场景；验证 `openspec validate --changes sync-review-gates-spec` 通过且该 requirement 不再以"原... SHALL 调整为..."开头。
- [ ] 4.2 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `审查关卡以双审查 subagent 执行` 全文重写主 spec 对应 requirement 块（含全部 Scenario），把"旧调用形态废止"补丁整段删除并直接陈述双 subagent 契约、模型/推理档落实、共识归并与分歧时序；验证 `openspec validate --changes sync-review-gates-spec` 通过且该 requirement 不再包含"旧调用形态废止"独立段。

## 5. 回归验证

- [ ] 5.1 运行 `openspec validate --changes sync-review-gates-spec`，确认 proposal/design/tasks/delta spec 结构与引用合法。
- [ ] 5.2 运行 `rg -n "codex exec|session_id|resume|{{REVIEW_MODEL}}|docs/codex-exec-contract" openspec/specs/ly-review-gates/spec.md`，确认 `{{REVIEW_MODEL}}` 与 `docs/codex-exec-contract` 已完全移除；`codex exec`/`session_id`/`resume` 仅出现在 `SHALL NOT` 禁止条款中，或属于 OpenSpec 要求保持稳定的旧场景标题（该场景 WHEN/THEN 已明确不以 session_id/resume 续聊）。如作为肯定性调用机制出现在已重写 requirement 正文中则回到对应任务修复。若本仓库 `rg` 不可用，使用 `grep -nE` 替代。
