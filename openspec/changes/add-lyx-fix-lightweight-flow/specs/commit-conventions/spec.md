## MODIFIED Requirements

### Requirement: lyx 生成提交统一复用 `@lyx-commit` 正文规范

`@lyx-commit` SHALL 作为所有 lyx 显式生成 message 的提交的基础规范来源。“lyx 显式生成 message”指 message 由 `@lyx-commit` 或 lyx skill 模板写入的提交，包括 change 生命周期提交、propose 切分支前的 WIP commit、worktree `--local` 的 `.gitignore` commit、init/release/changelog/publish/fix 提交。`git merge` / `git revert` / `git cherry-pick` 等由 git 原生生成默认 message 的结构性提交不在范围内，除非模板显式提供 message。基础规范 SHALL 至少定义：

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

### Requirement: 非 change 生命周期 lyx 提交遵守正文规范但不追加 Change trailer

非 change 生命周期的 lyx 显式提交（包括 `@lyx-init`、`@lyx-release`、`@lyx-changelog`、`@lyx-publish`、`@lyx-fix`、propose WIP、worktree `.gitignore` 中由命令生成的提交）SHALL 遵守 `@lyx-commit` 正文规范，但 SHALL NOT 追加 `Change-Stage` / `Change-Name` trailer。`npm version` 或其他工具默认生成的短 commit SHALL NOT 绕过本规范；若工具默认 message 不含正文，命令 SHALL 改为 `--no-git-tag-version` 后按规范提交再打 tag，或提供等价的自定义 message。

`@lyx-fix` 的提交在动机/改动/影响之后 SHALL 追加 `- spec：` / `- 自审：` / `- 验证：` 三条 bullet（见 `lightweight-fix-flow`），同样 SHALL NOT 追加 Change trailer；`Change-Stage` 取值集合不因此扩展。

#### Scenario: fix 提交带附加正文且无 Change trailer
- **WHEN** `@lyx-fix` 完成修复并提交
- **THEN** 该 commit 包含动机、改动、影响与 spec、自审、验证正文，SHALL NOT 携带 `Change-Stage` / `Change-Name` trailer

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
