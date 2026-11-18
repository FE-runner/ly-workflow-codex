# Skill Eval: run-state metadata migration

Run time: 2026-11-18

Command:

```bash
pnpm eval:skills -- \
  --case propose \
  --case apply \
  --case apply-legacy-compat \
  --case review-plan \
  --case review-code \
  --version both \
  --baseline-ref dce2466 \
  --output /tmp/lyx-run-state-eval
```

| Case | Baseline | Current | Key evidence |
|---|---|---|---|
| `propose` | passed | passed | Existing proposal stayed unchanged; command stopped before writing while requesting isolation and execution mode. |
| `apply` | passed | passed | Both versions recognized partial apply; current read frontmatter completion count and stopped without source mutation. |
| `apply-legacy-compat` | passed | passed | TestMode `ask` consumed legacy `.openspec.yaml lyx.testModeDecision=off`; `.openspec.yaml` remained byte-identical and test file stayed absent. |
| `review-plan` | failed | passed | Baseline matched 2/3 patterns; current matched 3/3, found the missing spec Scenario/task contract, and stopped at non-autofixable impact warnings. |
| `review-code` | passed | passed | Both consumed the fixed second-round report and stopped at the rejection hardline; current read run-state frontmatter. |

Summary: 9/10 passed. The command exited `1` because baseline `review-plan` is an expected failed comparison, not an environment failure. No case was `not-executed`.

Evidence files:

- `/tmp/lyx-run-state-eval/summary.json`
- `/tmp/lyx-run-state-eval/*-baseline.json`
- `/tmp/lyx-run-state-eval/*-current.json`
