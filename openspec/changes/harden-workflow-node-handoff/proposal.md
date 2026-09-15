## Why

迁移到 subagent 多 Agent 模式（change `subagent-multi-agent-mode`）后，skill 模板只描述了"主会话 spawn 审查/实施 subagent"的职责，缺少与宿主 spawn 能力一致的**轮内纪律**与**阶段衔接校验**：主会话 spawn 子 agent 后可能在同轮内不等待结果就结束回合（子 agent 返回的结果无人消费）、用自然语言描述"已分发"却不实际调用 spawn、阶段切换无前置校验硬闯下一步。现象是流程总在分配给子 agent 后主 agent 中断——即使子 agent 返回了结果也会断，或"说分配但没实际分配"就中断。

## What Changes

- 三个 skill 模板（`review-plan` / `review-code` / `apply`）统一补**轮内纪律**：spawn 子 agent 后必须在同一轮内等待结果（wait），收到结果先逐字转达再判定；SHALL NOT 仅以自然语言描述"已分发/将分发"代替实际 spawn 调用；子 agent 结果消费完即关闭，SHALL NOT 假设跨轮存活。
- 审查返回**有效性判定**：子 agent 返回必须包含明确的分级结论或"无发现"声明；空响应、疑似截断、无结论的返回视为无效，按运行期失败终止，SHALL NOT 被误判为"本轮无 Critical"。
- **wait 超时终止语义**：等待子 agent 结果超时/卡死按运行期失败终止并如实报告；**交换结论长链失败兜底**：相互交换结论过程中任一次等待/发送失败即终止，SHALL NOT 用推测补全对方结论。
- 审查范围**基线锚定**：首轮确定审查基线 commit SHA 并固定，后续轮次审查范围以固定基线 + 工作区/暂存区现状为准，SHALL NOT 每轮重算 HEAD；审查-修复循环期间 SHALL NOT 产生任何中途 commit。
- **回退显式状态标记**：环境级 subagent 不可用回退当前会话直接执行时，输出固定格式标记 `[回退] subagent 不可用: <原始报错>`，禁止回退后以自然语言假装已完成审查/实施。
- **apply 主会话提交前核对文件清单**：coding subagent 回传改动清单后，主会话用 `git status --porcelain` 与实际改动文件比对，不一致则停止并报告，不照单全收。
- **propose 全自动节点前置校验**：进入 apply 前验证 review-plan 正常清零（清零报告存在）、进入 review-code 前验证 `apply: <change-name>` commit 存在；校验不过 SHALL 停在该节点报告，不硬闯下一阶段。
- **propose 手动路径状态摘要**：各询问点补当前阶段与下一步的状态摘要，保证"是"之后的续接无歧义。
- 终止报告附**下一步可用命令指引**（如 `@lyx-review-plan <change-name>` 重跑），支撑"断在明确节点、报告清晰、人工自行触下一步"的续接口径。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `ly-propose-flow`: 全自动流水线节点衔接前置校验、apply 主会话文件清单核对、手动路径询问点状态摘要。
- `ly-review-gates`: 双审查 subagent 轮内纪律（同轮 wait、有效性判定、wait 超时、交换结论失败兜底）、审查范围基线锚定、循环期不 commit、终止报告下一步指引。
- `subagent-agent-config`: 环境级不可用回退时输出显式状态标记。

## Impact

- 改动文件：`templates/skills-codex/review-plan.md`、`review-code.md`、`apply.md`、`propose.md` 四个模板；`openspec/specs/ly-propose-flow/spec.md`、`openspec/specs/ly-review-gates/spec.md`、`openspec/specs/subagent-agent-config/spec.md` 三个 delta spec。
- 不涉及：CLI 源码（`src/`）、`templates/prompts/codex/` 角色词（ROLE_FILE 不重写）、依赖、安装位。
- 验证：`openspec validate` + `pnpm typecheck && pnpm build && pnpm test`；另附一轮冒烟验证（手动跑 review-plan + apply 确认 spawn/wait 行为）。
