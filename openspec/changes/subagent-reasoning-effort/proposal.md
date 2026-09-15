## Why

部分第三方模型（如 `glm-5.3-flash`）在默认推理档下无法启动：上游只接受 `low`/`high`/`max`，而宿主按模型目录默认档（`medium`）发起请求，稳定报 HTTP 400（"该模型始终思考，不支持关闭思考；请使用 low、high 或 max"）。而 `@lyx-review-plan`/`@lyx-review-code`/`@lyx-apply` 的 spawn 指示当前不传任何推理参数，因此 `[codexHost] reviewModel = "glm-5.3-flash"` 会稳定 spawn 失败并降级为当前会话直接执行——双审查与独立实施形同失效，用户却只能在宿主的模型目录里改默认档绕过，而该目录由外部工具生成、随时可能被覆盖，不属于本项目可控配置面。

## What Changes

- `[codexHost]` 新增三个可选推理档字段，与三个模型字段一一对应：`reviewReasoningEffort`（审查 agent A）/ `reviewReasoningEffortB`（审查 agent B）/ `codingReasoningEffort`（coding subagent）。
- 三个字段的语义：非空字符串经 trim 后作为对应 subagent spawn 的推理档参数（`reasoning_effort`）随模型一并传入；未配置或空白 = 不传该参数（保持宿主/模型默认档，等价当前行为）。取值不做枚举强校验，合法性以宿主/上游报错为准并如实展示。
- `@lyx-review-plan`/`@lyx-review-code`/`@lyx-apply` 的 spawn 指示段补充"读取对应推理档字段并在非空时随 spawn 传入"的规则；SHALL NOT 引入任何"模型名 → 推理档"的硬编码映射。
- `lycx doctor` 的"Codex 子代理模型配置"检查项展示三个推理档字段的已配置值（提示型，不做枚举强校验）。
- `lycx init`（交互与非交互）、`lycx update`、菜单单字段编辑等所有重写 `[codexHost]` 的路径 SHALL 保留三个推理档字段原值；向导 SHALL NOT 新增推理档交互提问（维护方式与 `spawnableModels` 一致 = 手改 `~/.ly/config.toml`）。
- init 现状检测里的 `reasoning_effort` 参数坑提示改为指向该配置通道（原文"本向导不新增推理参数配置通道"的措辞相应更新）。
- **BREAKING（spec 契约）**：撤销 `subagent-agent-config` 中"SHALL NOT 新增模板参数通道"的约束——本 change 明确新增该通道。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `subagent-agent-config`: 新增三个可选推理档字段及其"非空传入 / 空白不传"语义与重写保留规则；模型落地要求补充推理档经同一条"模板指示 + 宿主能力"通道传递、禁止硬编码模型→档位映射；init 现状检测提示文案改指该通道并纳入重写保留清单；doctor 检查项展示已配置推理档。

## Impact

- `src/types/index.ts`：`LyConfig.codexHost` 增加三个可选字段
- `src/utils/config.ts`：`createDefaultConfig` 读清洗与透传保留（沿用 `sanitizeModelField` 口径）
- `src/commands/init.ts`：现状检测提示文案更新；交互/非交互写回保留三字段
- `src/commands/menu.ts`：单字段编辑写回保留三字段
- `src/commands/doctor.ts`：模型配置检查项 detail 展示已配置推理档
- `templates/skills-codex/{review-plan,review-code,apply}.md`：spawn 指示段补充推理档读取与传入规则
- `src/i18n/`：提示文案更新（zh-CN/en）
- `README.md` / `CLAUDE.md` / `templates/CLAUDE.md`：字段与维护方式说明
- 测试：`src/utils/__tests__/`、`src/commands/__tests__/`、模板渲染断言补对应用例
