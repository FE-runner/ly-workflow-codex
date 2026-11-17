# Skill Eval: propose-self-review-full-auto

## Runs

```bash
pnpm eval:skills -- --case propose-self-review-full-auto --version current --keep-temp --output /tmp/lyx-propose-self-review-eval-after
pnpm eval:skills -- --case propose-self-review-full-auto --version baseline --baseline-ref dce2466 --keep-temp --output /tmp/lyx-propose-self-review-eval-baseline
```

- 日期：2026-11-17
- 结果：current passed / baseline failed

## Results

| 版本 | 状态 | 关键证据 |
|------|------|----------|
| baseline `dce2466` | failed | propose 与 apply 产物存在，但 review-code commit 缺失，run-state 未记录 `终止类型: normal` |
| current | passed | context、propose/review-code commit、文档产物、tasks 勾选与 run-state normal 均存在 |

## Notes

- 新场景从空仓库开始，覆盖 opsx:propose artifacts、方案自审、context/metadata、propose commit 与后续完整流水线。
- 真实失败轨迹同时确认：方案自审清单曾在 `03:13:24` 输出后直接结束回合，用户随后追问“全自动怎么又停了”。
- baseline/current 使用同一 fixture、prompt、判级与副作用检查。
