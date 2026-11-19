# Tasks

## 1. 删除核心模板中的 run-state

- [x] 1.1 Update `templates/skills/propose.md` to remove run-state creation/update/recovery and add compact `context.md` execution-context/self-review output; verify `! rg -n 'create|创建|更新|run-state\\.md|schemaVersion|nextSafeAction' templates/skills/propose.md` except explicit “SHALL NOT create” compatibility lines.
- [x] 1.2 Update `templates/skills/apply.md` and `templates/skills/archive.md` to remove run-state reads/writes/commits and use Git, tasks, context, reports, and commit trailers; verify both files contain no new-run-state write/read instructions and retain testMode/archive gates.
- [x] 1.3 Update `templates/skills/review-plan.md`, `templates/skills/review-code.md`, and `templates/skills/worktree.md` to remove run-state references, change isolation persistence to context, and replace full-test worktree baseline with dependency/typecheck/smoke default; verify `rg -n 'run-state' templates/skills` only reports explicit legacy-compatibility/ignored lines.

## 2. 审查复用与安静报告

- [x] 2.1 Update `templates/skills/review-plan.md` and `templates/skills/review-code.md`: round two prefers the host continuation API, re-spawn only on failure; normal rounds report counts/evidence, stop conditions show details immediately, final report is consolidated; verify old conflicting instructions are absent.
- [x] 2.2 Update full-auto continuation in `templates/skills/propose.md`, `templates/skills/review-plan.md`, and `templates/skills/apply.md` to emit one-line intermediate status and not repeat full reports; verify static tests assert the quiet-report and reuse language.
- [x] 2.3 Update `templates/hosts/codex/fragments/review-plan/*`, `templates/hosts/codex/fragments/review-code/*`, and corresponding Claude fragments/agents so host-specific text consistently says reuse first, re-spawn only on failure, and no run-state lookup; verify rendered Codex/Claude bundles contain neither the old “round two respawn” rule nor run-state instructions.
- [x] 2.4 Update skill-reference assertions for the post-compression invariant to require same-turn bundle loading plus current session/Git/tasks facts, not run-state; verify `src/utils/__tests__/skill-references.test.ts` and `src/utils/__tests__/host-adapters.test.ts` reject the old wording.

## 3. 自审、验证批次与 worktree baseline

- [x] 3.1 Update `templates/skills/propose.md` self-review to use grouped pass lines plus expanded exceptions in `context.md`, preserving full coverage and mechanical/business classification; verify it contains an example grouped range and `待用户决策` expansion rule.
- [x] 3.2 Update `templates/skills/apply.md` and `templates/hosts/claude/agents/lyx-implementer.md` to batch contiguous low-risk tasks sharing one verification command while retaining task-level tests for behavior, defect reproduction, security/migration, and explicit standalone checks; verify both texts contain the same batching exception rule.
- [x] 3.3 Update `templates/skills/worktree.md` and `templates/skills/propose.md` so worktree setup defaults to dependency availability plus typecheck/smoke and does not run the full test suite unless explicitly requested; verify both files state archive owns the full test gate.

## 4. Test-mode and evidence replacement

- [x] 4.1 Update all lifecycle templates to make `ask` a current-call/session decision, not a persisted run-state decision; verify no template tells a new change to persist test mode and explicit config normal/off remains authoritative.
- [x] 4.2 Update archive verification and branch cleanup text to use current Git plus `context.md` `## 执行上下文`, and to ask for a target branch when unavailable; verify stale `run-state` metadata and automatic source-branch fallback text are gone.
- [x] 4.3 Update `src/evals/cases.ts` fixtures to remove run-state; change apply/review/full-auto cases to use tasks, context, commit trailers, and current session facts; verify fixtures only use run-state-existence assertions.

## 5. Tests and static contracts

- [x] 5.1 Remove `src/utils/__tests__/run-state.test.ts` and replace its workflow assertions with a focused no-ledger/efficiency test covering quiet intermediate reports, grouped self-review, batched verification, context-based isolation, and worktree baseline; verify `pnpm exec vitest run src/utils/__tests__/workflow-efficiency.test.ts` passes.
- [x] 5.2 Update `src/utils/__tests__/host-adapters.test.ts`, `src/utils/__tests__/skill-evals.test.ts`, and any rendered-template assertions to remove run-state expectations and assert the new reuse/reporting/context/batching behavior; verify focused Vitest files pass.
- [x] 5.3 Update `src/utils/__tests__/skill-evals.test.ts` and eval case definitions for the no-run-state full-auto path and subagent reuse fallback; verify unit fixtures pass without invoking real `codex exec`.

## 6. Specs, docs, and behavior evidence

- [x] 6.1 Update the delta Purpose/overview wording and the main spec Purpose only; leave main requirements for archive `Sync now`; verify `openspec validate --changes optimize-workflow-execution` passes.
- [x] 6.2 Update `README.md`, `README.zh-CN.md`, `AGENTS.md`, `CLAUDE.md`, and `templates/CLAUDE.md` to describe no run-state, context-based execution metadata, current-call ask decisions, quiet full-auto reporting, batched verification, and cheap worktree baseline; verify both languages and both host descriptions agree.
- [x] 6.3 Update `CHANGELOG.md`, `docs/skill-behavior-evals.md`, `evals/skills/propose.md`, `evals/skills/apply.md`, `evals/skills/review-plan.md`, and `evals/skills/review-code.md` with the breaking change and evidence scenarios; run affected real evals and record `evals/results/2026-11-19-optimize-workflow-execution.md`.

## 7. Integration verification

- [x] 7.1 Run `openspec validate --changes optimize-workflow-execution` and `pnpm lint`; verify exit 0.
- [x] 7.2 Run `pnpm typecheck` and `pnpm test`; verify typecheck exit 0 and Vitest 27 files / 471 tests passed.
- [x] 7.3 Run `git diff --check`; verify no output, and `git status --porcelain` shows no archive snapshot changes.

## Workflow follow-up

- Run review-plan and review-code through the repository workflow after implementation.
- Use `@lyx-archive` separately after review acceptance; archive/merge requires explicit scope confirmation.
