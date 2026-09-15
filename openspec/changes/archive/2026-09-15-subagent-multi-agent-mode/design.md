# subagent-multi-agent-mode 设计

## 背景

- 现状审查：`templates/skills-codex/review-plan.md` / `review-code.md` 内嵌 `cat <<'CODEAGENT_EOF' | codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -`，第 2 轮起 `codex exec resume <session-id>`；SESSION_ID 从 JSONL 首个 `thread.started` 事件取；契约文档 `docs/codex-exec-contract.md`。
- 现状实施：`templates/skills-codex/apply.md` 为"当前会话自实施"（单 Agent，无外部委托、无实施后端配置）。
- 现状配置：`src/types/index.ts` `codexHost?: { reviewModel?: string }`；`src/utils/host-adapters.ts` `renderCodexTemplate` 注入 `{{REVIEW_MODEL}}`（空白时剥离 `-m` 回退当前会话）。

## 决策

### D-A: 用 subagent 而非 exec 子会话
- **选择**：审查/实施统一走 subagent（fork 当前上下文 + 模型 override）。
- **理由**：信息传递（关键决策不丢）与模型分工（审查/实施不同模型）是用户明确诉求；subagent 是宿主原生能力，无 CLI 契约漂移维护面。
- **代价与补偿**：subagent 带实施者视角，审查独立性弱化——以"双审查 agent 交叉验证 + 分歧主会话拍板（显式提示用户）+ 不能确认即 Critical"补偿（用户已确认接受该取舍）。

### D-B: 双审查 agent 的模型分配
- 审查 A = `codexHost.reviewModel`（既有字段，语义不变）；审查 B = `codexHost.reviewModelB`（新增，可选）。
- 两者任一未配置 → 回退当前会话模型（subagent 继承发起会话模型）。
- 模型按"模板指示 + 宿主能力"落实：模板写明"审查 B 模型取 reviewModelB，未配置用当前会话模型"；渲染层无需剥离逻辑（subagent 模型由宿主 spawn 能力指定）。

### D-C: coding agent 模型与提交权
- 模型 = `codexHost.codingModel`（新增，可选），未配置回退当前会话模型。
- **coding agent 不 commit**：改动回传主会话，主会话确认后统一 `git commit -m "apply: <change-name>"`——保持主会话对分支历史的控制，避免 subagent 擅自提交；与现有"循环结束后统一提交"语义一致。

### D-D: 讨论协议与分歧裁决
- 并行 spawn 双审查 agent → 各自独立审（互不见对方结论）→ 交换结论 → 达成共识。
- 一致 → 结论回主会话（pass / 问题清单）。
- 分歧 → 主会话拍板，**必须显式提示用户"这是审查分歧"**；主会话能确认 → 按确认结论处理；不能确认 → 判定 Critical（red）进入修复循环。
- 与既有 `ly-review-gates`"Critical 需先经当前会话判断是否认可，不认可则触发分歧未决"衔接：双 agent 分歧是"分歧未决"的新触发源。

### D-E: 契约文档退役
- `docs/codex-exec-contract.md` 顶部标 DEPRECATED，全文保留作历史参考，模板停止引用。
- 新约定（spawn 协议、任务构造、共识判定、分歧裁决）内联进模板本身——subagent 是对话层能力，没有可漂移的 CLI 参数契约；未来若宿主差异变大再抽独立文档。

### D-F: 范围控制
- 角色词（`plan-reviewer.md` / `reviewer.md`）内容不重写，审查 subagent 任务继续引用 ROLE_FILE——改动面收敛到模板 + 配置 + 契约标注。
- `init` 向导本次不加新模型字段的交互步骤（仅配置读取与模板渲染支持），避免向导改动放大范围；如需向导化，作为后续 change。
- 语义保留、机制改写：审查分级输出、终止条件、轮数上限、统一提交等既有语义保持，承载机制改为 subagent 编排（见 `ly-review-gates` / `ly-lifecycle-commands` delta 的 MODIFIED 幅度）。

## 验证

- `openspec validate --changes subagent-multi-agent-mode` 结构合法。
- `pnpm typecheck && pnpm build && pnpm test` 全绿（更新 host-adapters/installer/config 相关断言为 subagent 语义）。
- 安装产物抽查：`@lyx-review-plan` / `@lyx-review-code` / `@lyx-apply` 渲染后不含 `codex exec`、`resume`、`CODEAGENT_EOF` 残留；含双审查 subagent 编排指示。
