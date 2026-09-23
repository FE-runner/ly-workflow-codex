## Why

审查关卡只驱动 Critical 的修复循环，Warning 作为过程信号仅出现在当次对话输出里。对话一结束（或上下文被压缩），这些未修复的建议就永久丢失，事后无法回溯"某次审查曾提出过哪些未处理的 Warning"。需要一个随 change 落库、只读、不承担跟踪职责的快照。

## What Changes

- 新增审查未修项快照 artifact：`openspec/changes/<change-name>/review-findings.md`，单文件两节（`## 方案审查` / `## 代码审查`），只收 Warning。
- 每节记录该审查类型最近一轮未自动修复的发现（逐字原文 + 位置 + 建议，附轮次与基线元信息）；某节零 Warning 不写该节；两节都空不创建文件。
- `@lyx-review-plan` / `@lyx-review-code` 在审查-修复循环结束时按节 upsert 写入快照：正常清零场景在统一 commit **之后**写入（保持未跟踪），异常终止场景照写。
- 审查命令的未跟踪清单显式排除 `review-findings.md`（同 `context.md` 待遇），避免它被当作审查对象或被后续中间 commit 提前吞掉。
- `@lyx-archive` 的 `git add -- openspec/` 使快照随归档 commit 落库，并随 change 目录搬入 `archive/`。
- `@lyx-explore` 进入时扫描 active + archive 下的快照，命中则**询问**是否列出；用户同意后按 change 分组展示，不同意或未命中则不列。
- 明确非目标：非正常终止（熔断 / 驳回硬线 / 轮数上限）时未修的 Critical 不纳入快照，由用户手动解决。

## Capabilities

### New Capabilities

- `review-findings-snapshot`: 定义审查未修项快照 artifact 的位置、格式（单文件两节、只收 Warning、最近一轮）与生命周期（审查写入 → 归档落库 → explore 先问后列）。

### Modified Capabilities

- `ly-review-gates`: 审查范围（未跟踪清单）显式排除 `review-findings.md`，使快照不被当作审查对象或被中间 commit 提前提交。
- `ly-lifecycle-commands`: `/ly:explore` 不再是纯委托——进入时扫描快照并在有命中时询问是否列出。

## Impact

- 模板：`templates/skills-codex/review-plan.md`、`review-code.md`、`archive.md`、`explore.md`
- Specs：新增 `review-findings-snapshot`；更新 `ly-review-gates`、`ly-lifecycle-commands`
- 测试：`src/utils/__tests__/host-adapters.test.ts` 增加模板断言（快照单文件两节、explore 先问后列、未跟踪清单排除规则）
- 文档：`README.md` / `CLAUDE.md` 相关行为摘要
- 兼容性：不改动 `src/` 运行时代码；快照为新增未跟踪文件，不改变既有 propose/apply/review/archive 的提交流程；apply 的显式提交清单天然不含该文件，无需模板改动
