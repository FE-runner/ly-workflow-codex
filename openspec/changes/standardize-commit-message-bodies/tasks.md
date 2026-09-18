## 1. 基础 message 规范

- [ ] 1.1 更新 `templates/skills-codex/commit.md`：把正文从弱建议改为强制规范，加入 `- 动机：` / `- 改动：` / `- 影响：` 三条 bullet、完整示例与提交前自检；验证文件包含这三类正文标签和“自动阶段复用”说明。
- [ ] 1.2 在 `templates/skills-codex/commit.md` 明确自动流程提交应复用该规范但不默认使用 emoji；验证文件说明 emoji 仅在显式请求时使用。

## 2. change 生命周期自动提交

- [ ] 2.1 更新 `templates/skills-codex/propose.md`：propose 阶段 message 改为 subject + 三段正文 + trailer，并把提交命令改为使用完整 message 文件；验证模板保留 `Change-Stage: propose` / `Change-Name: <change-name>` 且出现正文标签。
- [ ] 2.2 更新 `templates/skills-codex/apply.md`：apply 阶段 message 说明实现要点、行为变化、验证或风险，并与既有 index 隔离协议兼容；验证模板保留 `Change-Stage: apply` / `Change-Name: <change-name>` 且出现正文标签。
- [ ] 2.3 更新 `templates/skills-codex/archive.md`：归档提交说明归档对象与 spec 同步情况，并改为完整 message 提交；验证模板保留 archive trailer 且出现正文标签。
- [ ] 2.4 更新 `templates/skills-codex/review-plan.md`：清零后的统一修复提交说明本轮 Critical、修复动作与验证；验证模板保留 `Change-Stage: review-plan-fix` 且出现正文标签。
- [ ] 2.5 更新 `templates/skills-codex/review-code.md`：清零后的统一修复提交说明本轮 Critical、代码修复动作与验证；验证模板保留 `Change-Stage: review-code-fix` 且出现正文标签。

## 3. 非 change 生命周期提交流程

- [ ] 3.1 更新 `templates/skills-codex/init.md`：初始化提交改为完整 message 正文，不追加 Change trailer；验证模板出现正文标签且不含 `Change-Stage`。
- [ ] 3.2 更新 `templates/skills-codex/changelog.md`：changelog 更新提交改为完整 message 正文，不追加 Change trailer；验证模板出现正文标签且不含 `Change-Stage`。
- [ ] 3.3 更新 `templates/skills-codex/release.md`：所有 bump/version/changelog/hotfix 相关提交示例改为完整 message 正文；验证这些示例不再只有单行 `git commit -m` message。
- [ ] 3.4 更新 `templates/skills-codex/publish.md`：版本 bump 路径改用 `npm version --no-git-tag-version` 后按规范提交再打 tag，或使用等价完整 message；验证模板出现 `--no-git-tag-version` 且说明 tag 步骤。

## 4. 测试与验证

- [ ] 4.1 更新 `src/utils/__tests__/host-adapters.test.ts`：新增或扩展模板断言，覆盖所有会生成提交的模板包含正文规范、change 生命周期模板保留 trailer、publish 模板包含 `--no-git-tag-version`；验证 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 通过。
- [ ] 4.2 运行 `openspec validate --changes standardize-commit-message-bodies --strict`，确认 change artifacts 保持合法。
- [ ] 4.3 运行 `pnpm typecheck` 与 `pnpm test`，确认模板与测试改动全绿。
