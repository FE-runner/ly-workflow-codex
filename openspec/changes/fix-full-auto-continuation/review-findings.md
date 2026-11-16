# 审查未修项快照

## 代码审查

- 轮次：1
- 记录时间：2026-11-16T15:48:15+0800
- 基线：apply commit `addc9e3`

1. [src/utils/__tests__/skill-evals.test.ts:239、src/evals/cases.ts:468] — `propose-full-auto` 的静态测试验证了 pass pattern 存在，并验证了初始 fixture 的聚合失败；但没有分别隔离验证“缺 apply commit”“缺 run-state normal”“缺 review-code 终态文本”任一条件单独存在时校验必然失败。当前断言能覆盖主路径，但回归时较难定位是哪一道硬终态门槛退化。
   建议：后续补三个聚焦用例，分别只破坏 apply commit、run-state normal、最终文本中的 review-code 锚点之一，并断言 `verifySideEffects` / `classifyEvalOutcome` 返回 failed。
   可自动修复：否
   影响落地：否
