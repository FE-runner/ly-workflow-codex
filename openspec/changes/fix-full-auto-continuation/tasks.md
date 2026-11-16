# Tasks

## 1. 主 skill 交接契约

- [ ] 1.1 修改 `templates/skills/propose.md`：在全自动执行不变量中写明 review-plan / apply / review-code 的同级 `SKILL.md` 路径、references 全读和“命令标识不算执行”；用 `rg -n "同级|lyx-review-plan/SKILL.md|命令标识不算" templates/skills/propose.md` 验证三个锚点存在
- [ ] 1.2 修改 `templates/skills/review-plan.md`：正常清零后明确读取同级 `lyx-apply/SKILL.md` 及 references，再执行 apply；用 `rg -n "lyx-apply/SKILL.md|references|命令标识不算" templates/skills/review-plan.md` 验证
- [ ] 1.3 修改 `templates/skills/apply.md`：正常完成后明确读取同级 `lyx-review-code/SKILL.md` 及 references，再执行 review-code；用 `rg -n "lyx-review-code/SKILL.md|references|命令标识不算" templates/skills/apply.md` 验证

## 2. references 与 run-state 交接信息

- [ ] 2.1 修改 `templates/skill-references/propose/propose-contract.md` 的步骤 8：把“自动执行 @lyx-*”补充为读取同级 bundle、参数和继续条件；用 `rg -n "lyx-review-plan/SKILL.md|lyx-apply/SKILL.md|lyx-review-code/SKILL.md" templates/skill-references/propose/propose-contract.md` 验证三处路径均存在
- [ ] 2.2 修改 `templates/skill-references/propose/recovery-and-evidence.md`：规定全自动 `下一步安全动作` 必须包含下一阶段命令、同级 skill 路径、change 参数和继续条件；用 `rg -n "下一阶段命令|同级 skill 路径|继续条件" templates/skill-references/propose/recovery-and-evidence.md` 验证
- [ ] 2.3 修改 `templates/skill-references/review-plan/review-contract.md` 的阶段报告段：写明正常清零后的 bundle 读取顺序与失败处理；用 `rg -n "lyx-apply/SKILL.md|完整读取.*references|无法定位" templates/skill-references/review-plan/review-contract.md` 验证

## 3. 多 skill 行为评测运行器

- [ ] 3.1 重构 `src/evals/cases.ts`：将可执行 case 标识与 `EvalSkill` 分离，给 `SkillEvalCase` 增加必填 `skillCommands: EvalSkill[]`，现有四个 case 各自只安装自身 bundle；用 `pnpm typecheck` 验证类型重构无遗漏
- [ ] 3.2 修改 `src/evals/run-skill-evals.ts`：`--case` 接受全部可执行 case 标识，默认 case 仍保持现有四个基础场景，`getSkillEvalCase` 支持显式 `propose-full-auto`，`runUnit` 按 `skillCommands` 依次安装 bundle；用 `pnpm vitest run src/utils/__tests__/skill-evals.test.ts` 验证 CLI 与安装路径
- [ ] 3.3 在 `src/evals/cases.ts` 新增 `propose-full-auto` fixture：预置合法 change、propose commit、`full-auto` run-state、可实施源码与测试 tasks，prompt 从 `@lyx-review-plan eval-change` 开始；用 `pnpm eval:skills -- --case propose-full-auto --version current --setup-only --keep-temp` 验证 fixture 和多 bundle 安装成功
- [ ] 3.4 扩展 `propose-full-auto` 副作用检查：要求 tasks 全部勾选、`src/feature.cjs` 与 `test/feature.test.cjs` 存在、最近提交带 `Change-Stage: apply` 且 `Change-Name: eval-change`、`run-state.md` 记录 `终止类型: normal`、最终文本同时包含 `## Critical` 与 `总轮次:` 的 review-code 报告锚点；先在 `src/utils/__tests__/skill-evals.test.ts` 加静态测试验证 case 存在且校验逻辑在缺 apply commit、缺最终 review-code 锚点或缺 run-state normal 时失败
- [ ] 3.5 更新 `src/utils/__tests__/skill-evals.test.ts` 对默认 case、未知 case、多 bundle 安装和 propose-full-auto 定义的断言；运行 `pnpm vitest run src/utils/__tests__/skill-evals.test.ts` 验证

## 4. 契约测试与文档

- [ ] 4.1 修改 `src/utils/__tests__/run-state.test.ts` 与 `src/utils/__tests__/host-adapters.test.ts`：遍历 codex / claude 渲染结果，断言 propose、review-plan、apply 主文件均含同级 bundle、references 全读和命令标识不算执行；运行 `pnpm vitest run src/utils/__tests__/run-state.test.ts src/utils/__tests__/host-adapters.test.ts` 验证
- [ ] 4.2 修改 `docs/skill-behavior-evals.md`、`evals/skills/propose.md` 与 `evals/skills/README.md`：把全自动续跑从仅文档待办改为可执行 `propose-full-auto` case，Pass Criteria 必须要求同一回合到达 review-code 终态（`## Critical`、`总轮次:`），Evidence Record 写入 baseline/current 结果；用 `rg -n "propose-full-auto|review-code 终态|## Critical|总轮次" docs/skill-behavior-evals.md evals/skills` 验证
- [ ] 4.3 同步 `AGENTS.md`、`CLAUDE.md`、`templates/CLAUDE.md`：写明全自动交接依赖同级 skill bundle 读取，不依赖跨 skill mention；用 `rg -n "同级.*SKILL.md|命令标识不算执行" AGENTS.md CLAUDE.md templates/CLAUDE.md` 验证

## 5. 验证与真实评测

- [ ] 5.1 运行 `openspec validate --changes fix-full-auto-continuation`、`pnpm typecheck`、`pnpm test`，记录退出码与测试计数；任一失败修复后重跑至通过
- [ ] 5.2 运行 `pnpm eval:skills -- --case propose-full-auto --version both --baseline-ref dce2466 --keep-temp --output /tmp/lyx-full-auto-eval`：baseline 必须记录预期失败，current 必须通过 apply commit、`run-state` normal 与 review-code 终态证据；current 模型调用环境失败时只能记 `not-executed`，不得视为通过
- [ ] 5.3 将 5.2 的 baseline/current 状态与关键证据写回 `evals/skills/propose.md` 的 Evidence Record，并在 `evals/results/` 保存不含凭据、完整环境或临时 HOME 的精简 Markdown 报告；用 `git status --porcelain` 确认只新增预期报告
