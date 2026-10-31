# Run State

- Change: adopt-superpowers-process-practices
- Stage: archived
- Source branch: main
- Development branch: codex/superpowers-alignment
- Last good commit: fa3d17c
- Archive path: openspec/changes/archive/2026-10-31-adopt-superpowers-process-practices
- Next safe action: none

## Task Evidence

- Completed tasks: 32/32
- Eval assets, references installer, compact skill split, run-state lifecycle, readiness checks, debugging rules, evidence rules, docs and tests completed.

## Baseline Eval

- propose: not-executed — main codingExecutor path prohibits spawning eval agents in apply; scenario and current behavior reviewed manually.
- apply: not-executed — main codingExecutor path prohibits spawning eval agents in apply; scenario and current behavior reviewed manually.
- review-plan: not-executed — main codingExecutor path prohibits spawning eval agents in apply; scenario and current behavior reviewed manually.
- review-code: not-executed — main codingExecutor path prohibits spawning eval agents in apply; scenario and current behavior reviewed manually.

## Modified Eval (intermediate)

- propose: not-executed — main codingExecutor path prohibits spawning eval agents; structural and bundle tests passed.
- apply: not-executed — main codingExecutor path prohibits spawning eval agents; run-state and evidence contracts statically validated.
- review-plan: not-executed — main codingExecutor path prohibits spawning eval agents; reference bundle and readiness rules statically validated.
- review-code: not-executed — main codingExecutor path prohibits spawning eval agents; reference bundle and evidence rules statically validated.

## Modified Eval (final)

- propose: not-executed — main codingExecutor path prohibits spawning eval agents; final scenario reviewed against the installed bundle, reference reads, run-state fields and commit rules.
- apply: not-executed — main codingExecutor path prohibits spawning eval agents; final scenario reviewed against recovery, ruling and evidence rules.
- review-plan: not-executed — main codingExecutor path prohibits spawning eval agents; final scenario reviewed against readiness and review-loop references.
- review-code: not-executed — main codingExecutor path prohibits spawning eval agents; final scenario reviewed against false-positive adjudication and run-state evidence rules.

## Review State

- Review rounds: 5
- Termination type: normal
- Round 1: 3 Critical, 7 Warning; all Critical accepted and mechanically repaired in proposal artifacts.
- Round 2: 1 Critical, 4 Warning; accepted, adding final behavior-eval gate, precise eval evidence format, run-state completed-task field, and references source mapping.
- Round 3: 0 Critical, 1 Warning; accepted, fixing eval subsections and per-skill fail-fast verification commands.
- Round 4: 0 Critical, 1 new mechanical Warning; accepted, correcting awk parenthesis escaping in verification commands.
- Round 5: 0 Critical, 0 Warning, 0 Info findings; normal clearance confirmed with extraction and validation evidence.
- Code round 1: 2 Critical, 3 Warning; accepted, fixing reference traversal, transactional installation, review run-state commits, empty-commit criteria, and reference file-type checks.
- Code round 2: 0 Critical, 0 Warning, 0 Info findings; normal clearance confirmed with containment, rollback, run-state commit and file-type evidence.

## Verification

- final testMode: normal
- final testMode source: project config
- `openspec validate --changes adopt-superpowers-process-practices`: exit 0, 1/1 change valid
- `git diff --check`: exit 0, no whitespace errors
- `pnpm lint`: exit 0
- `pnpm typecheck`: exit 0
- archive `pnpm test`: exit 0, 25 files / 435 tests passed
- archive `pnpm typecheck`: exit 0
- archive `pnpm build`: exit 0
- `pnpm test -- src/utils/__tests__/host-adapters.test.ts src/utils/__tests__/installer.test.ts`: exit 0; compact main size and references install assertions passed
- `openspec validate --all --json`: exit 0, 24/24 items valid
- review-plan unified commit: 02cbd59
- apply unified commit: 5d51e24
- review-code unified commit: 406363c
- archive unified commit: 4de945e
- branch cleanup: local --no-ff merge into main completed; development branch deleted; no push
- branch cleanup record commit: self

## Rulings

- Ruling: 使用独立 `templates/skill-references/` 源目录；理由：保持命令注册与单文件主模板假设；错误代价：安装器需新增 sidecar 复制逻辑。
- Ruling: run-state 受版本控制；理由：避免未跟踪运行文件触发全仓 dirty 例外；错误代价：各阶段 commit 需显式包含 run-state 变更。
- Ruling: required reference 由主 `SKILL.md` frontmatter `references:` 列表声明；理由：安装器、doctor 与测试共享机器可判定契约；错误代价：主文件 frontmatter 增加非流程字段。
- Ruling: review/plan contract 采用单个完整 `review-contract.md`，而不是设计初稿中的多文件拆分；理由：机械搬移语义最稳且主文件已显著低于 20KB；错误代价：单个 reference 较大但仅在关键步骤按需读取。
- Ruling: 行为评测 agent 未在当前 apply 阶段执行；理由：`codingExecutor=main` 明确禁止 apply 内 spawn 子代理；错误代价：当前证据是最终模板静态复核 + 自动化结构测试，不能替代真实 agent 行为评测。
