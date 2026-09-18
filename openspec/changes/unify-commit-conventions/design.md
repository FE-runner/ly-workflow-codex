## Context

见 `proposal.md` 的 Why。设计层面要处理两组既有约束：

1. 审查对象定位是**功能契约**：`review-plan` / `review-code` 用 commit message 前缀 `^propose:` / `^apply:` 定位基线，`propose` 全自动流水线进入 `review-code` 前还用同一前缀做 SHA 相等校验。任何 message 格式调整都必须保证这条定位链路不静默降级。
2. propose 与 apply 面对同一类"index 含范围外 staged 内容"输入时行为不同：propose 直接停止，apply 用 `git commit --only` 隔离。两处都要改，且改动点重叠在同一批模板文件上，因此合并为一个 change。

## Goals / Non-Goals

**Goals:**

- commit message 语义层回归 Conventional Commits，机器锚点从前缀位置迁移到 git trailer。
- propose / apply / archive / review-*-fix 五类提交统一为同一 message 结构与同一提交范围隔离协议。
- 旧格式 commit 在一个版本周期内仍可被定位，避免升级后 in-flight change 静默退化到 `git diff HEAD`。

**Non-Goals:**

- 不修改 `@lyx-commit` 的独立行为；它是通用智能提交，与本 change 的流程内固定约定不合并。
- 不改造历史归档 `openspec/changes/archive/**` 中的旧 message 引用。
- 不引入 commitlint 之类的强制校验工具；本 change 只改模板指示与规格。

## Decisions

### 决策 1：锚点从"前缀"迁移到 trailer，而不是全量 CC 化前缀

`apply` 提交的 CC type 取决于本次实际改动（可能 `feat`、可能 `fix`），无法固定；把阶段名塞进 CC type（如 `feat(apply):`）会让语义失真，塞进 scope 又会让 `--grep` 锚点随 type 漂移。选择 `<type>(<scope>): <subject>` + `Change-Stage` / `Change-Name` trailer 两层结构，语义层可自由变化，锚点层恒定。

备选方案：保持现有前缀不动（放弃 CC 统一）；或全量 CC 化前缀并用 `--grep` 匹配 `<type>(apply)`（type 不固定时无法稳定匹配）。均被否。

### 决策 2：Change-Stage 五值，Change-Name 单独成 trailer

`Change-Stage` 取值 `propose` / `apply` / `archive` / `review-plan-fix` / `review-code-fix`。两个 fix 不合并为 `review`，因为它们的修复对象不同（一个修 propose 产物、一个修 apply 产物），合并会丢信息。`Change-Name` 独立成 trailer 而不塞进 subject，避免长 change 名撑爆首行。

### 决策 3：apply 的 CC type 由主会话判断，接受与 `@lyx-commit` 不一致

type 判断是模型判断，没有强制一致性机制。锚点稳定性由 trailer 承担，因此 type 判断差异不影响流程定位。这一取舍是有意接受的不确定性。

### 决策 4：定位先 `--grep` + `--all-match`，实测不稳则退 `git interpret-trailers --parse`

首选 `git log --grep="^Change-Stage: X$" --grep="^Change-Name: N$" --all-match -1 --format=%H`，因为它是 git 原生、单命令、可读性高。风险是 `^`/`$` 在多行 commit message 中的锚定语义未在本仓库实测过。因此规格要求：若实测不可靠，改用取出 message 后经 `git interpret-trailers --parse` 精确解析，不依赖未验证的行锚定行为。实施阶段必须先做这个 spike。

### 决策 5：旧前缀通道保留为 DEPRECATED 兼容通道，带明确退出条件

读取顺序 = trailer 优先 → 旧前缀回退 → 既有 `git diff HEAD` 退化。回退命中时打印显式提示。退出条件为"连续一个版本周期零命中"或到达 v0.3.0，二者满足其一即可移除。直接砍掉旧通道会让 in-flight change 静默改变审查范围，这是不可接受的失败模式。

### 决策 6：index 隔离协议抽成 propose / apply 共用契约

协议步骤：枚举目标范围 → `git add -- <范围>`（不用 `-A`）→ 范围外 staged 内容尝试 `--only` 隔离或 unstage-提交-恢复 → 同一文件内混合 hunk 判不可分离则停止 → 提交后 `git show --name-only` 校验集合严格等于目标范围。

propose 由此从"index 脏直接停止"升级为与 apply 一致；apply 的"重叠即停"兜底被 propose 继承。目标范围的表达不同（propose 是 change 目录、apply 是本次文件清单），但协议分支相同。

## Risks / Trade-offs

- [`--grep` 多行锚定行为未实测] → 实施阶段先做 spike（构造带 trailer 的临时 commit，验证 `--all-match` + `^...$` 命中）；不稳则按决策 4 退到 `interpret-trailers --parse`。
- [`git commit --only -- <paths>` 对未跟踪新文件（`.openspec.yaml`、`context.md`）可能报 pathspec 不匹配] → 协议要求先 `git add -- <范围>` 再走隔离提交；实施阶段用 spike 确认该顺序在"范围外有 staged 内容"时仍能正确隔离。
- [apply 的 CC type 判断可能与 `@lyx-commit` 不一致] → 有意接受；锚点由 trailer 承担，type 差异不影响流程。
- [兼容通道被遗忘、长期滞留] → 规格写明退出条件与 DEPRECATED 标注；回退命中时的报告提示本身也是发现"仍在用旧格式"的信号。
- [propose 采用隔离协议后，范围外 staged 内容被"容忍"而非拦截，可能掩盖用户误暂存] → 提交后 `git show --name-only` 严格校验 + 报告中说明范围外内容未被提交，保证可见性。

## Migration Plan

1. 模板与规格同步更新：`propose.md` / `apply.md` / `archive.md` / `review-plan.md` / `review-code.md` / `templates/CLAUDE.md`，以及四个受影响的持久规格能力。
2. 新格式立即生效于所有新产生的 commit；旧格式 commit 仍可被定位（兼容通道）。
3. 回退命中时报告显式提示，作为兼容通道使用情况的观测点。
4. 满足退出条件（连续一个版本周期零命中，或到达 v0.3.0）后，移除旧前缀读取通道，并在模板与规格中删除 DEPRECATED 说明。
