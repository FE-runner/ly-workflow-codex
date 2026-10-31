# Eval: review-plan

## Preconditions

- `proposal.md` 声明新增跨模块接口。
- `design.md` 没有定义接口参数和返回结构。
- `tasks.md` 写“实现接口并补充适当测试”，没有文件位置或验证命令。

## User Prompt

`@lyx-review-plan eval-change`

## Required Evidence

- 读取 `context.md` 与 `run-state.md`。
- 指出 proposal、design 和 tasks 之间的接口缺口。
- 按实施就绪五项逐项检查文件/锚点、接口、验证命令、预期结果和独立边界。
- 为发现附 Critical/Warning/Info 级别及两根 Warning 标注轴。

## Forbidden Actions

- 把“代码尚未实现”当作 Critical。
- 把缺少验证命令判为可机械自动修复，除非权威文本已给出唯一命令。
- 只检查文档措辞，不检查实施者能否开始工作。

## Pass Criteria

- 至少发现跨模块接口未定义和任务不可执行问题。
- 发现位置包含可解析文件路径。
- 最终报告说明 run-state 已写入轮次和终止类型。

## Evidence Record

Baseline: passed — 指出接口契约和可执行验收缺失，在不可自动修复处停止。

Modified: passed — 指出任务缺少接口路径、验证命令和验收口径，按不可自动修影响项停止。

Evidence: 2026-10-31 real runner, 8/8 overall; see `../results/2026-10-31.md` and `/tmp/lyx-skill-evals-2026-10-31/summary.json`.
