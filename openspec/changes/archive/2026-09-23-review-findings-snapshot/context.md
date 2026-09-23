# context.md — review-findings-snapshot

软上下文（文档之外的讨论结论）。行为契约见 delta spec `review-findings-snapshot`；动机见 `proposal.md`；取舍见 `design.md`。

## 关键决策

- 快照式而非台账式：用户明确目标是"回看"，不要 open/closed 跟踪与关闭收尾（见 design D1）。
- 单文件两节 `## 方案审查` / `## 代码审查`（用户拍板，见 D2）。
- 只收 Warning：不收 Info（噪声控制）、不收未修 Critical（用户裁定"Critical 会被手动解决"）。
- 写入时机 = 循环结束；正常清零在**统一 commit 之后**写，异常终止照写（见 D3）——放 commit 后使"是否进本次提交"不成问题。
- 快照保持未跟踪直到 `@lyx-archive` 的 `git add -- openspec/` 落库（见 D4）。
- explore 必须**先询问、后列出**（用户明确纠正："不是直接就列出"），见 D6。

## 已否决的备选（含理由）

- 全局台账 `openspec/review-backlog.md`：需维护关闭动作，会长成没人读的坟场；与"快照式"意图不符。
- 追加进 `context.md`：污染"子代理软上下文唯一通道"、被审查 subagent 每轮读取锚定，且突破其 ≤100 行约束。
- 审查时直接提交快照：与"归档时才固化"的意图错位，并把快照带进下一次审查范围。
- 把发现搭在 review-code commit 正文里：零 Critical 时无 commit 可搭，恰好丢失最需要留痕的场景。
- explore 自动列出 / 只在用户主动问时才列：前者打断带话题进入的场景，后者可发现性差。
- 在 archive 阶段重新校验 Warning 是否已被手工修复：不可行且昂贵，快照只记"审查当时结论"。

## 范围边界

- 做：快照写入、归档落库、explore 先问后列、审查命令未跟踪清单排除。
- 不做：Info 收录、未修 Critical 收录、open/closed 跟踪、归档瞬间再校验、`src/` 运行时代码改动。

## 已知坑

- 快照在"审查结束 → 归档前"是工作区未跟踪文件，会触发 `@lyx-propose` 切分支前的脏工作区三选一询问——属既有通用行为，本次不改 propose。
- 未归档的 change 其快照不进 git 历史（预期，快照式语义下接受）。
- 本变更不解决"审查 subagent 把真问题误判成 Warning"的分级误判（另一个漏口）。
- 快照被排除在审查范围外，因此**不受** `context.md` 的 ≤100 行体积约束——它不是每次 spawn 的固定读取成本。

## 实施记录（apply 阶段回写）

- 两个 review 模板各新增一段「循环结束后写入审查未修项快照（Warning）」（放在输出报告之前，不重编号），并在步骤 1 的未跟踪清单采集处新增 `review-findings.md` 排除段（显式写明"两条执行者路径同样生效"）。
- **实现偏差**：`review-code.md` 的统一提交段是超长单行，整行替换脆弱，故**未直接改该行**；改由步骤 1 的排除段显式声明"SHALL NOT 被循环结束时的统一 commit 纳入"来覆盖"统一提交范围不含该文件"这一要求（语义等价，避免脆弱的整行 patch）。
- `archive.md` 仅加一句说明（快照随既有 `git add -- openspec/` 落库、无需额外命令），未新增任何归档命令。
- `explore.md` 新增「进入前：审查未修项快照询问（SHALL）」段，置于委托 `opsx:explore` 之前，明确"先询问、后列出"与参数原样转发。
- 测试：`src/utils/__tests__/host-adapters.test.ts` 新增 3 个模板断言（两 review 模板的快照写入/排除/失败容错/节级 upsert；explore 先问后列与读失败容错；archive 落库说明），全量 207 tests 通过。
- `apply.md` **未改动**：其提交用显式文件清单，天然不含未跟踪的快照，proposal 已注明。
