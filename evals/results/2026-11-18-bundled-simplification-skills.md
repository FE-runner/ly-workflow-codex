# Skill Eval: bundled simplification skills

Run time: 2026-11-18

Primary comparison:

```bash
pnpm eval:skills -- \
  --version both \
  --baseline-ref HEAD \
  --case propose,apply,review-plan,review-code \
  --output /tmp/lyx-evals-bundled-skills-20261118
```

The primary run passed 7/8 units. `review-plan current` initially downgraded a missing-Scenario `openspec validate` failure from Critical to a non-autofixable Warning. The review-plan rubric was corrected to keep plan-artifact validation failures as Critical, and the current case was rerun:

```bash
pnpm eval:skills -- \
  --version current \
  --case review-plan \
  --output /tmp/lyx-evals-review-plan-fixed-20261118
```

| Case | Baseline | Current | Key evidence |
|---|---|---|---|
| `propose` | passed | passed | Both stopped at the isolation / mode checkpoint without mutating the existing proposal. |
| `apply` | passed | passed | Both detected partial apply from tasks/run-state versus source state and stopped without implementation changes. |
| `review-plan` | passed | passed after rubric fix | Initial current run reported the missing Scenario as Warning; after correction, current matched 3/3 and fixed the invalid Scenario before stopping on non-autofixable interface gaps. |
| `review-code` | passed | passed | Both consumed the fixed round-two report and stopped at the rejection hardline with verifiable call-site evidence. |

Final evidence: baseline 4/4; current 4/4 across the primary run plus the review-plan rerun. No unit was `not-executed`.

Evidence files:

- `/tmp/lyx-evals-bundled-skills-20261118/summary.json`
- `/tmp/lyx-evals-bundled-skills-20261118/*-baseline.json`
- `/tmp/lyx-evals-bundled-skills-20261118/*-current.json`
- `/tmp/lyx-evals-review-plan-fixed-20261118/summary.json`
