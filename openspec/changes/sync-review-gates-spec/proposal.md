## Why

`ly-review-gates` 的基线 spec 仍保留两套已废止的调用形态：`codex exec` / `-m` / `session_id` / `resume` / `docs/codex-exec-contract.md`，以及"工作区干净即报无变更可审查、SHALL NOT 回退历史 commit"的旧审查范围语义。当前已落地模板 `templates/skills-codex/review-code.md` / `review-plan.md` 实际以双审查 subagent、`apply:`/`propose:` commit 基线、`[codexHost]` 模型与推理档字段执行，二者已经不一致；若不消除，后续按 spec 维护或复核时会把已废止行为继续当作契约。

## What Changes

- 重写 `ly-review-gates` 的 Purpose，把两个审查关卡描述为"双审查 subagent + `[codexHost]` 模型字段 + 可选推理档字段"落地，删除 `codex exec` / `{{REVIEW_MODEL}}` / `docs/codex-exec-contract.md` 旧调用机制描述。
- 重写 `代码审查读取 git diff 并分级输出发现`：审查基线改为"最近一期 `apply:` commit，不存在时退化为最近一期 `propose:` commit；即使工作区/暂存区干净仍按该 commit 审查，不报无变更"；删除历史 commit 回退废弃语义、`codex exec -m` 模型回退语义和 `session_id`/`resume` 续聊要求；保留首轮 TASK 只传基线引用与未跟踪文件路径、不拼贴 diff 全文的规则。
- 重写 `方案审查分级输出发现`：调用方式改为"双审查 subagent fork 当前上下文 + 范围点名 + 路径清单，模型按 `reviewModel`/`reviewModelB` 配置并附加对应推理档字段"，删除 `codex exec` / `-m` / `sanitizeReviewModel` 清洗回退语义和 `plan-reviewer.md` 经 `codex exec` 调用的旧描述；保留方案审查只审 artifact/delta spec、首轮只传路径清单、基线 spec 引用检测与 `spec` 未覆盖 What Changes 检查规则。
- 把 `审查调用失败视为独立终止条件` 与 `审查关卡以双审查 subagent 执行` 两处 changelog 补丁内容并入正文，使正文直接陈述"运行期失败 / 环境级不可用 / 单 agent 失败"三阶段语义与"旧调用形态已废止"，不再以"上限文补丁覆盖基线"的形式残留。
- 对齐推理档字段语义：`reviewModel` 对应 `reviewReasoningEffort`，`reviewModelB` 对应 `reviewReasoningEffortB`；非空时随对应 spawn 传入，空白不传，禁止模型名到档位的硬编码映射。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `ly-review-gates`: 更新审查关卡调用契约与审查范围语义，使其与已落地 `review-plan` / `review-code` 模板一致，并引入审查模型对应推理档字段的传递规则。

## Impact

- 仅修改 `openspec/specs/ly-review-gates/spec.md` 的规范文本与场景；不改实现代码、不新增功能、不改变模板文件。
- 本 change 不触碰 `/ly:*` 与 `@lyx-*` 命名基准、4 个已 DEPRECATED spec、`docs/codex-exec-contract.md` 文件本体及其他 spec。
