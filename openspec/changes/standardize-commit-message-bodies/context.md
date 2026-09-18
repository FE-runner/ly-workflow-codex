# standardize-commit-message-bodies Context

## 讨论结论

- 范围按“方案 1”收敛：所有由 lyx 生成或辅助生成的提交都遵守统一正文规范，包括 `@lyx-commit` 手动提交、propose/apply/archive/review 修复自动提交，以及 init/release/changelog/publish 中由命令生成的提交。
- 不约束用户在终端直接执行的裸 `git commit`。该边界见 design.md 的 Non-Goals。
- `@lyx-commit` 作为基础 message 规范来源；`commit-conventions` 作为可审查的行为契约。其他模板只引用并补充阶段重点，避免每个模板复制完整规则。
- 自动阶段提交在基础正文后追加 `Change-Stage` / `Change-Name` trailer；非 change 生命周期提交不追加 Change trailer，但仍必须有正文。
- 不做 trivial 豁免：版本 bump、初始化、changelog 这类提交也保留动机/改动/影响正文，只是内容可以简短。
- 正文结构固定为三条基础 bullet：`- 动机：`、`- 改动：`、`- 影响：`。阶段模板可追加阶段重点，例如 apply 的验证、review 修复的 Critical。

## 已否决备选

- 只在 `@lyx-commit` 改规范、自动阶段继续保持短提交：否决。用户明确要求自动阶段复用该规范。
- 在每个自动模板中复制完整正文规则：否决。会产生多处漂移；改为 `commit-conventions` 定义一次，模板引用。
- 继续使用 `npm version` 默认 commit 或依赖多行 `-m`：否决。默认 message 太短，多行 shell 转义脆弱；改用 `--no-git-tag-version` 后按规范提交再打 tag。
- 给纯机械提交豁免正文：否决。范围已明确为所有 lyx 生成提交，统一结构优先于短期便利。

## 实现注意

- 自动阶段提交统一用完整 message 文件提交，设计上选择 `git commit -F .git/COMMIT_EDITMSG`；index 隔离分支也要保留 `-F` 形式。
- trailer 必须仍在 message 最后一段，正文与 trailer 之间保留空行，避免破坏现有 `git log --grep` 定位。
- release/publish 的 tag 仍要存在；变化只是从 `npm version` 默认提交改为手动规范提交后补 tag。
- 历史 commit 不需要迁移，旧前缀兼容通道和既有审查对象定位不变。

## 审查提示

- 重点检查所有会生成提交的模板是否都覆盖：commit/propose/apply/archive/review-plan/review-code/init/release/changelog/publish。
- 重点检查 `commit-conventions` 中“非 change 生命周期不套用本结构”与新正文规范的边界是否表达清楚：不套 trailer，但必须有正文。
- 重点检查 release/publish 是否仍保留 tag 与 changelog 流程，避免为了正文规范破坏发布行为。
