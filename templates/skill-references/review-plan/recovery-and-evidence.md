# Review Plan Recovery And Evidence

## Recovery

开始审查和每轮循环前读取 `openspec/changes/<change-name>/run-state.md`，获取阶段、基线 commit、轮次和未决项；再用 `git status`、`git log`、`tasks.md` 与目标文件核对。冲突时以可核验 git 和文件内容为准，并记录新的恢复事件。

把 run-state 作为恢复与证据输入，不得把它当作方案源码挑错或修复对象。

## Review State

每轮结束更新 run-state，续写时沿用 `run-state.md` 现有语言：

```text
第 <n> 轮：<Critical 数> 个 Critical，<Warning 数> 个 Warning；<认可/驳回摘要>
终止类型：normal | circuit-breaker | rejection-hardline | unsafe | failed | round-limit | in-progress
```

统一 commit 尚未形成时写“待统一提交归属”，成功后在下一次允许更新中回填 SHA。
正常清零的统一提交 SHALL 显式包含 `run-state.md`，并在提交后核对文件集合。

## Evidence

报告必须包含审查基线、轮次和每条验证的“命令 + 退出码 + 结果摘要”。依赖 subagent 报告时，主会话先核对路径清单、原文或 command evidence；没有证据不得清零。
