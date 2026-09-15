# subagent-multi-agent-mode — 审查与实施迁移 subagent 多 Agent 模式

## Why

v0.1.0 拆分后的执行模型为：审查走 `codex exec` 独立子会话（无当前会话上下文，契约见 `docs/codex-exec-contract.md`），实施为当前会话自实施（单 Agent）。实际使用中暴露两个问题：

1. **分模型诉求与上下文隔离冲突**：用户希望审查/实施用不同的模型，但 exec 子会话与当前会话完全隔离——主会话讨论中的关键决策、取舍、已知边界等"软上下文"无法到达审查模型（决策只存在于对话、未落产物时，审查模型看不到），存在关键信息丢失风险。
2. **实施模型不可选 + 契约维护成本**：实施固定使用当前会话模型，"实施用别的模型"不可行；exec 契约（`thread_id` 提取、`resume` 续聊）随 codex CLI 版本漂移，需按 `docs/codex-exec-contract.md` 的复核清单持续维护。

本 change 将审查/实施迁移为 **subagent 多 Agent 模式**：subagent 天然支持 fork 当前上下文（关键信息不丢）与指定模型（分模型诉求落地）；审查升级为双 agent 交叉验证，用"分歧 → 主会话拍板（显式提示用户）→ 不能确认即 Critical"补偿独立性的弱化。

## What Changes

1. **审查关卡改为双审查 subagent（review-plan / review-code 共用）**：每关 spawn 2 个审查 subagent，fork 当前会话上下文并在任务中点名"只审 change 范围"；两个 agent 各自独立审 → 交换结论 → 讨论共识；意见分歧时主会话拍板并**显式提示用户"这是审查分歧"**，主会话不能确认 → 判定 Critical（red）。审查-修复循环、终止条件、轮数上限、循环结束后统一提交等既有语义保留。
2. **双审查 agent 模型可分别指定**：审查 agent A 用 `codexHost.reviewModel`，审查 agent B 用 `codexHost.reviewModelB`；两者均缺省回退当前会话模型。
3. **实施改为 coding subagent（apply 步骤）**：spawn 一个 coding subagent，fork 当前会话上下文并在任务中点名"只实施 change 范围"；模型 = `codexHost.codingModel`（缺省回退当前会话模型）；coding agent 读取 tasks.md 逐任务实施 + 验证 + 勾选后，将改动回传主会话，**不自行 commit**——`apply: <change-name>` 由主会话确认后提交。
4. **新增 subagent 模型配置**：`codexHost` 下新增可选字段 `codingModel`、`reviewModelB`（与既有 `reviewModel` 并列），缺省回退当前会话模型；配置读取/模板渲染链路同步。
5. **`docs/codex-exec-contract.md` 退役**：顶部标注 DEPRECATED（内容仅作历史参考），review-plan/review-code 模板停止引用；subagent 执行约定（spawn 协议、任务构造、共识/分歧裁决）内联写入各 skill 模板——subagent 为宿主原生能力，无 shell 调用契约的版本漂移维护面。
6. **角色词复用**：审查 subagent 的任务继续引用 `~/.ly/prompts/codex/plan-reviewer.md`（review-plan）与 `reviewer.md`（review-code），角色词内容不重写。

## Capabilities

### New Capabilities

- `subagent-agent-config`: subagent 执行模型配置——`codexHost.codingModel` / `codexHost.reviewModelB` 可选字段、缺省回退当前会话模型的语义，以及"环境无 subagent 能力时回退口径"。

### Modified Capabilities

- `ly-review-gates`: 审查关卡执行机制从"单 `codex exec` 独立子会话"改为"双审查 subagent（fork 上下文 + 范围点名 + 独立审→交换→共识；分歧→主会话拍板 + 提示用户→不能确认 Critical）"；模型按 reviewModel/reviewModelB 分别指定；审查调用失败终止条件扩展为"subagent 不可用/调用失败"。
- `ly-propose-flow`: apply 实施步骤从"当前会话自实施"改为"coding subagent 实施"（fork 上下文 + 只实施 change 范围 + 可指定模型 + 主会话保留提交权）；全自动流水线中实施环节的主体语义同步。
- `ly-lifecycle-commands`: apply 实施主体语义从"当前会话本人实施完成立即提交"改为"coding subagent 实施、主会话确认后统一提交"——基线 Requirement 中与 "无外部委托/当前会话本人实施" 冲突的表述同步修正（delta 见 `specs/ly-lifecycle-commands/spec.md`）。

## Impact

- `templates/skills-codex/review-plan.md` / `review-code.md`：审查调用形态从 `cat <<EOF | codex exec ... --json -m {{REVIEW_MODEL}} -` + `resume <session-id>` 改写为双审查 subagent 编排指示。
- `templates/skills-codex/apply.md`：实施主体从当前会话改为 coding subagent（读 tasks.md、验证、勾选、回传不 commit）。
- `templates/skills-codex/propose.md`：全自动流水线段落中 apply/review 衔接语义同步。
- `src/types/index.ts`：`codexHost` 新增 `codingModel?` / `reviewModelB?`。
- `src/utils/host-adapters.ts` / `installer-template.ts`：模板渲染按新字段回退语义处理（未配置 → 模板指示当前会话模型）。
- `docs/codex-exec-contract.md`：标 DEPRECATED；模板不再引用。
- `AGENTS.md`：审查/实施执行模型与关键设计决策同步为 subagent 多 Agent 模式。
- `openspec/changes/subagent-multi-agent-mode/specs/ly-lifecycle-commands/spec.md`：新增 delta——`ly-lifecycle-commands` 实施主体语义同步。
- `src/i18n/index.ts`：init 向导审查模型提示语改为"审查 agent A 模型"语义；`src/utils/installer-data.ts`：apply 命令注册描述改为 coding subagent 实施。
- 测试：`src/utils/__tests__/host-adapters.test.ts`、`installer.test.ts` 中 exec 契约断言更新为 subagent 语义；`config.test.ts` 补新字段断言。
- 文档：根 CLAUDE.md / templates/CLAUDE.md / README 中"审查执行模型"与 exec 契约引用同步。
- 升级路径：模板/契约改动仅在重装后生效——已安装用户（`~/.agents/skills/lyx-*`）需运行 `lycx update` 重新渲染模板，旧 exec 契约引用随重装移除。
- 不涉及：`templates/prompts/codex/` 角色词内容、`src/commands/init.ts` 的 reviewModel 设置步骤（新字段本次不进入向导，仅配置读取）。
