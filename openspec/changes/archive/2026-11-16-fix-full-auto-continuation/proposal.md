## Why

全自动流程当前已经要求阶段报告后继续，但在 Codex 中 `@lyx-review-plan`、`@lyx-apply`、`@lyx-review-code` 是命令标识，不是可执行的跨 skill 调用工具。主 agent 只看到“调用下一阶段”的文字，却没有被明确要求读取同级下一阶段的 `SKILL.md` 和 references，因此仍会在阶段报告后结束回合。现有行为评测也只走到第一个隔离询问，没有验证真正的多阶段续跑。

## What Changes

- 定义统一的“显式阶段交接”：全自动进入下一阶段前，必须读取当前 skill 同级目录下 `lyx-<下一阶段>/SKILL.md`、解析其 frontmatter references 并完整读取这些 references，然后按下一阶段流程执行；只输出 `@lyx-...`、说明“下一步应执行”或等待用户再次触发均不算完成交接。
- 在 `propose`、`review-plan`、`apply` 的主 `SKILL.md` 中加入同一套简短的全自动交接不变量，明确各自下一阶段 skill；`review-code` 作为正常终态不加下一阶段。
- 强化 `run-state.md` 的 `下一步安全动作`，要求全自动状态同时记录下一阶段名称、同级 skill 路径、命令参数和继续条件，避免只写模糊的“继续”。
- 扩展行为评测运行器，使单个场景可以安装并调用多个 skill bundle；新增真实全自动续跑场景，从 review-plan 正常清零开始，验证同一执行回合内确实进入 apply 并继续到 review-code，而不是只检查文本里有没有“继续”两个字。
- 同步主 spec、评测说明、模板契约断言和 `AGENTS.md` / `CLAUDE.md` 的执行模型说明。

## Capabilities

### New Capabilities

### Modified Capabilities

- `ly-propose-flow`: 明确全自动跨 skill 交接的可执行步骤，并要求阶段报告后读取下一阶段 bundle。
- `skill-reference-bundles`: 将续跑不变量扩展到 propose、review-plan、apply 主文件，并把“显式读取下一阶段 bundle”纳入压缩后仍可见的契约。
- `execution-run-state`: 让 run-state 的下一步安全动作可机械指导下一阶段交接。
- `skill-behavior-evals`: 支持多 skill bundle fixture，并新增全自动跨阶段连续性的真实行为场景。

## Impact

- 工作流模板：`templates/skills/propose.md`、`templates/skills/review-plan.md`、`templates/skills/apply.md` 及对应 references。
- 行为评测：`src/evals/cases.ts`、`src/evals/run-skill-evals.ts`、`src/utils/__tests__/skill-evals.test.ts`、`evals/skills/propose.md`、`docs/skill-behavior-evals.md`。
- 契约测试：`src/utils/__tests__/run-state.test.ts`、`src/utils/__tests__/host-adapters.test.ts`。
- 文档：`AGENTS.md`、`CLAUDE.md`、`templates/CLAUDE.md`。
- 运行行为：全自动阶段交接在 Codex 与 Claude Code 安装产物中均使用同级 skill 路径，不依赖宿主提供“调用另一个 skill”的工具。
