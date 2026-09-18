## Why

流程内 commit message 现在混用"阶段前缀"（`propose:` / `apply:` / `archive:`）与 Conventional Commits：审查对象定位（review-plan / review-code 的基线、propose 进入 review-code 前的 SHA 校验）依赖 message 前缀，而 `@lyx-commit` 与部分修复提交又走 CC 风格。锚点稳定性与 CC 统一互相牵制，`apply:` 这类 type 天生不确定的阶段提交也无法诚实地套用 CC type。同时 propose 与 apply 对"index 中存在范围外已暂存内容"的处理口径不一致：propose 直接停止，apply 走 `--only` 隔离，同一输入在相邻阶段行为不同。

## What Changes

- **BREAKING**：change 生命周期 commit message 统一为 Conventional Commits 前缀 + git trailer 结构——`<type>(<scope>): <subject>` 承载语义，`Change-Stage: <stage>` 与 `Change-Name: <change-name>` trailer 承载机器锚点。非 change 生命周期的 lyx 提交（`/ly:init`、`/ly:release` 等）不携带 `Change-Name`，不在本约定范围内。
- `Change-Stage` 取值收敛为五个：`propose` / `apply` / `archive` / `review-plan-fix` / `review-code-fix`；`Change-Name` 记录目标 change 名。
- CC type 归属：`propose` 固定 `docs(openspec)`，`archive` 固定 `chore(openspec)`，`review-*-fix` 固定 `fix(<scope>)`，`apply` 由主会话按实际改动判断（接受与 `@lyx-commit` 判断可能不一致）。
- 审查对象定位（review-plan 取 propose 基线、review-code 取 apply 基线、propose 进入 review-code 前的 SHA 校验）改为 trailer 优先：`git log --grep="^Change-Stage: X$" --grep="^Change-Name: N$" --all-match`。
- 旧前缀定位（`^propose:` / `^apply:`）保留为 **DEPRECATED 兼容通道**：trailer 未命中时回退，回退命中时报告显式提示；退出条件为"连续一个版本周期零命中"或到达明确版本号（v0.3.0）。
- 统一 index 隔离协议：propose 与 apply 共用同一套规则——范围外已暂存内容先尝试 `--only` 隔离，同一文件内混合 hunk 判为不可分离则停止转人工，提交后文件集合严格等于目标范围（不许超出、不许漏项）。
- propose 不再对脏 index 直接停止，升级为与 apply 一致的隔离协议；apply 的"重叠即停"兜底被 propose 继承。
- 同步模板与规格：`propose.md` / `apply.md` / `archive.md` / `review-plan.md` / `review-code.md` / `templates/CLAUDE.md`，以及 `ly-propose-flow` / `ly-review-gates` / `ly-lifecycle-commands` / `review-context-artifact` 四个能力。

## Capabilities

### New Capabilities

- `commit-conventions`: 统一的 commit message 结构（CC 前缀 + `Change-Stage`/`Change-Name` trailer）、`Change-Stage` 取值与语义、审查对象 trailer 定位规约与旧格式兼容通道、propose/apply 共用的提交范围隔离协议与提交后校验规则。

### Modified Capabilities

- `ly-propose-flow`: propose 提交环节改用新 message 格式与统一隔离协议；"审查对象 = 最近一次相关 commit"的定位规约改为引用 `commit-conventions`；全自动流水线进入 review-code 前的 SHA 校验改用 trailer 定位。
- `ly-review-gates`: review-plan / review-code 的审查基线定位改用 trailer（含旧前缀回退）；循环结束后统一提交的 message 改用新格式。
- `ly-lifecycle-commands`: apply 提交 message 改用新格式并引用统一隔离协议；archive 提交 message 改用新格式。
- `review-context-artifact`: "随 `propose:`/`apply:` commit 一并提交"的措辞更新为引用新的 `Change-Stage` trailer 格式。

## Impact

- 模板：`templates/skills-codex/propose.md`、`apply.md`、`archive.md`、`review-plan.md`、`review-code.md`、`templates/CLAUDE.md`。
- 持久规格能力：新建 `openspec/specs/commit-conventions/spec.md`；修改 `ly-propose-flow`、`ly-review-gates`、`ly-lifecycle-commands`、`review-context-artifact`。
- 历史归档 `openspec/changes/archive/**` 不修改。
- 兼容性：旧前缀定位通道保留一个版本周期；已存在的 in-flight change（仅旧格式 `propose:` commit）在升级后仍能被定位，不会静默退化为 `git diff HEAD`。
