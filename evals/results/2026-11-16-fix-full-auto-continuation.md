# Skill Eval: propose-full-auto

## Run

```bash
pnpm eval:skills -- --case propose-full-auto --version both --baseline-ref dce2466 --keep-temp --output /tmp/lyx-full-auto-eval-final3
```

- 日期：2026-11-16
- 命令退出码：1（baseline 预期失败；runner 按结果行区分版本）
- 结果：1 passed / 1 failed
- 临时结果：`/tmp/lyx-full-auto-eval-final3/summary.json`
- 保留 fixture：`/var/folders/lx/56vsdpjj02d86psjll4d4w_w0000gn/T/lyx-skill-evals-OzFPmV`

## Results

| 版本 | 状态 | 关键证据 |
|------|------|----------|
| baseline `dce2466` | failed | apply commit `4fb82d6` 与源码/测试存在，但 `run-state.md` 未记录 `终止类型: normal` |
| current | passed | apply commit `38b1692`、源码/测试存在、run-state normal、最终文本含 review-code 正常终态，无额外路径 |

## Notes

- baseline 和 current 都使用同一个隔离 fixture、prompt 和断言。
- runner 只额外放开 fixture 的 `.git` 写权限，使阶段 commit 可在临时仓库内创建。
- current 实际完成 `review-plan -> apply -> review-code`，并产生 review-plan 状态、审查快照、apply 与 review-code 收口提交。
- `review-findings.md` 仅在前一轮存在未修 Warning 时生成；current 的审查快照符合技能契约。
