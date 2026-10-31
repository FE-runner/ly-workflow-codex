# Review Code Recovery And Evidence

## Recovery

开始审查和每轮循环前读取 `openspec/changes/<change-name>/run-state.md`，获取当前阶段、apply commit、审查轮次和未决项；再用 `git status`、`git log` 和固定基线核对真实 diff。冲突时以 git 和文件内容为准，并在报告中记录。

run-state 是恢复与证据输入，不是实现代码；不得对它提出源码审查发现或要求业务修复。

## Review State

每轮结束更新 run-state：

```text
Round <n>: <Critical count> Critical, <Warning count> Warning; <accepted/rejected summary>
Termination type: normal | circuit-breaker | rejection-hardline | unsafe | failed | round-limit | in-progress
```

统一 commit 尚未形成时写“待统一提交归属”，成功后在下一次允许更新中回填 SHA。
正常清零的统一提交 SHALL 显式包含 `run-state.md`，并在提交后核对文件集合。

## Evidence

完成声明必须引用本轮实际查看的 diff/文件清单，以及每条验证的“命令 + 退出码 + 结果摘要”。subagent 自报成功不是通过证据；没有新鲜证据时不得声称修复或清零。
