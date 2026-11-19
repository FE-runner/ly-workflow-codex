# Design

## Context

See `proposal.md` for motivation. The workflow is implemented as self-contained Markdown contracts rendered to Codex and Claude hosts, so removing `run-state.md` changes both the instructions read by the agent and the behavioral eval fixtures.

The existing run-state exists to survive context compression and new user turns. That reliability has a cost: every stage reads and rewrites a metadata file, records task and review evidence repeatedly, and validates frontmatter structure. The user explicitly chose to remove this mechanism and accept manual re-entry after interruption.

## Goals / Non-Goals

**Goals:**

- Remove new `run-state.md` creation, reads, writes, commits, recovery parsing, and archive dependency.
- Preserve durable evidence through `context.md`, `tasks.md`, stage commit trailers, review snapshots, Git history, and final command output.
- Reduce full-auto output and repeated recovery work without losing Critical, test, security, or archive gates.
- Reduce redundant validation while retaining targeted tests for behavior changes and the final archive suite.

**Non-Goals:**

- Deleting existing archived or active `run-state.md` files.
- Adding a replacement state file or runtime parser.
- Removing `context.md`, `review-findings.md`, commit trailers, review gates, or the archive test/typecheck gate.
- Changing `reviewMode`, executor selection, or archive/merge confirmation semantics.

## Decisions

### Decision: workflow state is session-scoped

`@lyx-propose` keeps `EXECUTION_MODE`, isolation coordinates, and the `ask` test-mode answer only for the same uninterrupted full-auto agent turn. If the turn is interrupted, the user re-invokes the desired lifecycle command; the command derives work from Git, `tasks.md`, `context.md`, and relevant commits instead of recovering a persisted pipeline.

Alternative rejected: use `.openspec.yaml` or another metadata file. That would recreate the same read/write and schema burden under a different filename.

### Decision: context.md carries durable human-readable decisions

When isolation or `ask` choices need to survive an intentional handoff, `@lyx-propose` records them in `context.md` under a compact `## 执行上下文` section. Later commands may read those human-readable lines, but the file is not a machine-state ledger and does not track stages, commit queues, review rounds, or next actions.

This retains enough information for archive branch cleanup in a later turn while avoiding YAML frontmatter and conflict rules.

### Decision: evidence is distributed to existing lifecycle artifacts

- Task completion: `tasks.md` checkboxes plus concise command results in the apply report and commit body.
- Stage identity: Conventional Commit message and `Change-Stage` / `Change-Name` trailers.
- Review outcome: final review report, review commit trailer, and `review-findings.md` for unresolved warnings.
- Archive verification: final archive report and archive commit body.
- Design rationale: `context.md`.

Alternative rejected: an `evidence.md` or `review-log.md`. The user asked to remove ledger overhead; adding another artifact would preserve the problem.

### Decision: full-auto uses quiet progress and one final report

Each successfully completed intermediate stage emits one line containing the stage, round count, finding count, and commit SHA. The command does not repeat full stage reports or raw per-round Warning/Info content in the terminal. It emits one consolidated final report after the pipeline reaches its terminal state. Critical/stop details remain visible immediately.

### Decision: review subagents are reused before re-spawn

Round two starts with the existing review subagent through `send_input` / `SendMessage`. A new non-fork subagent is created only when reuse fails. The reuse failure and reason are reported. This removes a contradictory path that caused repeated context re-reading.

### Decision: verification is batched by risk and command

`@lyx-propose` writes tasks so contiguous tasks using the same verification command form a verification batch. `@lyx-apply` may run shared typecheck/test commands once after that batch. A task that changes behavior, requires a failing reproduction test, or has an independent acceptance boundary still verifies at its own checkpoint. `@lyx-archive` always runs the full configured test/typecheck gate once.

### Decision: worktree baseline is cheap by default

After environment files are copied, worktree setup verifies dependency availability and runs typecheck or a project-declared smoke command when available. It does not run the complete test suite. Full tests remain owned by the archive gate, and users may explicitly request a full baseline.

### Decision: legacy run-state is ignored, not migrated

Existing `run-state.md` files stay in place for historical audit. New commands do not parse or update them. If an old active change still depends on run-state state, the user must supply missing information or re-run the relevant command with current Git/tasks facts.

## Risks / Trade-offs

- **Loss of cross-turn automatic recovery** -> Same-turn full-auto remains complete; interrupted runs stop at an explicit stage and report the exact next command. Users re-enter manually.
- **`ask` test mode prompts again** -> Use explicit project/host `normal` or `off` for unattended runs. `context.md` records a choice made by the current propose flow.
- **Branch cleanup lacks structured metadata** -> `context.md` carries source/development/worktree values when available; otherwise archive asks for the target branch and never guesses.
- **Batched validation can discover a defect later** -> Behavior changes and defect reproductions keep task-level tests; batching is limited to contiguous tasks with the same command and no independent risk boundary.
- **Quiet full-auto hides useful detail** -> Raw detail is not required per stage; the final report and artifacts preserve findings, changed files, commits, and verification evidence.
- **Historical run-state files become stale** -> They are ignored rather than silently trusted, preventing stale stage data from driving new commands.

## Migration Plan

1. Update templates and host fragments to remove run-state reads/writes and add context-based execution metadata.
2. Update behavior evals and template assertions before removing run-state fixtures.
3. Replace run-state tests with efficiency and no-ledger contract tests.
4. Update main specs, README, AGENTS, CLAUDE, and evaluation evidence.
5. Roll back by reverting the release if users require persistent cross-turn state; no repository data migration is needed.

## Open Questions

无。
