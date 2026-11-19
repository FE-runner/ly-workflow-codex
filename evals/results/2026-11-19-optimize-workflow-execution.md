# Skill Eval: optimize workflow execution

Run time: 2026-11-19

Primary current run:

```bash
pnpm eval:skills -- \
  --version current \
  --case propose \
  --case apply \
  --case apply-legacy-compat \
  --case review-plan \
  --case review-code \
  --case propose-full-auto \
  --case propose-self-review-full-auto \
  --output /tmp/lyx-evals-no-ledger-20261119
```

| Case | Result | Key evidence |
|---|---|---|
| `propose` | passed | Preserved the existing proposal and stopped at startup choices without creating run-state. |
| `apply` | passed | Detected tasks/source partial apply and stopped without source mutation. |
| `apply-legacy-compat` | failed in first run | Correctly prompted because the template did not yet explicitly reuse a legacy valid read-only decision. |
| `review-plan` | passed | Found the missing executable contract and stopped at non-autofixable impact items. |
| `review-code` | passed | Reused the fixed second-round report and stopped at the rejection hardline. |
| `propose-full-auto` | failed classification in first run | Apply commit, implementation, tests and no-run-state side effects passed; context review record was initially missing. |
| `propose-self-review-full-auto` | passed | Completed propose → review-plan → apply → review-code without creating run-state. |

Targeted reruns:

```bash
pnpm eval:skills -- --version current --case apply-legacy-compat --case propose-full-auto --output /tmp/lyx-evals-no-ledger-rerun-20261119
pnpm eval:skills -- --version current --case propose-full-auto --output /tmp/lyx-evals-no-ledger-final3-20261119
```

- `apply-legacy-compat`: passed after explicitly preserving read-only legacy `.openspec.yaml lyx.testModeDecision`.
- `propose-full-auto`: all side effects passed in the rerun (`tasksChecked=true`, `reviewRecorded=true`, `runStateExists=false`, apply commit present, implementation/test present). The final text used valid Chinese variants (“全自动流程已连续执行…”, “review-code 正常清零结束”) that the first classifier did not recognize.
- Offline reclassification using the updated case patterns against the same saved transcript: 3/3 pass patterns matched, 0 forbidden patterns, side effects passed.

Final behavioral status across affected current cases: 7/7 passed after classifier correction. No case was `not-executed`.

Evidence files:

- `/tmp/lyx-evals-no-ledger-20261119/summary.json`
- `/tmp/lyx-evals-no-ledger-rerun-20261119/summary.json`
- `/tmp/lyx-evals-no-ledger-final3-20261119/summary.json`
