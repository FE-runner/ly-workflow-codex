## Why

当前 `@lyx-commit` 对 message 正文只有弱建议，propose/apply/archive/review 修复等自动阶段提交又只定义了 subject + trailer，导致生成的提交普遍只有一句话，丢失动机、改动要点与影响范围。提交历史是审查、回溯和 changelog 的基础，需要把 `@lyx-commit` 的消息体规范提升为所有 lyx 生成提交的统一基线。

## What Changes

- 把 `@lyx-commit` 定义为 lyx 生成提交的基础 message 规范：subject 使用 Conventional Commits 前缀，正文至少说明动机、改动与影响范围。
- 所有自动阶段提交复用该基础规范，并在正文之后追加 `Change-Stage` / `Change-Name` trailer；自动阶段提交 SHALL NOT 再退化为只有 subject + trailer。
- change 生命周期提交按阶段补充正文重点：propose 写方案目标与范围，apply 写实现与验证，archive 写归档与 spec 同步，review-plan/review-code 修复写本轮 Critical 与修复动作。
- 非 change 生命周期的 lyx 提交（init/release/changelog/publish）也遵守基础正文规范，但不追加 `Change-Stage` / `Change-Name` trailer。
- release/publish 的 `npm version` 自动提交路径需要避免默认短 commit；若生成版本提交，必须产出具正文的 message，或改为 `--no-git-tag-version` 后按规范手动提交再打 tag。
- 更新模板与 OpenSpec specs，使“所有 lyx 生成提交复用 `@lyx-commit` 正文规范”可检查、可审查。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `commit-conventions`: 从 change 生命周期 trailer 约定扩展为所有 lyx 生成提交的基础 message 正文规范，并定义自动阶段提交如何复用该规范。
- `ly-lifecycle-commands`: init / apply / archive / propose 生成的自动提交使用增强正文，并保留既有任 trailer 结构。
- `ly-propose-flow`: propose 阶段 commit 使用增强正文，全自动/手动路径的提交行为仍保持现有编排。
- `ly-review-gates`: review-plan / review-code 清零后的统一修复提交使用增强正文。
- `release-publish-commands`: release / changelog / publish 产生的提交使用增强正文，并明确 `npm version` 自动提交不能被短 message 绕过规范。

## Impact

- 模板：`templates/skills-codex/commit.md`、`propose.md`、`apply.md`、`archive.md`、`review-plan.md`、`review-code.md`、`init.md`、`release.md`、`changelog.md`、`publish.md`
- Specs：`openspec/specs/commit-conventions/spec.md`、`ly-lifecycle-commands/spec.md`、`ly-propose-flow/spec.md`、`ly-review-gates/spec.md`、`release-publish-commands/spec.md`
- 测试：`src/utils/__tests__/host-adapters.test.ts` 可能需要更新模板断言
- 兼容性：不改变 CC 前缀、trailer 定位协议或审查对象定位；只增强 message 正文要求
