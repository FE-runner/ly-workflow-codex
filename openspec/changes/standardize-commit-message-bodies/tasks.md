## 1. 基础 message 规范

- [x] 1.1 更新 `templates/skills-codex/commit.md`：把正文从弱建议改为强制规范，加入中英文正文标签映射、完整示例与提交前自检；验证文件包含 `- 动机：` / `- 改动：` / `- 影响：` 与英文等价标签。
- [x] 1.2 在 `templates/skills-codex/commit.md` 明确自动流程提交应复用该规范但不默认使用 emoji；验证文件说明 `--emoji` 是仅显式请求时使用的兼容扩展。

## 2. change 生命周期自动提交

- [x] 2.1 更新 `templates/skills-codex/propose.md`：propose 阶段 message 改为 subject + 三段正文 + trailer，并把提交命令改为使用完整 message 文件；验证模板保留 `Change-Stage: propose` / `Change-Name: <change-name>` 且出现正文标签。
- [x] 2.2 更新 `templates/skills-codex/apply.md`：apply 阶段 message 说明实现要点、行为变化、验证或风险，并改用完整 message 文件 `-F` 提交且兼容既有 index 隔离协议；验证模板保留 `Change-Stage: apply` / `Change-Name: <change-name>`、正文标签与 `-F`。
- [x] 2.3 更新 `templates/skills-codex/archive.md`：归档提交说明归档对象与 spec 同步情况，并改为完整 message 文件 `-F` 提交；验证模板保留 archive trailer、正文标签与 `-F`。
- [x] 2.4 更新 `templates/skills-codex/review-plan.md`：清零后的统一修复提交说明本轮 Critical、修复动作与验证，并改用完整 message 文件 `-F` 提交；验证模板保留 `Change-Stage: review-plan-fix` / `Change-Name: <change-name>`、正文标签与 `-F`。
- [x] 2.5 更新 `templates/skills-codex/review-code.md`：清零后的统一修复提交说明本轮 Critical、代码修复动作与验证，并改用完整 message 文件 `-F` 提交；验证模板保留 `Change-Stage: review-code-fix` / `Change-Name: <change-name>`、正文标签与 `-F`。

## 3. 非 change 生命周期提交流程

- [x] 3.1 更新 `templates/skills-codex/init.md`：初始化提交改为完整 message 正文，不追加 Change trailer；验证模板出现正文标签且不含 `Change-Stage`。
- [x] 3.2 更新 `templates/skills-codex/changelog.md`：changelog 更新提交改为完整 message 正文，不追加 Change trailer；验证模板出现正文标签且不含 `Change-Stage`。
- [x] 3.3 更新 `templates/skills-codex/release.md`：所有 bump/version/changelog/hotfix 显式提交示例改为完整 message 正文；验证这些示例不再只有单行 `git commit -m` message。
- [x] 3.4 更新 `templates/skills-codex/publish.md`：版本 bump 路径改用 `npm version --no-git-tag-version` 后按规范提交再打 tag，或使用等价完整 message；验证模板出现 `--no-git-tag-version` 且说明 tag 步骤。
- [x] 3.5 更新 `templates/skills-codex/propose.md` 的 WIP commit 示例：首行改为 `chore(wip): ...`，补完整 message 正文且不追加 Change trailer；验证 WIP 示例包含 CC 前缀、正文标签且不含 `Change-Stage`。
- [x] 3.6 更新 `templates/skills-codex/worktree.md` 的 `--local` `.gitignore` 提交说明为完整 message 正文且不追加 Change trailer；验证模板包含正文标签且不含 `Change-Stage`。

## 4. 测试与验证

- [x] 4.1 更新 `src/utils/__tests__/host-adapters.test.ts`：新增或扩展模板断言，覆盖所有会生成提交的模板包含正文规范、自动阶段模板保留 trailer 与 `-F`、publish 模板包含 `--no-git-tag-version`；验证 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 通过。
- [x] 4.2 运行 `openspec validate --changes standardize-commit-message-bodies --strict`，确认 change artifacts 保持合法。
- [x] 4.3 运行 `pnpm typecheck` 与 `pnpm test`，确认模板与测试改动全绿。
