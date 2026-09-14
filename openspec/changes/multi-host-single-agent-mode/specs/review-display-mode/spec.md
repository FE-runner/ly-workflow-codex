## MODIFIED Requirements

### Requirement: init 向导提供审查进度展示方式选项
init 向导的"审查进度展示方式"步骤（终端进度 / Web UI，写 liteMode）为 claude 宿主专属：仅当宿主选择为 claude 或 both 时必须（SHALL）出现——both 时该选择仅对 claude 宿主安装分支生效。仅选 codex 宿主时 init 必须（SHALL）跳过该步骤（codex 宿主无 Web UI 机制，见 `codex-single-agent-mode`）。`ly menu` 显示设置入口维持 claude 宿主语义，编辑的仍是同一份 liteMode 配置。存量配置缺失该字段时按 `false`（Web UI 开启）处理，语义不变。

#### Scenario: 仅 codex 宿主跳过展示方式询问
- **WHEN** 用户在 init 宿主选择中仅选 codex
- **THEN** 向导不出现"审查进度展示方式"步骤，liteMode 配置不被写入或保持原值，codex 侧安装不受影响

#### Scenario: both 宿主时选择仅作用于 claude 分支
- **WHEN** 用户选择 both 宿主并在性能设置中选"终端进度"（liteMode=true）
- **THEN** claude 分支安装的命令模板渲染出 `--lite` 标志；codex 分支产物不引用该标志，行为不受影响

### Requirement: 展示方式经模板渲染与 --lite 透传到 wrapper
`{{LITE_MODE_FLAG}}` 模板变量必须（SHALL）按 liteMode 配置渲染：liteMode=true 时输出 `--lite `（含尾随空格），false 时输出空串。审查命令（review-plan/review-code 及外部 implementer 的 apply 调用）最终必须（SHALL）把该标志透传给 ly-wrapper，由其决定是否启动进度 Web UI。该渲染与透传链路为 claude 宿主专属——codex 宿主的命令模板（见 `codex-single-agent-mode`）SHALL NOT 包含 `{{LITE_MODE_FLAG}}` 占位符或 ly-wrapper 调用。

#### Scenario: 端到端联动（claude 宿主）
- **WHEN** 配置 liteMode=false，用户在 Claude Code 中运行 `/ly:review-plan <change>`
- **THEN** 命令构造的 wrapper 调用不含 `--lite`，ly-wrapper 启动进度 Web UI 并自动打开浏览器

#### Scenario: codex 版模板不含占位符
- **WHEN** codex 适配器渲染 templates/commands-codex/ 下的命令模板
- **THEN** 产物中不存在 `{{LITE_MODE_FLAG}}` 残留与 ly-wrapper 调用（该模板从源头不含此占位符，渲染器无需为其处理该变量）
