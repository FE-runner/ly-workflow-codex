## Purpose

定义 ly-workflow-codex 流程内 commit 的统一约定：Conventional Commits 前缀承载语义，`Change-Stage`/`Change-Name` trailer 承载机器锚点，并让审查对象定位与提交范围隔离协议在 propose / apply / archive / review 各环节保持一致。

## ADDED Requirements

### Requirement: commit message 结构 = Conventional Commits 前缀 + Change trailer

本约定适用于 **change 生命周期 commit**（`Change-Stage` 为 `propose` / `apply` / `archive` / `review-plan-fix` / `review-code-fix` 的提交）。非 change 生命周期的 lyx 提交（如 `/ly:init` 的初始化提交、`/ly:release` 的版本提交）不携带 `Change-Name`，SHALL NOT 套用本结构。

change 生命周期 commit SHALL 使用两层结构：

1. 语义层：Conventional Commits 前缀 `<type>(<scope>): <subject>`。
2. 锚点层：commit message 末尾的 git trailer 块，包含 `Change-Stage: <stage>` 与 `Change-Name: <change-name>`。

trailer 块 SHALL 位于 message 最后一段，格式遵循 git trailer 规范（token 用 `-` 连接、`Token: Value`、冒号后有空格），SHALL NOT 在 trailer 块内混入非 trailer 行。

#### Scenario: propose commit 使用新结构
- **WHEN** `/ly:propose` 提交方案产物
- **THEN** commit message 形如 `docs(openspec): 添加 <change-name> 方案`，末尾带 `Change-Stage: propose` 与 `Change-Name: <change-name>` 两个 trailer

#### Scenario: trailer 块位于 message 末尾
- **WHEN** 检查任一 lyx 生成的 commit message
- **THEN** `Change-Stage` 与 `Change-Name` 出现在最后的 trailer 段，且该段除 trailer 行外不含其他内容

#### Scenario: 非 change 生命周期 commit 不套用本结构
- **WHEN** `/ly:init` 提交 AGENTS.md 与 openspec 初始化产物
- **THEN** 该 commit 不携带 `Change-Stage`/`Change-Name` trailer，SHALL NOT 被要求套用本结构；本约定的定位通道也不把它当作审查对象

### Requirement: Change-Stage 取值集合与 CC type 归属

`Change-Stage` SHALL 只取五个值之一：`propose` / `apply` / `archive` / `review-plan-fix` / `review-code-fix`。

CC type 归属：

- `propose` 固定 `docs(openspec)`
- `archive` 固定 `chore(openspec)`
- `review-plan-fix` / `review-code-fix` 固定 `fix(<scope>)`
- `apply` 由主会话按本次实际改动判断 type（`feat` / `fix` / `refactor` 等），SHALL NOT 固定为某个 type

`apply` 的 type 判断 SHALL NOT 被强制与 `@lyx-commit` 的判断一致。

#### Scenario: apply 的 type 由实际改动决定
- **WHEN** 某次 apply 实施的是新功能，另一次实施的是 bug 修复
- **THEN** 前者 CC 前缀可为 `feat(<scope>): ...`、后者可为 `fix(<scope>): ...`，两次 commit 的 `Change-Stage: apply` 锚点均保持稳定

#### Scenario: 非法 Change-Stage 取值不被依赖
- **WHEN** 构造 commit message 时使用五个取值之外的 `Change-Stage`
- **THEN** 该取值不符合本约定，定位方 SHALL NOT 依赖它

### Requirement: 审查对象定位 = trailer 优先 + 旧前缀兼容通道

审查对象定位 SHALL 按以下顺序：

1. trailer 定位：`git log --grep="^Change-Stage: <stage>$" --grep="^Change-Name: <change-name>$" --all-match -1 --format=%H`，取 HEAD 侧最近一期匹配 commit。
2. trailer 未命中时回退旧前缀定位：review-plan 用 `git log --grep="^propose: <change-name>"`，review-code 用 `git log --grep="^apply: <change-name>"`。
3. 两条通道都未命中时，按各命令既有的"退化为 `git diff HEAD` + 未跟踪清单"规则处理。

旧前缀通道 SHALL 标注为 DEPRECATED 兼容通道；回退命中时 SHALL 在报告中打印显式提示，说明本次基线来自旧格式 commit。

兼容通道 SHALL 有明确退出条件：连续一个版本周期零命中，或到达明确版本号（v0.3.0）；满足其一即可移除。

若 `--grep` 多行锚定行为经实测不可靠，定位方 SHALL 退化为取出 commit message 后经 `git interpret-trailers --parse` 精确解析，SHALL NOT 依赖未经验证的行锚定行为。

#### Scenario: 新格式 commit 优先命中
- **WHEN** 目标 change 存在带 `Change-Stage: propose` 与 `Change-Name: <change-name>` trailer 的 commit
- **THEN** 定位方取该 commit 作为基线，SHALL NOT 使用旧前缀通道

#### Scenario: 仅旧格式 commit 时回退并提示
- **WHEN** 目标 change 只有旧格式 `propose: <change-name>` commit，没有 trailer 格式 commit
- **THEN** 定位方回退旧前缀通道命中该 commit，并在报告中打印"本次基线来自旧格式 commit，兼容通道已 DEPRECATED"的显式提示

#### Scenario: 两条通道都未命中时退化
- **WHEN** 目标 change 既无 trailer 格式 commit 也无旧前缀 commit
- **THEN** 定位方按既有规则退化为 `git diff HEAD` + 未跟踪清单组合，SHALL NOT 报错中断

### Requirement: propose / apply 共用提交范围隔离协议

propose 与 apply 提交 SHALL 共用同一套提交范围隔离协议：

1. 提交前枚举本次目标范围：propose 为 `openspec/changes/<change-name>/` 目录内全部应提交文件；apply 为本次待提交文件清单（回传清单 ∪ 回写的 `context.md`）。
2. 目标范围内文件先 `git add` 显式暂存（propose 用 `git add -- <change目录>`；apply 用 `git add -- <本次清单>`），SHALL NOT 使用 `git add -A`。
3. index 中存在目标范围外的已暂存内容时，SHALL 尝试 `git commit --only -- <目标范围>` 隔离提交，或先 unstage 非目标文件、提交后恢复原暂存状态。
4. 同一文件内既存 staged hunk 与本次 hunk 混合、无法机械分离时，SHALL 判定为不可安全隔离，停止转人工。
5. 提交后 SHALL 用 `git show --name-only --format=` 校验实际提交文件集合严格等于本次目标范围——不许超出、不许漏项。

#### Scenario: 范围外 staged 内容被隔离
- **WHEN** propose 提交时 index 中存在 change 目录之外的已暂存文件，且与目标范围无文件重叠
- **THEN** 命令隔离提交目标范围，范围外文件保留原暂存状态，提交后校验文件集合严格属于该 change 目录

#### Scenario: 同一文件内混合 hunk 不可分离时停止
- **WHEN** 目标范围内某文件在提交前已是 staged 状态且含与本次无关的既存 hunk
- **THEN** 命令判定不可安全隔离，停止转人工，SHALL NOT 猜测性提交

#### Scenario: 提交后校验发现漏项或多项
- **WHEN** 提交后校验发现文件集合与目标范围不等（多出范围外文件或漏掉应有文件）
- **THEN** 命令如实报告差异并停止，SHALL NOT 带着不正确的 commit 继续后续流程

#### Scenario: propose 与 apply 行为一致
- **WHEN** 同一份"index 含范围外 staged 内容且无文件重叠"的输入分别出现在 propose 与 apply 环节
- **THEN** 两个环节走同一协议分支，不再出现 propose 直接停止、apply 隔离提交的口径差异
