# context.md — unify-commit-conventions 软上下文

本文件只记录文档 artifact 之外的讨论结论与边界；决策细节见 `design.md`，行为契约见 delta spec。

## 关键决策

- **锚点与语义分离**：commit message 的 CC 前缀承载语义、`Change-Stage`/`Change-Name` trailer 承载机器锚点。理由是 `apply` 的 CC type 天生不确定（可能 feat 可能 fix），锚点必须与 type 解耦。见 design 决策 1。
- **apply 的 type 判断接受不一致**：主会话判断的 CC type 允许与 `@lyx-commit` 的判断不同，锚点稳定性由 trailer 承担。这是有意接受的不确定性，不是待修缺陷。
- **兼容通道保留但设硬退出条件**：退出条件 = 连续一个版本周期零命中，或到达 v0.3.0。

## 已否决的备选方案

- **全量 CC 化前缀**（如 `feat(apply):`）：否决，因为 apply 的 type 不固定，塞进 type 会语义失真、塞进 scope 会让 `--grep` 锚点漂移。
- **保持现有阶段前缀不动**：否决，等于放弃 CC 统一这一目标。
- **直接砍掉旧格式读取通道**：否决，会让 in-flight change 静默退化到 `git diff HEAD`，审查范围悄悄变化且不报错。
- **引入 commitlint 类强制校验工具**：否决，超出本次范围；本次只改模板指示与规格。
- **把 `review-plan-fix` / `review-code-fix` 合并为 `review`**：否决，两者修复对象不同（propose 产物 vs apply 产物），合并丢信息。

## 范围边界

- **不含**非 change 生命周期的 lyx 提交：`/ly:init`、`/ly:release` 等不携带 `Change-Name`，不套用新结构。
- **不含** `@lyx-commit` 的独立行为：它是通用智能提交，与流程内固定约定不合并。
- **不含**历史归档 `openspec/changes/archive/**`：不改其中的旧 message 引用。
- **含** propose 与 apply 的 index 隔离协议统一：propose 从"直接停止"升级为与 apply 一致。

## 已知坑与注意事项

- `git log --grep="^Change-Stage: X$" ... --all-match` 的多行锚定行为未在本仓库实测，实施阶段必须先 spike；不稳则退到 `git interpret-trailers --parse`（spec 已写兜底路径）。
- `git commit --only -- <paths>` 对未跟踪新文件（`.openspec.yaml`、`context.md`）可能报 pathspec 不匹配，协议要求先 `git add -- <范围>`；实施阶段需 spike 确认顺序。
- 主 spec 的 Purpose 段无法经 delta 修改，需在 apply 阶段直接编辑 `openspec/specs/ly-propose-flow/spec.md` 与 `ly-lifecycle-commands/spec.md` 的 Purpose（tasks 5.2/5.3 已覆盖）。

## 自审记录

- 自审发现并修复 4 处机械断链：init 适用边界未明确、`ly-propose-flow` 两个遗漏的 MODIFIED Requirement（手动路径措辞、apply 实施 message 措辞）、主 spec Purpose 段同步任务缺失。
- 无待用户决策的开放问题。

## 实施阶段记录

- spike 1.1 实测：`git log --grep="^Change-Stage: X$" --grep="^Change-Name: N$" --all-match` 的多行锚定可靠（命中 target SHA；`Change-Name` 不匹配时返回空）。无需启用 `interpret-trailers --parse` 兜底，spec 中的兜底路径保留为后备。
- spike 1.3 实测：`git commit --only` 有两个使用陷阱——(a) `-m` 必须放在 `--` 之前，否则会被当成 pathspec 解析；(b) 目标范围含未跟踪新文件时必须先 `git add`，否则报 `pathspec ... did not match any file(s) known to git`。两处模板已按"先 add、`-m` 在 `--` 前"的顺序写。
- 实施范围外发现：`src/utils/__tests__/host-adapters.test.ts` 有两处断言检查 apply 模板含旧 `git commit -m "apply: <change-name>"`，随模板改动必然失败；已一并改为 `Change-Stage: apply` 与 `Change-Name: <change-name>` 断言（tasks 未预先覆盖该文件，属模板改动的直接依赖修复）。
