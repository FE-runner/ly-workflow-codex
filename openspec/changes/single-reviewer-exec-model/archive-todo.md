# 归档后待办（archive-todo）

归档 `single-reviewer-exec-model` 时/后需人工完成（delta spec 无法覆盖的部分）：

1. **主 spec Purpose 段同步**（delta 不覆盖 Purpose）：
   - `openspec/specs/ly-review-gates/spec.md` Purpose 仍写"双审查 subagent 支撑/`reviewModel`/`reviewModelB`"→ 改为"单审查 subagent（非 fork spawn）+ 主会话逐条裁决，模型经 `reviewModel` 指定（`reviewModelB` 弃用不读取）"
   - `openspec/specs/subagent-agent-config/spec.md` Purpose 仍写"三个模型字段（reviewModel / reviewModelB / codingModel）… 模型三连"→ 改为"两个模型字段（reviewModel / codingModel）… 模型二连；reviewModelB 弃用保留"
   - `openspec/specs/ly-propose-flow/spec.md` Purpose 无执行模型措辞，检查确认即可
2. **历史措辞标题清理**（归档后主 spec 不受 delta 场景名保留约束，可自由更名）：
   - `subagent-agent-config`："init 向导按'提供方 → 模型三连'采集三个模型字段" → "…模型二连采集两个模型字段"
   - `ly-lifecycle-commands`：场景"apply 由当前会话本人实施，完成后立即提交" → "apply 由 coding subagent 实施…"
   - `ly-review-gates`：场景"第 2 轮以 resume 模式续聊同一会话" → "第 2 轮重新 spawn 全新审查 subagent"
3. **（可选）** 本文件随 change 归档进入 `openspec/changes/archive/`，作为执行记录留存。
