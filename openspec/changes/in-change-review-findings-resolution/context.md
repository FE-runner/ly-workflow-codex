# context：in-change-review-findings-resolution

> 软上下文：只记文档外的讨论结论；方案细节见 proposal / design / delta spec。

## 关键决策与理由
- 选 A（审查后同会话修复即标注）+ C（归档前核对兜底）：用户确认两种修复时机都存在（审完即修 / 隔段时间再修）。
- 就地标注一律"未复审"并必带 commit hash：用户要求与经审查的跨 change 解决区分；重跑审查会整节替换，故不存在"已复审"就地标注（design D2）。
- 起因：`add-claude-host` 的 3 条代码审查 Warning 已在 `0a33558` 修复，但归档快照显示 0 条已解决（explore 时实测核对）。

## 已否决
- B：在 `@lyx-commit` 按 diff 位置自动匹配 Warning——行号漂移易误判/漏判，且把快照逻辑扩散到通用 Git 工具。
- "不改机制，靠人工回看核实"——回看时误导，用户选择补机制。

## 范围边界
- 只改共享 skill 模板正文（review-plan / review-code / archive / explore）、主 spec Purpose 与模板断言测试；不动 `src/` 运行时逻辑与宿主片段。
- 补登记 3 条走既有跨 change 声明路径（proposal `## 解决的审查未修项`），说明文案写"已在 0a33558 修复，本 change 补登记"。

## 注意事项
- 本 change 自身归档时会同时触发：C 核对（若本 change 快照有未标注 Warning）与跨 change 回写 `add-claude-host` 快照，二者互不影响。
- 既有测试断言大量逐字匹配模板句子（如 `SHALL NOT 改写 active 快照`），收窄口径时保留原句、追加限定，避免误伤断言。
