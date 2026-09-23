## 1. review 模板写入快照

- [ ] 1.1 更新 `templates/skills-codex/review-plan.md`：在循环结束（正常清零的统一 commit 之后；非正常终止照写）新增"写入 `## 方案审查` 节"步骤，只收最后一轮 Warning（逐字原文 + 位置 + 建议 + 轮次/基线元信息），按节 upsert 保留代码节，某节零 Warning 不写、两节都空不建文件，写失败如实报告且不改变审查结论；验证模板出现 `review-findings.md`、`## 方案审查`、循环结束/commit 之后写入、写失败不改变结论的措辞。
- [ ] 1.2 更新 `templates/skills-codex/review-plan.md`：在未跟踪（`??`）清单采集处显式排除 `review-findings.md`（与 `context.md` 同待遇），避免其被当作审查对象或被统一 commit 纳入；验证模板在未跟踪清单段落出现排除说明。
- [ ] 1.3 更新 `templates/skills-codex/review-code.md`：同 1.1，新增写 `## 代码审查` 节（正常清零在统一 commit 之后写入、异常终止照写、节级 upsert、写失败如实报告且不改变审查结论）；验证模板出现 `review-findings.md`、`## 代码审查`。
- [ ] 1.4 更新 `templates/skills-codex/review-code.md`：同 1.2，在未跟踪清单采集处排除 `review-findings.md`，并确保正常清零的统一 `git add` 范围不含该文件；验证模板未跟踪清单段落与统一提交段落均体现排除。

## 2. archive 落库说明

- [ ] 2.1 在 `templates/skills-codex/archive.md` 的"提交归档改动"段落补一句：change 目录下未跟踪的 `review-findings.md` 随既有 `git add -- openspec/` 一并落库，无需额外步骤；验证模板出现该说明且未新增额外归档命令。

## 3. explore 先问后列

- [ ] 3.1 更新 `templates/skills-codex/explore.md`：在委托 `opsx:explore` 之前新增一步——扫描 `openspec/changes/*/review-findings.md` 与 `openspec/changes/archive/*/review-findings.md`，有命中则**先询问**是否列出，同意后按 change 分组展示（change 名 + 各节 Warning 计数 + 一行摘要，active 标注"进行中"、archive 标注归档日期），拒绝或无命中则直接进入讨论；验证模板出现 `review-findings.md`、询问措辞、及"不改变 `$ARGUMENTS` 原样转发"的约束。

## 4. 测试与验证

- [ ] 4.1 更新 `src/utils/__tests__/host-adapters.test.ts`：为 `review-plan.md`/`review-code.md` 断言含 `review-findings.md`、两节标题与未跟踪清单排除说明；为 `explore.md` 断言含扫描/询问措辞；验证 `pnpm vitest run src/utils/__tests__/host-adapters.test.ts` 通过。
- [ ] 4.2 运行 `openspec validate --changes review-findings-snapshot --strict`，确认 change artifacts 合法。
- [ ] 4.3 运行 `pnpm typecheck && pnpm build && pnpm test`，确认模板与测试改动全绿。

## 5. 文档同步

- [ ] 5.1 同步 `README.md` / `CLAUDE.md` 中 review/explore 行为摘要：说明审查未修项快照（`review-findings.md`）随归档落库、explore 先问后列；验证文档提到 `review-findings.md` 或等价描述。
