## 1. 更新主 spec 的 Purpose

- [ ] 1.1 使用 `apply_patch` 改写 `openspec/specs/ly-review-gates/spec.md` 的 `## Purpose` 段，使其描述为"两个由双审查 subagent 支撑的审查关卡，模型经 `[codexHost] reviewModel`/`reviewModelB` 与对应推理档字段落实，未配置回退当前会话模型"，删除 `codex exec`、`{{REVIEW_MODEL}}`、`docs/codex-exec-contract.md` 与旧双模型替代描述；验证 `sed -n '1,6p' openspec/specs/ly-review-gates/spec.md` 显示新 Purpose 且不含被删除旧短语。

## 2. 对齐代码审查与方案审查正文

- [ ] 2.1 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `代码审查读取 git diff 并分级输出发现` 全文重写主 spec 对应 requirement 块（含全部 Scenario），使审查基线为 `apply:` commit → `propose:` commit 退化，删除"工作区干净即无变更 / 不回退历史 commit"、`codex exec`/`-m`/`session_id`/`resume` 旧语义；验证 `openspec validate --changes sync-review-gates-spec` 通过且主 spec 该 requirement 中不再出现 `session_id`、`resume`、`docs/codex-exec-contract`。
- [ ] 2.2 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `方案审查分级输出发现` 全文重写主 spec 对应 requirement 块（含全部 Scenario），调用方式改为双审查 subagent + 配置模型/推理档字段，保留首轮路径清单、基线 spec 引用检测和 spec 未覆盖 What Changes 检查；删除 `codex exec`/`-m`/`sanitizeReviewModel` 旧语义；验证 `openspec validate --changes sync-review-gates-spec` 通过且主 spec 该 requirement 中不再出现 `codex exec`、`-m`。

## 3. 把补丁式条款并成权威正文

- [ ] 3.1 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `审查调用失败视为独立终止条件` 全文重写主 spec 对应 requirement 块（含全部 Scenario），把"原 `codex exec` 调用失败...SHALL 调整为..."改写为直接的两阶段失败语义并补环境级不可用、单 agent 成功的场景；验证 `openspec validate --changes sync-review-gates-spec` 通过且该 requirement 不再以"原... SHALL 调整为..."开头。
- [ ] 3.2 按本 change 的 `specs/ly-review-gates/spec.md` 中 MODIFIED `审查关卡以双审查 subagent 执行` 全文重写主 spec 对应 requirement 块（含全部 Scenario），把"旧调用形态废止"补丁整段删除并直接陈述双 subagent 契约、模型/推理档落实、共识归并与分歧时序；验证 `openspec validate --changes sync-review-gates-spec` 通过且该 requirement 不再包含"旧调用形态废止"独立段。

## 4. 回归验证

- [ ] 4.1 运行 `openspec validate --changes sync-review-gates-spec`，确认 proposal/design/tasks/delta spec 结构与引用合法。
- [ ] 4.2 运行 `rg -n "codex exec|session_id|resume|{{REVIEW_MODEL}}|docs/codex-exec-contract" openspec/specs/ly-review-gates/spec.md`，确认这些旧短语只可能出现在本 change 明确保留之外的位置；如仍出现在已重写 requirement 中则回到对应任务修复。若本仓库 `rg` 不可用，使用 `grep -nE` 替代。
