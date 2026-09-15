# sync-review-gates-spec 设计

## Context

动机与范围见 `proposal.md`。当前 `openspec/specs/ly-review-gates/spec.md` 是主 spec, 首部 `## Purpose` 仍写旧调用机制；R2/R3 正文夹带 `codex exec`/`-m`/`session_id`/`resume`；R6 与 R9 以"上限文补丁"方式覆盖旧行为。实施时唯一允许修改的文件是 `openspec/specs/ly-review-gates/spec.md`；不得修改模板、命名基准、已 DEPRECATED spec 或 `docs/codex-exec-contract.md`。

## Goals / Non-Goals

**Goals:**

- 让主 spec 与 `templates/skills-codex/review-code.md` / `review-plan.md` 的审查范围、双 subagent 调用和推理档传递语义一致。
- 以单一权威正文替代补丁式覆盖，后续维护时不再保留相互冲突的历史条款。

**Non-Goals:**

- 不改命令命名（`/ly:*` 与 `@lyx-*` 的基准不在本 change 内裁决）。
- 不改任何模板、CLI、安装器、类型或测试实现。
- 不在本 change 中改 `ly-lifecycle-commands`、`release-publish-commands` 或其余 spec。
- 不把 `docs/codex-exec-contract.md` 文件正文重写为"当前行为"，该文件继续按既有口径保留为历史参考。

## Decisions

### D1: 主 spec 的 Purpose 直接就地编辑，不通过 delta 的 Purpose

OpenSpec 对已有 capability 的 delta 不接受 `## Purpose`，其归档会忽略该段；对已有 capability 的 Purpose 修改只能在 `openspec/specs/ly-review-gates/spec.md` 主文件直接编辑。因此 tasks 中把"重写主 spec Purpose"作为 apply 阶段的一个文件编辑任务，与提交本 change 的 delta spec 分开，但都落在应用后的主 spec。

替代方案：把 Purpose 的改动塞进某个 requirement——不可取，会把实现说明混入行为契约，破坏 Purpose 与 Requirement 的边界。

### D2: R2/R3 用 MODIFIED 全量替换，而不是 REMOVED + ADDED

R2/R3 仍保留原 requirement 名, 变化的是正文契约与 scenario。MODIFIED 必须复制整块再改写，否则归档时保留不完整的部分丢内容。改用 REMOVED+ADDED 会改变 requirement 标识，使历史对照与下游引用更难追踪。

### D3: 旧的调用形态直接在 R2/R3/R9 正文中消失，不新增"废止说明"

不是把 `codex exec` 等词留在正文再加一段废止补丁，而是在 R2/R3/R9 的正文直接用双审查 subagent 契约替换；R6 把原"`codex exec` ... SHALL 调整为..."的补丁措辞改成直接陈述四类失败处理语义（运行期失败 / 环境级不可用 / 单 agent 失败 / 配置读取失败）。这样补丁句不再出现在主 spec。`codex exec`/`-m`/`session_id`/`resume` 这类旧词如需保留，仅允许出现在 `SHALL NOT` 禁止条款中（用于否定旧调用机制），不作为肯定性调用语义出现。OpenSpec 对 MODIFIED requirement 要求 scenario 标题与原主 spec 完全一致、不允许重命名，因此既有 `第 2 轮以 resume 模式续聊同一会话` 标题作为稳定场景标识保留，其 WHEN/THEN 已明确改用"沿用同一批审查 subagent 会话"实现而不是 shell 层 resume/session_id 续聊。

### D4: 推理档字段只并入 R2/R3/R9，不扩展 `subagent-agent-config`

`subagent-agent-config` 已定义 `reviewReasoningEffort` / `reviewReasoningEffortB` / `codingReasoningEffort` 字段语义；本 change 只负责让 `ly-review-gates` 在审查相关 requirement 中引用这一对字段的传递规则，不新增或改写定义。禁止引入"模型名 → 档位"硬编码映射。

### D5: R1/R5/R7/R8 不在本次改范围；R4 纳入 MODIFIED 仅改次轮续接语义

R1 还包含命令命名和调用构造引用的历史描述，但它不直接定义双审查 spawn 或审查范围基线；本次不碰 R1/R5/R7/R8，避免在 spec 对账中误动无关 requirement。R4（`审查-修复循环与终止条件`）虽不在最初 scope 内，但其正文仍写"修复完成后自动重新执行双审查 subagent 关卡（spawn ×2...）"，并带有一处归档后失效的"见本 delta ADDED Requirement"引用，与新 R2 的"第 2 轮沿用同一批审查 subagent 会话、不重新 spawn"直接矛盾；因此把 R4 的一处次轮续接语义纳入本次 MODIFIED 范围（同属 `ly-review-gates` capability），只改次轮续接语义相关句并删除失效 delta 引用，不改动 R4 的终止条件判定逻辑与场景清单。

## Risks / Trade-offs

- [部分历史术语仍会存在于本 change 未触碰的 requirement] → 本 design 明确限定只改直接冲突项；后续如有不一致单独提 change。
- [MODIFIED 全量替换篇幅较长, 容易漏场景] → 生成后逐 scenario 与原主 spec 对照, 并通过 `openspec validate --changes sync-review-gates-spec` 校验结构。
- [R2/R3 的模型与推理档语义与 `subagent-agent-config` 重复表达] → 只放审查关卡的一对映射, 不重述通用回退与清洗细节；以 `subagent-agent-config` 为权威契约来源。

## Migration Plan

1. 应用本 change 文件编辑: 直接在主 spec 改写 Purpose（spec sync 不覆盖 Purpose，归档前确认 Purpose 已就地改写完成）, 并确保主 spec 最终与 `specs/ly-review-gates/spec.md` delta 表述一致。
2. 运行 `openspec validate --changes sync-review-gates-spec` 验证 change 结构。
3. 本 change 无运行时迁移、无 rollback 数据状态；若要回滚，恢复主 spec 到 `propose:` commit 前版本即可。
