# Risk-based testing policy context

本 change 将测试要求上移为跨 fix/propose/review 的共享风险策略。规范细节见 `specs/risk-based-testing-policy/spec.md`，此处只保留实施时容易误判的边界。

## 关键决策

- 纯展示豁免按实际 diff 语义判断，不按目录或组件层级判断；状态、事件、分支、数据流、业务计算、公开组件契约、接口或配置行为任一存在，即不适用豁免。
- `skip_specs: true` 只在 proposal 明确纯展示、New/Modified Capabilities 为空时成立；声明 Capability 后仍必须提供 delta spec。
- 补充边界覆盖保留 Warning 以进入 `review-findings.md`，固定 `可自动修复：否` / `影响落地：否`，否则降为 Info 会丢失记录。
- 逻辑 bug 的复现测试、核心行为覆盖、契约一致性和 archive 完整验证均不因本次放宽而变化。

## 已知约束

- 不新增运行时分类器；执行 agent 必须基于 diff 和 proposal 留下分类依据。
- 不新增通用模板片段机制；短条款继续在共享模板与双宿主角色词中镜像，由现有一致性测试守护。
- 模板修改只更新仓库产物，不自动刷新用户已安装的全局 skills；发布后仍需 `lycx update` 或重装。

## 实施决策

- 模板继续使用完整双轴字段名；`AGENTS.md`、`CLAUDE.md` 与 README 使用 `否+否` 作为可读缩写，含义固定为 `可自动修复：否` / `影响落地：否`。
- 新增防回退断言集中在 `host-adapters.test.ts`：共享模板四象限仍逐字一致，Codex / Claude 两份判级标准分别与对应共享模板逐字一致。
- 本次仅验证仓库模板与测试，未安装或刷新 `~/.agents/skills/lyx-*`、`~/.codex/lyx/prompts/codex/`、`~/.claude/agents/lyx-*`；运行中的 installed skills 仍是旧规则。
