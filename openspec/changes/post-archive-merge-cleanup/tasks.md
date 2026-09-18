## 1. propose 记录 isolation metadata

- [x] 1.1 更新 `templates/skills-codex/propose.md`：在隔离方式动作前捕获 `sourceBranch` 与目标 isolation 信息到会话内存；验证模板区分“捕获”和“持久化写入”两个时序点。
- [x] 1.2 在 `templates/skills-codex/propose.md` 明确 change 名确认后、propose commit 前把 `isolation`、`sourceBranch`、`developmentBranch`、`worktreePath` 写入 `.openspec.yaml` 的 `lyx:` metadata，并随 propose 阶段 commit 一起提交；验证模板包含这些字段名。
- [x] 1.3 更新 `templates/skills-codex/worktree.md` 说明：propose 使用 worktree 隔离时由 propose 负责记录 `worktreePath` metadata，手动 `@lyx-worktree add` 不强制记录；验证模板出现该边界说明。
- [x] 1.4 在 `templates/skills-codex/propose.md` 定义已在 worktree 内发起 propose 与 detached HEAD 的保守处理；验证模板覆盖 sourceBranch 缺失与 detached HEAD 停止。

## 2. archive 完成后分支收尾

- [x] 2.1 更新 `templates/skills-codex/archive.md`：archive 阶段 commit 成功后读取 `.openspec.yaml` 的 `lyx:` metadata，进入 post-archive cleanup 流程；验证模板包含 `lyx:`、`sourceBranch`、`developmentBranch`、`worktreePath`。
- [x] 2.2 在 `templates/skills-codex/archive.md` 实现 `none` / `branch` / `worktree` 三种检测与提示文案；验证三种模式均有明确场景说明。
- [x] 2.3 在 `templates/skills-codex/archive.md` 实现用户确认后的本地收尾命令：校验 metadata 与实际 Git 状态一致、branch 模式当前分支匹配、检查开发 worktree 与 `sourceBranch` 所在 worktree 均干净、定位 `sourceBranch` 所在 worktree、`git merge --no-ff`、删除 worktree、删除开发分支、不 push；验证模板包含这些步骤。
- [x] 2.4 在 `templates/skills-codex/archive.md` 实现失败保留现场：dirty、分支缺失、merge 冲突、worktree 删除失败、branch 删除失败均停止后续清理；验证模板列出这些失败路径。
- [x] 2.5 在 `templates/skills-codex/archive.md` 实现旧 change 缺少 metadata 或 `sourceBranch` 为 `null`/空的保守路径：可保守推导当前分支/当前 worktree，提示选择目标分支或跳过，不默认猜 `main` / `master`；验证模板包含该提示。

## 3. 测试与验证

- [x] 3.1 更新 `src/utils/__tests__/host-adapters.test.ts`：断言 propose 模板包含 isolation metadata 字段，archive 模板包含 post-archive cleanup、`git merge --no-ff`、`worktree remove`、旧 metadata 跳过逻辑；验证 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 通过。
- [x] 3.2 运行 `openspec validate --changes post-archive-merge-cleanup --strict`，确认 change artifacts 合法。
- [x] 3.3 运行 `pnpm typecheck` 与 `pnpm test`，确认模板与测试改动全绿。
- [x] 3.4 同步 `README.md`、`CLAUDE.md`、`templates/CLAUDE.md` 中 propose / archive / worktree 行为摘要；验证文档提到 post-archive merge cleanup 或 metadata 收尾行为。
