## ADDED Requirements

### Requirement: lyx 生成提交统一复用 `@lyx-commit` 正文规范

`@lyx-commit` SHALL 作为所有 lyx 显式生成 message 的提交的基础规范来源。“lyx 显式生成 message”指 message 由 `@lyx-commit` 或 lyx skill 模板写入的提交，包括 change 生命周期提交、propose 切分支前的 WIP commit、worktree `--local` 的 `.gitignore` commit、init/release/changelog/publish 提交。`git merge` / `git revert` / `git cherry-pick` 等由 git 原生生成默认 message 的结构性提交不在范围内，除非模板显式提供 message。基础规范 SHALL 至少定义：

1. 首行为 Conventional Commits 前缀 `<type>(<scope>): <subject>`；
2. 正文 SHALL 至少包含三条 bullet：中文提交用 `- 动机：`、`- 改动：`、`- 影响：`，英文提交用 `- Motivation:`、`- Change:`、`- Impact:`；
3. 正文与后续任意 git trailer 块之间 SHALL 保留空行；
4. 没有正文、只有 subject 的提交 SHALL 视为不符合本规范。

`@lyx-commit` 手动提交 SHALL 遵守该规范。自动流程生成的提交 SHALL 复用同一规范，SHALL NOT 另造一套正文质量要求。`--emoji` 保留为兼容扩展：仅在用户显式请求时使用，首行可为 `[emoji] <type>(<scope>): <subject>`，正文与 trailer 规则不变；自动阶段提交默认不带 emoji。

#### Scenario: 手动提交包含正文
- **WHEN** 用户运行 `@lyx-commit`，暂存区包含多个文件的实际改动
- **THEN** 生成的 commit message 首行为 Conventional Commits 前缀，正文包含动机、改动、影响三条 bullet，而不是只有一行 subject

#### Scenario: 自动提交复用同一正文规范
- **WHEN** lyx 自动流程生成提交信息
- **THEN** 该 message 复用 `@lyx-commit` 的正文规范，并按阶段补充必要信息；SHALL NOT 因为“自动提交”而省略正文

#### Scenario: 只有 subject 的 message 不符合规范
- **WHEN** 任一 lyx 生成提交的 message 只有 `<type>(<scope>): <subject>` 一行，或只有该行加 trailer 而没有正文
- **THEN** 该 message 判定为不符合本规范

#### Scenario: 英文项目使用等价正文标签
- **WHEN** `@lyx-commit` 根据最近提交判断应生成英文 message
- **THEN** 正文使用 `- Motivation:`、`- Change:`、`- Impact:` 三条 bullet，而不是强制中文标签

#### Scenario: 显式 emoji 是兼容扩展
- **WHEN** 用户显式请求 `@lyx-commit --emoji`
- **THEN** 首行可使用 emoji 前缀，正文与 trailer 规则仍按本规范执行

### Requirement: change 生命周期自动提交在正文后追加 trailer

change 生命周期自动提交（`Change-Stage` 为 `propose` / `apply` / `archive` / `review-plan-fix` / `review-code-fix`）SHALL 先按 `@lyx-commit` 正文规范生成 message，再在正文之后的独立 trailer 块追加 `Change-Stage: <stage>` 与 `Change-Name: <change-name>`。trailer 块 SHALL 位于 message 最后一段，正文 SHALL 位于首行 subject 与 trailer 块之间。

阶段正文 SHALL 按阶段补充重点：

- `propose`：方案目标、范围边界、关键决策；
- `apply`：实现要点、行为变化、验证或风险；
- `archive`：归档对象、spec 同步情况；
- `review-plan-fix` / `review-code-fix`：本轮修复的 Critical、修复动作、轮次或验证说明。

#### Scenario: propose commit 带正文和 trailer
- **WHEN** `/ly:propose` 完成方案自审与 `context.md` 产出后提交 propose 阶段 commit
- **THEN** message 包含 subject、动机/改动/影响正文，以及末尾独立的 `Change-Stage: propose` 与 `Change-Name: <change-name>` trailer

#### Scenario: apply commit 在正文中包含验证信息
- **WHEN** `/ly:apply` 完成实施并提交 apply 阶段 commit
- **THEN** message 正文说明实现要点、行为变化以及本次实施运行的验证结果或未运行验证的原因，并在末尾保留 apply trailer

#### Scenario: review 修复提交说明本轮 Critical
- **WHEN** `/ly:review-plan` 或 `/ly:review-code` 在 Critical 清零后执行统一修复提交
- **THEN** message 正文说明本轮认可并修复的 Critical 与修复动作，末尾分别带 `Change-Stage: review-plan-fix` 或 `Change-Stage: review-code-fix` trailer

### Requirement: 非 change 生命周期 lyx 提交遵守正文规范但不追加 Change trailer

非 change 生命周期的 lyx 显式提交（包括 `@lyx-init`、`@lyx-release`、`@lyx-changelog`、`@lyx-publish`、propose WIP、worktree `.gitignore` 中由命令生成的提交）SHALL 遵守 `@lyx-commit` 正文规范，但 SHALL NOT 追加 `Change-Stage` / `Change-Name` trailer。`npm version` 或其他工具默认生成的短 commit SHALL NOT 绕过本规范；若工具默认 message 不含正文，命令 SHALL 改为 `--no-git-tag-version` 后按规范提交再打 tag，或提供等价的自定义 message。

#### Scenario: release 版本提交包含正文
- **WHEN** `@lyx-release` 更新版本号并创建版本提交
- **THEN** 该 commit 包含动机、改动、影响正文，SHALL NOT 只使用默认的版本号短 message

#### Scenario: changelog 提交包含正文
- **WHEN** `@lyx-changelog` 更新 `CHANGELOG.md` 后创建提交
- **THEN** 该 commit 说明更新目标、日志范围与影响，但 SHALL NOT 携带 `Change-Stage` / `Change-Name` trailer

#### Scenario: npm version 默认 message 不被接受
- **WHEN** 命令计划通过 `npm version` 生成版本提交
- **THEN** 该默认短 message 不满足规范；命令必须改用 `--no-git-tag-version` 后手动提交，或传入等价的完整 message

#### Scenario: propose WIP commit 包含正文
- **WHEN** `/ly:propose` 在切分支/留在当前分支前按用户选择创建 WIP commit
- **THEN** WIP commit 首行使用 `chore(wip): ...` 形式的 Conventional Commits 前缀，包含动机、改动、影响正文，但不携带 `Change-Stage` / `Change-Name` trailer

#### Scenario: worktree .gitignore commit 包含正文
- **WHEN** `@lyx-worktree add --local` 发现 `.worktrees` 未被忽略并先提交 `.gitignore`
- **THEN** 该 commit 包含正文，不携带 Change trailer

#### Scenario: git 原生 merge commit 不强制正文
- **WHEN** `/ly:release` 执行 `git merge --no-ff <branch>` 且未提供自定义 message
- **THEN** git 生成的 merge commit 不属于本规范强制范围，不要求补动机/改动/影响正文

## MODIFIED Requirements

### Requirement: commit message 结构 = Conventional Commits 前缀 + Change trailer

本约定适用于 **change 生命周期 commit**（`Change-Stage` 为 `propose` / `apply` / `archive` / `review-plan-fix` / `review-code-fix` 的提交）。非 change 生命周期的 lyx 提交（如 `/ly:init` 的初始化提交、`/ly:release` 的版本提交）不携带 `Change-Name`，SHALL NOT 套用本 change 生命周期 trailer 结构；这些提交仍 SHALL 遵守本 capability 新增的 `@lyx-commit` 正文规范。

change 生命周期 commit SHALL 使用两层结构：

1. 语义层：Conventional Commits 前缀 + `@lyx-commit` 正文规范，即 `<type>(<scope>): <subject>` 加动机/改动/影响正文。
2. 锚点层：commit message 末尾的 git trailer 块，包含 `Change-Stage: <stage>` 与 `Change-Name: <change-name>`。

trailer 块 SHALL 位于 message 最后一段，格式遵循 git trailer 规范（token 用 `-` 连接、`Token: Value`、冒号后有空格），SHALL NOT 在 trailer 块内混入非 trailer 行。

#### Scenario: propose commit 使用新结构
- **WHEN** `/ly:propose` 提交方案产物
- **THEN** commit message 形如 `docs(openspec): 添加 <change-name> 方案`，正文包含动机/改动/影响，末尾带 `Change-Stage: propose` 与 `Change-Name: <change-name>` 两个 trailer

#### Scenario: trailer 块位于 message 末尾
- **WHEN** 检查任一 lyx 生成的 commit message
- **THEN** `Change-Stage` 与 `Change-Name` 出现在最后的 trailer 段，且该段除 trailer 行外不含其他内容

#### Scenario: 非 change 生命周期 commit 不套用本结构
- **WHEN** `/ly:init` 提交 AGENTS.md 与 openspec 初始化产物
- **THEN** 该 commit 不携带 `Change-Stage`/`Change-Name` trailer，SHALL NOT 被要求套用 change 生命周期 trailer 结构；但 commit message SHALL 仍包含 `@lyx-commit` 正文规范要求的动机/改动/影响正文
