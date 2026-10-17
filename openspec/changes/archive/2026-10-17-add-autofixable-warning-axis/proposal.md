## Why

审查循环只消费 Critical，Warning 一律落 `review-findings.md` 快照、从不自动修。归档的 7 份快照共 22 条 Warning，其中 16 条属于"目标唯一、改法机械、可验证"的机械性问题（文档口径不一致、漏同步、明确缺陷、已点名的测试补齐），本可自动修掉，却都要人工在会话里再点一次。

缺的是一根正交轴：严重度回答"多严重"，回答不了"能不能机械修"。把"机械可修 Warning"与"需要人拍板的 Warning"分开，就能让循环顺手吃掉前者的同时保留后者的人工决策空间。

## What Changes

- 审查发现新增一组正交标注：每条 **Warning** 附 `可自动修复：是 / 否`；Critical 与 Info SHALL NOT 标注（不可安全自动修的 Critical 由既有终止条件 3 处理）。
- 给出可判定的标注口径——四条同时成立才判「是」：**目标唯一**（要改的东西已存在、以谁为准确定）、**不新造决策**（不引入新格式 / 默认值 / 命名 / 分支选择）、**改法机械**（只改审查范围内文件，不动公开 API / 接口契约 / DB schema / 依赖版本）、**可验证**（现有 `typecheck` / `test` / `openspec validate` 能兜住，或纯文档一致性可机械核对）。
- 列明负面信号：建议句含「要么…要么…」「二选一」「取决于」等需拍板的分支、需新定格式或默认值、需业务判断或当前会话不具备的凭据、动公开契约 / schema / 依赖、只喊"提高覆盖率"而未点名具体用例、纯风格偏好或抽象层次之争、审查者自述带不确定性（"可能""疑似"）。**例外**：建议句同时显式给出推荐方向时 SHALL 判「是」，采纳该方向并 SHALL 在报告中写明采纳了哪条建议与依据。
- 附"必须判「是」"的反向清单，防借"不可自动修"逃避：同一事实两处表述不一致且权威方明确；已点名的漏改漏同步（含本仓库改动对称清单的 i18n / 宿主片段 / 命令表 / README 双语）；明确缺陷且写法唯一（漏 `try/catch`、漏设错误标志、用错函数）；审查者已点名具体用例的测试补齐。
- 一条 Warning 含多个子问题时 SHALL 整条判级：任一部分需要判断即整条判「否」，SHALL NOT 半修。
- **正常清零的定义扩展**：由"本轮 Critical 数为 0"改为"本轮 Critical 数为 0 **且** 首轮标注为「是」的 Warning 全部确认修复"。
- **自动修只消费第 1 轮**：仅第 1 轮标注为「是」的 Warning 进入修复循环；第 2 轮起新出现的「是」条目 SHALL 直接落快照，不进循环、不参与清零判定。由此自动修轴最多让循环多跑 1 轮，且仅在第 1 轮 Critical 为 0 而存在「是」条目时才会多跑。
- **未修好即降级**：首轮标注为「是」的条目若第 2 轮仍被判定存在，SHALL 降级为「否」并落快照，不再重试。
- 熔断与驳回硬线 SHALL 仍只适用 Critical；全局轮数上限（默认 5 轮）与"清零优先于轮数上限"均不变。
- 主会话 SHALL 可覆盖标注（两个方向），但 SHALL 在报告中逐条列出被覆盖条目、覆盖方向与理由。
- 快照收录口径由"只收录 Warning"改为"只收录**未被自动修复**的 Warning"——含标注为「否」的条目与标注为「是」但因终止未修完的条目；快照结构、连续编号、归档回写与 `@lyx-explore` 展示口径不变。
- 按项目「改动对称清单」同步配套改动：六处判级标准 ↔ 断言模板文本的测试；行为描述 ↔ `AGENTS.md` / `CLAUDE.md` / `README.md` / `README.zh-CN.md`；另在 `CHANGELOG.md` 记一条。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `ly-review-gates`: 「审查-修复循环与终止条件（review-code / review-plan 共用）」扩展正常清零定义、新增「自动修只消费第 1 轮」与「未修好即降级」语义、明确熔断与驳回硬线仍只适用 Critical、明确增量 TASK 需携带首轮「是」条目逐字原文；「循环结束后统一提交, `--no-commit` 关闭最终提交」修正空 commit 判据（"仅修「是」条目、无 Critical 修复"同样必须统一提交）；新增「审查发现的自动修复标注」与「自动修只消费首轮发现且不返工」两条 Requirement 承载标注契约、判据与循环进入条件。
- `review-findings-snapshot`: 「快照文件的位置与格式」的收录口径由"只收录 Warning"改为"只收录未被自动修复的 Warning"，并补对应 Scenario（含因轮数上限等非清零终止而未被修完的「是」条目录入快照）；「审查关卡在循环结束时按节写入快照」的节移除判据同步为"该类型无可收录条目"。
- `ly-propose-flow`: 「全自动路径 = 自动流水线直到审完代码」中 review-plan / review-code 两处关卡推进条件由"以 Critical 清零结束"改为"以正常清零结束"，并显式引用 `ly-review-gates` 的正常清零定义（Critical 数为 0 且首轮「是」条目已全部确认修复）。

## Impact

- 判级标准六处（SHALL 逐字一致）：`templates/hosts/codex/prompts/reviewer.md`、`templates/hosts/codex/prompts/plan-reviewer.md`、`templates/hosts/claude/agents/lyx-reviewer.md`、`templates/hosts/claude/agents/lyx-plan-reviewer.md`、`templates/skills/review-code.md`、`templates/skills/review-plan.md` 的 `## 判级标准` 小节。
- 模板流程：`templates/skills/review-code.md`、`templates/skills/review-plan.md`（正常清零定义、第 1 轮限定、降级规则、快照口径、报告模板、`main` 路径段落、frontmatter description）；`templates/skills/propose.md`（全自动流水线两处推进条件）。
- 预期零改动但需在 design 写明并由断言守护：`templates/skills/archive.md` 归档前核对、`templates/skills/explore.md` 未解决计数——两者都基于"快照里没有解决子项的 Warning"，自动修条目已进统一 commit、不进快照，因此口径天然兼容。
- 断言：`src/utils/__tests__/host-adapters.test.ts`（现有快照断言 + 判级标准三方一致性断言）。
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`README.zh-CN.md` 的审查循环行为描述；`CHANGELOG.md` 记一条。
- 兼容：新增标注字段是审查输出契约的扩展，`reviewExecutor = main` 与 `subagent` 两条路径共用同一份判据；已完成 change 的历史快照读取口径不变（仍按"没有解决子项即未解决"判定）；不改变 `reviewMode` 门控、`@lyx-apply` 实施流程与 `@lyx-archive` 归档前完整验证的行为。
