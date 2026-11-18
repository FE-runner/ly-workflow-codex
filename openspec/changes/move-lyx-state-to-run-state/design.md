# Design

## Context

See `proposal.md` for motivation. The current implementation is template-driven rather than a runtime service: propose/apply/review/archive read and write metadata through instructions embedded in skill Markdown. Existing `.openspec.yaml` files are OpenSpec-owned, while `run-state.md` is already the lyx-owned recovery and evidence artifact.

The design therefore has to make the new state format unambiguous for agents on both Codex and Claude hosts, while preserving old active changes without creating a migration command or rewriting historical files.

## Goals / Non-Goals

**Goals:**

- Define one fixed, language-independent frontmatter schema for lyx state in new `run-state.md` files.
- Ensure new changes never add `lyx:` or `x-lyx:` to `.openspec.yaml`.
- Make all lifecycle commands resolve test mode and isolation metadata through the same precedence rules.
- Keep old active changes readable without rewriting them.
- Keep archive branch cleanup functional after the change directory moves.

**Non-Goals:**

- Migrating active or archived changes in bulk.
- Adding a standalone `lyx-state.yaml`.
- Removing legacy `.openspec.yaml lyx:` read compatibility in this change.
- Adding a runtime metadata parser or a new CLI command.

## Decisions

### Decision: run-state frontmatter is the sole new lyx state format

New `run-state.md` files begin with:

```yaml
---
lyx:
  schemaVersion: 1
  change: <change-name>
  stage: propose-self-review | propose | review-plan | apply | review-code | archive-ready | archived
  executionMode: full-auto | manual
  pipelineStage: review-plan | apply | review-code | none
  testModeDecision: normal | off | null
  isolation:
    mode: worktree | branch | none
    sourceBranch: <branch> | null
    developmentBranch: <branch> | null
    worktreePath: <absolute-path> | null
  lastGoodCommit: <sha> | null
  completedTasks:
    done: <number>
    total: <number>
  review:
    planRounds: <number>
    codeRounds: <number>
    terminationType: normal | <other> | null
  nextSafeAction:
    command: <command-id> | null
    skillPath: <relative-skill-path> | null
    change: <change-name> | null
    condition: <short-condition> | null
---
```

The body remains the place for localized summaries, task evidence, verification commands, review details, and rulings. It must not be treated as a second authority for the machine fields; if a body summary conflicts with frontmatter, frontmatter wins and the discrepancy is recorded. Stable frontmatter keys avoid coupling machine state to `[general].language`.

Alternative rejected: use `x-lyx` inside `.openspec.yaml`. It removes the warning, but keeps execution state in an OpenSpec-owned file and preserves the dual-source problem.

### Decision: test mode selection is session-scoped until run-state exists

When effective `testMode` is `ask`, propose asks before generating artifacts and keeps the answer as an in-memory `TEST_MODE_DECISION`. Once the real change name is known, the value is written into run-state frontmatter before self-review and before any later command can resume from disk. An interruption before run-state creation re-prompts rather than claiming the decision was persisted.

Later lifecycle commands resolve:

1. run-state `testModeDecision`;
2. legacy `.openspec.yaml lyx.testModeDecision` for old changes;
3. a new prompt whose answer is written to run-state.

Explicit project/host `normal` or `off` always overrides the change-level decision.

### Decision: isolation metadata moves without changing archive semantics

The values `isolation`, `sourceBranch`, `developmentBranch`, and `worktreePath` keep their existing semantics but move into `run-state.md`. Archive reads the moved file after archival, which preserves the established rule that branch cleanup happens only after the archive commit succeeds.

For old changes, archive may read legacy `.openspec.yaml lyx:` once. It must never rewrite that file. If neither new nor legacy source contains enough information, existing conservative branch-selection behavior remains.

### Decision: compatibility is read-only and precedence is explicit

New writes go only to run-state. Legacy writes are not introduced. Legacy fallback is allowed only when the change has no YAML frontmatter at all. Once a new-format frontmatter exists, missing fields are handled as missing by the new schema and are never filled from `.openspec.yaml`.

Automatic migration is excluded because it would create noisy diffs, rewrite historical evidence, and risk losing unknown fields in `.openspec.yaml`. Removing the legacy read path is a later breaking change.

A legacy change is identified by the absence of YAML frontmatter. If frontmatter exists but cannot be parsed, `lyx` is missing or is not a mapping, or `schemaVersion` is missing or unsupported, the change is treated as corrupt and processing stops. This prevents a malformed new file from silently falling back to stale legacy metadata.

### Decision: no new shared reference file in this change

The fixed schema is documented in `execution-run-state` and inserted into the propose recovery reference. apply/review/archive templates name the same fields and precedence rules directly. A new cross-bundle reference would require changing installer reference declarations and every consumer bundle for little benefit.

## Risks / Trade-offs

- **Markdown frontmatter is not schema-validated by OpenSpec.** → Keep the keys minimal and stable, add template assertions, and require malformed frontmatter to stop before writes or test-related decisions.
- **Existing active changes can still emit OpenSpec warnings.** → Accepted by user decision; do not migrate them. Their warnings disappear naturally when they archive, or remain in immutable archive history.
- **Legacy and new sources may disagree.** → Define run-state as higher priority and require the command to ignore the legacy value when a new value exists.
- **The ask selection can be lost if the process dies before change creation.** → Re-prompt; never fabricate persistence.
- **Branch cleanup depends on a post-archive file that could be modified.** → Continue validating metadata against current Git worktree/branch facts before prompting or mutating anything.

## Migration Plan

1. Add the new frontmatter schema to propose's run-state skeleton and all reader templates.
2. Switch new writes to run-state and remove all new-change `.openspec.yaml lyx:` writes.
3. Add read precedence: run-state → legacy `.openspec.yaml` → conservative git-based fallback.
4. Update specs, docs, template assertions and behavior-eval scenarios.
5. Do not edit any existing change directory or archive snapshot.

Rollback before release is a normal revert of the template/spec/doc changes. After release, users with already-created new-format run-state files can still be read by the old fallback only if a rollback implementation explicitly supports the new frontmatter; therefore release should be preceded by full tests and validation.

## Open Questions

无。格式、写入边界、兼容优先级和存量处理策略均已在本 change 中确定。
