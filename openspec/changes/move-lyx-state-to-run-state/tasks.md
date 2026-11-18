# Tasks

## 1. Define run-state frontmatter and propose writes

- [ ] 1.1 Update `templates/skill-references/propose/recovery-and-evidence.md` with the fixed `lyx` YAML frontmatter schema from `design.md`, including schemaVersion, change, stage, executionMode, pipelineStage, testModeDecision, isolation, lastGoodCommit, completedTasks, review, and nextSafeAction; remove duplicated machine-state bullets from the Markdown body and make frontmatter authoritative; verify `rg -n "^lyx:|schemaVersion|testModeDecision|nextSafeAction|正文.*权威|frontmatter" templates/skill-references/propose/recovery-and-evidence.md` finds every field and the authority rule.
- [ ] 1.2 Update `templates/skill-references/propose/propose-contract.md` so the ask-mode selection is held in the session before change creation, then written into run-state immediately after the real change name is known; remove all instructions that write `lyx.testModeDecision` or isolation fields to `.openspec.yaml`; verify `rg -n "lyx\\.testModeDecision|\\nlyx:" templates/skill-references/propose/propose-contract.md` returns no new-change write instruction and run-state initialization remains before self-review.
- [ ] 1.3 Replace propose step 5.6's `.openspec.yaml` metadata write with a run-state frontmatter update containing isolation metadata and optional test mode decision, and update step 5.7 to merge state incrementally without overwriting evidence; verify the contract contains one canonical `run-state.md` write flow and still runs `openspec validate --changes <change-name>` before commit.
- [ ] 1.4 Update `templates/skills/propose.md` recovery and full-auto invariants to read `stage`, `executionMode`, isolation, and next coordinates from run-state frontmatter, while preserving legacy fallback for old changes; verify `pnpm test -- src/utils/__tests__/run-state.test.ts` passes after the related test updates.

## 2. Switch apply and review readers to run-state

- [ ] 2.1 Update `templates/skills/apply.md` to resolve `testModeDecision` from run-state frontmatter, then legacy `.openspec.yaml lyx.testModeDecision` only for old changes; ensure prompt answers are written to run-state and run-state is included in the apply commit list; verify the template contains `run-state.md` read/write instructions and no instruction to write `.openspec.yaml` lyx fields.
- [ ] 2.2 Update `templates/skill-references/review-plan/review-contract.md` and `templates/skill-references/review-plan/recovery-and-evidence.md` to read run-state `testModeDecision` with the same legacy fallback and commit `run-state.md` when a decision is written or consumed; verify both files name run-state before legacy `.openspec.yaml`.
- [ ] 2.3 Update `templates/skill-references/review-code/review-contract.md` and `templates/skill-references/review-code/recovery-and-evidence.md` with the same precedence and commit behavior; verify `rg -n "run-state|lyx\\.testModeDecision|testModeDecision" templates/skill-references/review-plan templates/skill-references/review-code` shows run-state as the primary source.
- [ ] 2.4 Update `templates/skills/review-plan.md` and `templates/skills/review-code.md` if their entry/recovery summaries mention change metadata, so they point to run-state and preserve legacy read compatibility; verify rendered template assertions in `src/utils/__tests__/host-adapters.test.ts` and run-state tests cover the new wording.

## 3. Move archive and branch-cleanup reads

- [ ] 3.1 Update `templates/skills/archive.md` test-mode resolution to read run-state first, then legacy `.openspec.yaml lyx.testModeDecision` for old changes; ensure the archive commit includes `run-state.md` when a decision is written or dirty state is consumed; verify `rg -n "run-state\\.md|lyx\\.testModeDecision|testMode=off" templates/skills/archive.md` shows the new precedence and no new `.openspec.yaml` write.
- [ ] 3.2 Update the archive post-commit branch cleanup section in `templates/skills/archive.md` to read archived `run-state.md` isolation metadata first and legacy archived `.openspec.yaml lyx:` only as a read-only fallback; preserve all existing Git safety checks, conservative target-branch selection, and no-push behavior; verify the template still contains the exact merge/worktree-remove/branch-delete commands asserted by tests.
- [ ] 3.3 Update `templates/skills/worktree.md` guidance so propose records isolation metadata in run-state, not `.openspec.yaml`, and manual worktree commands remain non-persistent; verify the text no longer instructs `.openspec.yaml` writes and `pnpm test -- src/utils/__tests__/host-adapters.test.ts` passes after assertion updates.

## 4. Encode compatibility and regression tests

- [ ] 4.1 Extend `src/utils/__tests__/run-state.test.ts` to assert the frontmatter schema keys, language-independent field names, ask-mode persistence timing, and the precedence run-state → legacy `.openspec.yaml` → conservative fallback; verify `pnpm test -- src/utils/__tests__/run-state.test.ts` passes.
- [ ] 4.2 Update `src/utils/__tests__/host-adapters.test.ts` assertions for propose/apply/archive/review templates: assert new changes do not write `.openspec.yaml lyx:` fields, run-state carries isolation and test mode, and legacy fallback remains explicit; verify `pnpm test -- src/utils/__tests__/host-adapters.test.ts` passes.
- [ ] 4.3 Add a focused regression test that rejects a new-change template flow containing `lyx:` or `x-lyx:` writes while allowing the legacy read string in compatibility instructions; verify the test fails against the old template text locally or via an inline fixture and passes against the updated templates.
- [ ] 4.4 Update `src/evals/cases.ts` and affected eval fixtures so propose/apply/review/archive scenarios use run-state frontmatter, and add a legacy `.openspec.yaml lyx:` fixture that proves read-only compatibility; verify `pnpm test -- src/utils/__tests__/skill-evals.test.ts` passes.

## 5. Update docs, behavior-eval records, and symmetric references

- [ ] 5.1 Update `README.md` and `README.zh-CN.md` test-mode/config/workflow sections with the run-state frontmatter example, no-new-`.openspec.yaml` rule, legacy read-only compatibility, natural warning behavior for untouched old changes, and the fact that removing legacy reads is a future breaking change; verify both languages describe the same precedence, file locations, and compatibility boundary.
- [ ] 5.2 Update `AGENTS.md`, `CLAUDE.md`, and `templates/CLAUDE.md` to make run-state the sole new lyx state source and remove statements that `.openspec.yaml` stores `lyx.testModeDecision` or isolation metadata; verify `rg -n "\\.openspec\\.yaml.*lyx|lyx\\.testModeDecision|isolation metadata" AGENTS.md CLAUDE.md templates/CLAUDE.md` only reports legacy-compatibility statements.
- [ ] 5.3 Update `CHANGELOG.md` with the new run-state frontmatter contract and compatibility behavior, and update `docs/skill-behavior-evals.md` plus `evals/skills/propose.md` with scenarios covering propose state persistence, apply/review/archive reads, and legacy fallback; verify each scenario names an observable artifact or command.
- [ ] 5.4 Re-run the documented real behavior-eval cases for propose/apply/review-plan/review-code with a new baseline and current bundle, and record command, exit status, pass/fail/not-executed counts, and key evidence in `evals/skills/*.md`; if credentials or environment prevent execution, record `not-executed` with the exact reason instead of claiming a pass.

## 6. Integration verification

- [ ] 6.1 Run `openspec validate --changes move-lyx-state-to-run-state` and confirm the change validates with zero errors; verify the command's exact output in task evidence.
- [ ] 6.2 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and confirm all pass; record exit codes and counts in run-state.
- [ ] 6.3 Run `git diff --check` and confirm no whitespace errors; inspect `git status --porcelain` and verify no existing change directory or archive snapshot was modified.

## Workflow follow-up

- After review-plan and review-code are normal, use `@lyx-archive` to run the archive gate and move this change into `openspec/changes/archive/`.
