> ⚠️ **DEPRECATED（自本 change `subagent-multi-agent-mode` 起）**：审查/实施已迁移 **subagent 多 Agent 模式**（双审查 subagent + coding subagent，spawn 协议/任务构造/共识与分歧裁决内联写入 `templates/skills-codex/review-plan.md`、`review-code.md`、`apply.md`），**模板不再引用本文档**。本文档仅作历史参考保留——subagent 为宿主原生能力，不再有 shell 调用契约的版本漂移维护面。

# codex exec 独立子会话调用契约

> 适用范围：`templates/skills-codex/review-plan.md` 与 `templates/skills-codex/review-code.md` 的审查子会话调用。
> **该契约随 codex CLI 版本漂移，升级 codex 时需复核**（尤其是子命令形态、`--json` 事件名、resume 行为）。

---

## 1. 调用命令形态（首轮）

审查在 `codex exec` **独立子会话**中执行（无当前会话上下文），调用方（当前会话）通过 stdin 传入 heredoc（ROLE_FILE + TASK + OUTPUT 格式约束），审查子会话以 agentic 模式运行，具备在 `WORKDIR` 下自主执行 shell 命令、读取文件的能力。

```bash
WORKDIR=$(pwd)
cat <<'CODEAGENT_EOF' | codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -
ROLE_FILE: ~/.ly/prompts/codex/reviewer.md   # review-plan 用 plan-reviewer.md
<TASK>…</TASK>
OUTPUT: …
CODEAGENT_EOF
```

要点：

- `-C "$WORKDIR"`：审查子会话的工作目录 = 当前仓库目录。
- `--json`：输出 JSONL 事件流（每行一个 JSON 事件），供 SESSION_ID 提取。
- `-m {{REVIEW_MODEL}}`：模型由安装期配置渲染；未配置审查模型时**不带** `-m`（回退当前会话模型）。
- `ROLE_FILE`：`~/.ly/prompts/codex/` 下的绝对路径，审查子会话先读取该角色词再执行审查，此路径为行为契约不可改。
- TASK 只传基线引用说明与路径清单，不预先拼贴文件全文（子会话自行读取）。

## 2. thread.started / session_id 提取规则

`--json` 输出为 JSONL 事件流。取**首个** `thread.started` 事件的 `thread_id` 字段值作为本流程审查会话的 SESSION_ID：

```json
{ "type": "thread.started", "thread_id": "01a09e11-..." }
```

- resume 参数接受该 UUID；后续轮次 resume 复用，**不因 resume 而更换**。
- 事件流中没有 `thread.started`/`thread_id` 事件 → 按"未取得 session_id"处理（后续轮次退化为独立调用，见 §3）。

## 3. resume 续聊循环（第 2 轮起）

从第 2 轮起，命令从 §1 形态改为：

```bash
cat <<'CODEAGENT_EOF' | codex exec -C "$WORKDIR" --json resume <session-id> -
…增量 TASK…
CODEAGENT_EOF
```

要点：

- **resume 子命令不带 `-m`**（模型沿用首轮会话）。
- stdin 仍传增量 TASK，构造方式同首轮，只是内容替换为增量传递（上一轮全部 Critical 原文 + 路径清单），不再整段重传基线。
- 审查子会话在同一会话上下文中复用上一轮记忆（它给的 Critical、已做的修改），会话记忆提供连续性。
- 每轮的 SESSION_ID 都以本流程**首轮**的为准；未取得 SESSION_ID 时，后续轮次退化为独立调用（命令同首轮），并在本轮报告中如实说明"未启用轮间续聊"。
- 第 2 轮起的调用由当前会话自动触发，不要求用户手动重新触发命令。

## 4. 调用失败处理（独立终止条件）

若本次调用超时、非零退出、返回空响应，或返回内容无法解析为 Critical/Warning/Info 格式（也不是明确的"无发现"声明），立即停止循环，报告原始失败信息（退出码/超时说明/原始输出片段），**不得**把失败等同于"本轮无 Critical"或视为清零通过。

## 5. 终止条件八条

任一命中即停止循环，转报告（不执行任何提交，改动留在工作区）；**清零优先于轮数上限**（本轮先判 Critical 是否清零，仅非清零时才检查轮数上限）：

1. **正常清零**：某一轮审查 Critical 数为 0。
2. **熔断**：同一个 Critical（文件路径 + 问题类别 + 定位锚点三者共同判定为同一问题）在相邻两轮审查中都被判定为存在，且上一轮当前会话对它是"认可"状态（已尝试修复但没修好）。
3. **无法安全自动修复**：修复需要产品/业务决策、依赖当前会话不具备的外部凭据、会改变已发布的公开 API/接口契约，或当前会话判断信息不足以给出确定性修复——不得猜测性修改。
4. **修复后验证失败**：本轮修复后运行项目对应验证命令（测试/类型检查/构建，review-plan 为 `openspec validate`）失败，立即停止，报告改动文件清单与验证失败信息。
5. **分歧未决**：当前会话对某条 Critical 上一轮判断"不认可"（未修复），下一轮审查子会话仍判定同一问题存在。
6. **审查对象类型持续系统性误判**：连续 3 轮（含本轮）每一轮的全部 Critical 都被当前会话判定为同一大类系统性误判（理由类别一致，不要求文件/类别/锚点匹配）。
7. **达到全局轮数上限**（默认 5 轮，独立于 1-6 的判定）。
8. **审查调用失败**：见 §4（模板中表述为"审查调用失败视为独立终止条件"）。

触发条件 2-6（或达到轮数上限）时，报告中必须明确指出触发的具体条件、涉及的问题（文件/类别/锚点/判定依据），并说明需要人工介入。"分歧未决"与"审查对象类型持续系统性误判"额外要求并列展示审查子会话每轮的原始发现与当前会话每轮的反驳理由（后者展示连续 3 轮）。

## 6. 与审查-修复循环的配合

- Critical 判定/修复由当前会话执行：逐条判断认可/不认可，认可才修复，不认可必须写反驳理由，不能沉默跳过。
- 每轮调用完成后都生成"逐轮执行日志"，逐字展示该轮审查子会话返回的原始 Critical/Warning/Info 与当前会话判定，直到循环结束。
- 循环期间不提交；仅正常清零时对审查目标全部文件（原始改动 + 循环修复）统一提交一次（`--no-commit` 可关闭）。

## 7. 升级 codex 时的复核清单

- `codex exec` 子命令（`-`/`resume`）形态与 `-C`/`--json`/`-m` 参数是否仍有效。
- `thread.started` 事件名与 `thread_id` 字段是否变化。
- `resume` 是否仍不带模型参数、是否仍按 `thread_id` 复用。
- JSONL 事件流格式（行分隔、字段名）是否变化。
