## Why

Codex subagent spawn 的可用模型是**环境相关**的（当前显式可选仅 `gpt-6-astra`/`gpt-5.6-sol`/`gpt-5.6-terra`/`gpt-5.6-luna`/`gpt-5.5`，留空继承主会话模型实测可用；曾出现过仅 `glm-5.3-flash` 可 spawn 的配置态），而 `lycx` 的模型三连候选目前来自 provider 的 `/models` 列表与自由输入——候选与"实际可 spawn"错位，选中列表外模型后双审/实施 spawn 必报 `Unknown model`，最终以笼统的"运行期失败"终止流程，用户无从定位是配置问题。配置模型前也看不到 Codex 当前实际配置的模型，无法对照。

## What Changes

- 新增 `[codexHost] spawnableModels`（可选字符串数组）：声明当前宿主显式 spawn 可用的模型清单；未配置或空白回退内置默认 `SPAWNABLE_MODELS_DEFAULT`（=`gpt-6-astra`/`gpt-5.6-sol`/`gpt-5.6-terra`/`gpt-5.6-luna`/`gpt-5.5`，当前环境实证值）。该字段是唯一可维护的"候选/校验"来源——可用列表已被证实随环境漂移，不可硬编码进模板。
- `lycx init` 模型三连前新增 **Codex 现状检测前置**（纯静态读取、零副作用）：展示 `~/.codex/config.toml` 顶层 `model`（主会话模型 = "默认继承"的实际值）、`[model_providers.*]`、`~/.codex/models.json` 注册集合规模；`models.json` 仅作展示（实测其内容 ≠ spawn 可用列表），不直接作为候选。
- `lycx init`/菜单的模型三连候选改为 `[默认继承当前会话模型（留空）] + spawnableModels`，**不再以 provider `/models` 为候选来源、不再自由输入**；既有值非空但不在列表时，列表附加"保留当前值（不在可用列表，警告）"项，SHALL NOT 静默丢弃或覆盖（保留既有"不丢配置"语义）。
- `lycx doctor` 新增检查项"Codex 子代理模型配置"：三个模型字段留空 = 通过（继承回退，实测可用）；非空且 ∈ spawnableModels = 通过；非空且 ∉ spawnableModels = FAIL，提示配置 `spawnableModels` 或改配模型。
- 模板运行时（review-plan/review-code/apply）模型校验规则：配置的模型非空且 ∉ spawnableModels → **明确报告"子代理模型配置无效（<model> 不在可用列表，请运行 `lycx doctor` 或配置 `[codexHost] spawnableModels`）"并停止该关卡转人工改配**，不落入笼统的"运行期失败"终止；"回退当前会话直接执行"仅在留空（未配置）时发生。spawn 失败报错原文含 `Available models: ...` 时如实展示，供用户据实维护 `spawnableModels`。模板安装时注入 `spawnableModels` 生效值（配置或默认），列表不写死在模板正文。
- **BREAKING（行为）**：模型三连移除"自定义输入"入口与 `/models` 拉取依赖，自由输入的旧用法被候选列表替换；存量非法配置值不自动纠正，仅警告+C 级暴露（doctor FAIL / init 警告项）。
- 文档（README/CLAUDE.md）与 i18n 文案同步；`glm-5.3-flash` 需 `reasoning_effort: low` 的参数坑写入 init 现状检测提示（背景说明，不新增模板参数通道）。

## Capabilities

### New Capabilities

（无)

### Modified Capabilities

- `subagent-agent-config`: 新增 `spawnableModels` 字段语义与默认回退；修改"init 向导模型三连采集"（候选来源 = 留空 + spawnableModels + 现状检测前置，移除 /models 候选与自由输入）；修改"模型指定与不可用回退"（区分留空继承 vs 配置无效明确报错）；新增 doctor 模型配置校验。

## Impact

- `src/types/index.ts`：`LyConfig.codexHost` 增加 `spawnableModels?: string[]`
- `src/utils/config.ts`：`createDefaultConfig`/读清洗（`sanitizeSpawnableModels`）、默认常量
- `src/utils/codex-provider.ts`：新增 `readCodexCurrentModel()`（config.toml 顶层 `model`）、`readModelsJson()`（`~/.codex/models.json`）
- `src/commands/init.ts`：现状检测前置 + 模型三连候选改造（去 `/models`/自由输入）
- `src/commands/menu.ts`：审查模型编辑候选同步
- `src/commands/doctor.ts`：新增模型配置检查项
- `src/utils/installer-template.ts`：注入 `spawnableModels` 生效值到模板
- `templates/skills-codex/{review-plan,review-code,apply}.md`：模型校验规则与配置无效报错口径
- `src/i18n/`：新文案；`README.md`/`CLAUDE.md`：spawnableModels 与候选语义说明
- 测试：`src/utils/__tests__/`、`src/commands/__tests__/` 补充对应单测
