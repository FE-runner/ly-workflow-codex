## 1. Case 定义与 fixture

- [ ] 1.1 新增 `src/evals/cases.ts`，定义 propose、apply、review-plan、review-code 四种 case 的 setup、prompt、passPatterns、forbiddenPatterns 和 skill command；运行 `pnpm typecheck`，预期 exit 0
- [ ] 1.2 为四个 setup 写入独立临时 Git fixture：propose 的重叠 dirty 文件、apply 的 run-state/task/git 不一致、review-plan 的可执行性缺口、review-code 的误报 Critical；运行 `pnpm test -- src/utils/__tests__/skill-evals.test.ts`，预期 case 静态断言通过
- [ ] 1.3 扩展 `src/utils/__tests__/skill-evals.test.ts`，断言四个 case 都有非空 prompt、至少一个 pass pattern、fixture setup 与合法 skill command；运行 `pnpm test -- src/utils/__tests__/skill-evals.test.ts`，预期通过

## 2. Runner 基础

- [ ] 2.1 新增 `src/evals/run-skill-evals.ts`，支持 `--case`、`--version baseline|current|both`、`--baseline-ref`、`--output`、`--keep-temp`、`--setup-only`；运行 `pnpm typecheck`，预期 exit 0
- [ ] 2.2 实现 baseline source 提取：用 `git worktree add --detach <tmp> <baseline-ref>`，并在 finally 中 `git worktree remove`；运行 `pnpm eval:skills -- --case apply --version baseline --setup-only --keep-temp`，预期临时源目录存在且不调用模型
- [ ] 2.3 实现 skill bundle 安装：从 baseline/current 的 `templates/skills/` 与 `templates/skill-references/` 渲染到 fixture `.agents/skills/lyx-<command>/`，并复制 codex role prompts 到 fixture HOME；运行 `pnpm test -- src/utils/__tests__/skill-evals.test.ts`，预期路径断言通过
- [ ] 2.4 在 fixture HOME 写 `reviewExecutor=main`、`codingExecutor=main`、`testMode=normal` 的 `.codex/lyx/config.toml`，且 child `CODEX_HOME` 继承真实认证目录；运行静态测试确认 runner 不读取或写入 auth 内容

## 3. Codex 执行与判定

- [ ] 3.1 实现 `codex exec --json --ephemeral --skip-git-repo-check -C <fixture> -s workspace-write -c approval_policy="never" --output-last-message <file>` 调用，设置超时并将 stdout/stderr 写入临时 transcript；运行 `pnpm typecheck`，预期通过
- [ ] 3.2 解析 JSONL 的 thread/turn 事件和最终 agent message，缺失最终文本或非零退出时标记 `not-executed`/failed，不当成 passed；单元测试覆盖成功、超时、空输出三类结果
- [ ] 3.3 按 case 的 passPatterns/forbiddenPatterns 判定 passed/failed，并输出 case、version、skill command、exit code、final output 摘要和临时 transcript 路径；运行 runner 的 `--case propose --version current`，预期产生结构化结果

## 4. 输出与安全

- [ ] 4.1 runner 默认输出到临时目录，`--output <dir>` 可指定结果目录；结果文件不得包含 auth/token/cookie/HOME 完整环境；运行一个带 `--output /tmp/lyx-skill-evals-test` 的 case，并 grep 结果无 `auth.json` 内容
- [ ] 4.2 runner 在 `finally` 清理 fixture、baseline worktree 和临时 HOME，`--keep-temp` 仅保留需调查路径并打印绝对路径；运行一个失败/成功 case 的清理与保留分支测试
- [ ] 4.3 在 `docs/skill-behavior-evals.md` 与 `evals/skills/README.md` 写入 `pnpm eval:skills` 用法、版本对照、输出和 `not-executed` 语义；运行 `rg -n "eval:skills|baseline|current|not-executed" docs/skill-behavior-evals.md evals/skills/README.md`，预期关键项命中

## 5. 自动测试与包脚本

- [ ] 5.1 在 `package.json` 新增 `eval:skills` 脚本；运行 `pnpm eval:skills -- --help`，预期打印 case/version/baseline-ref 参数
- [ ] 5.2 为 `src/evals/cases.ts` 与 `src/evals/run-skill-evals.ts` 增加静态单测，覆盖参数解析、case 过滤、pass/fail/not-executed、安全脱敏和 cleanup 计划；运行 `pnpm test -- src/utils/__tests__/skill-evals.test.ts`，预期通过
- [ ] 5.3 更新 AGENTS.md、CLAUDE.md、templates/CLAUDE.md、README 双语与 CHANGELOG，说明评测 runner 是显式开发工具而非用户命令；运行 `rg -n "eval:skills|behavior eval|行为评测" AGENTS.md CLAUDE.md templates/CLAUDE.md README.md README.zh-CN.md CHANGELOG.md`，预期命中

## 6. 真实执行

- [ ] 6.1 运行 `pnpm eval:skills -- --version both --baseline-ref dce2466 --output /tmp/lyx-skill-evals-2026-10-31`，四个场景各两个版本共执行 8 个单元；预期 runner 输出 8 条状态，不允许用占位 not-executed 代替可执行 case
- [ ] 6.2 对 8 条结果逐项核对最终 agent message 与 fixture 副作用，记录 passed/failed/not-executed、关键证据、失败原因到 `evals/results/2026-10-31.md`；运行 `rg -c '^\| (propose|apply|review-plan|review-code) \|' evals/results/2026-10-31.md`，预期 8
- [ ] 6.3 如果 current 任一 case failed，停止宣称通过，并在 `run-state.md` 记录行为失败与后续修复范围；如果全部 current passed，记录 4/4 current passed 以及 baseline/current 的差异结论

## 7. 最终验证

- [ ] 7.1 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`，全部通过后记录命令、退出码和摘要到 run-state
- [ ] 7.2 运行 `openspec validate --all --json`，确认新增/修改 spec 与全部主 spec 合法
- [ ] 7.3 复跑 `pnpm eval:skills -- --case propose --version current --output /tmp/lyx-skill-evals-smoke` 和 `--case review-code --version current --output /tmp/lyx-skill-evals-smoke`，确认 runner 可独立选择 case 且结果文件写入预期目录
