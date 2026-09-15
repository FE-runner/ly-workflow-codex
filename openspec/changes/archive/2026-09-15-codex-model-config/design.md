## Context

见 `proposal.md` 的 Why：subagent spawn 可用模型环境相关（当前显式可选 = `gpt-6-astra`/`gpt-5.6-sol`/`gpt-5.6-terra`/`gpt-5.6-luna`/`gpt-5.5`；留空继承主会话模型实测可用；曾出现仅 `glm-5.3-flash` 可用的配置态），而模型三连候选来自 provider `/models` 与自由输入，与可 spawn 集合错位。

现状代码约束：
- `src/commands/init.ts` 的 `collectCodexHostConfig`：provider 选择 → `fetchCodexModels` 拉 `/models` → `pickModelField`（CUSTOM/UNSET 双哨兵）或拉取失败 `inputModelField` 自由输入。
- `src/commands/menu.ts` `configReviewModel`：自由 input 编辑 `reviewModel`，写回时重建 `codexHost`（须保留 B/coding，本改动还须保留 `spawnableModels`）。
- `src/commands/doctor.ts`：现有 6 项检查，无模型配置项。
- `src/utils/installer-template.ts`：仅处理历史占位符（REVIEWER_MODEL/IMPLEMENTER_MODEL/LITE_MODE_FLAG/条件块），模板正文已写明"模型经模板指示 + 宿主能力落实"，无模型值占位。
- `src/utils/codex-provider.ts`：已有 `listModelProviders`/`readCodexConfigToml`/`upsertModelProvider`，可扩展读取顶层 `model`。
- spec 基线：`openspec/specs/subagent-agent-config/spec.md`（3 个 requirement，本 change 的 delta 已对其中 2 个 MODIFIED、新增 2 个）。

## Goals / Non-Goals

**Goals:**
- 模型三连候选/校验以"可 spawn 清单"（= `spawnableModels`，配置或内置默认）为唯一来源，杜绝"候选 ≠ 可 spawn"错位。
- init 配置模型前展示 Codex 当前配置（主模型/provider/注册模型），静态读取、零副作用。
- 配置了列表外模型时，doctor 检出、模板运行时明确报"配置无效"而非笼统"运行期失败"。

**Non-Goals:**
- 不做 CLI 内 spawn 探测（CLI 无宿主 spawn 能力；探测属于 agent 会话行为）。
- 不引入推理参数（`reasoning_effort`）配置通道：`glm-5.3-flash` 的参数坑仅作为 init 现状检测提示背景（如实展示报错即可）。
- 不改 provider `/models` 拉取本身（provider 管理语义保留），仅不再作为模型三连候选源。

## Decisions

1. **`SPAWNABLE_MODELS_DEFAULT` 常量放 `src/utils/config.ts`**（配置域内聚，与 `sanitizeSpawnableModels` 同居），值 = 当前环境实证的 5 个 OpenAI 模型；`package-meta.ts` 保持路径/名称常量定位。提供 `resolveSpawnableModels(config): string[]`：配置非空清洗后用之，否则返回默认；`sanitizeSpawnableModels(unknown): string[] | undefined`（仅字符串数组、trim、去重、空数组→undefined）。 字段显式存在但**整体格式非法**（非数组、或清洗后为空）按未配置回退内置默认（有意取舍），但 `doctor` 对该形态输出 WARN（区别于"完全未配置"的静默通过），避免写错字段类型时无从察觉。模型名比对规则 = trim 后**字面精确匹配**，不支持 `provider/model` 前缀；现状检测展示的顶层 `model` 若带前缀仅作展示、不参与比对。 `sanitizeSpawnableModels` SHALL 统一产出"未配置 / 清洗后为空 / 格式非法"三态判定入口，doctor 与 init 共用，避免两处判定口径漂移。
2. **候选来源单一化**：`init`/`menu` 的模型三连候选 = `[\`0 默认继承当前会话模型（留空）\`] + resolveSpawnableModels()`；删除 `fetchCodexModels` 调用路径与 `pickModelField` 的 CUSTOM 哨兵、删除 `inputModelField` 自由输入回退。既有值非空且不在清单时，候选附加"保留当前值 `<v>`（不在可用列表，警告）"项并默认该项（等价替代原 CUSTOM 哨兵的保全语义，且不产生清单外新输入）。
3. **Codex 现状检测前置（init 交互模式）**：`collectCodexHostConfig` 在 provider 选择后、模型三连前新增只读展示块——`readCodexCurrentModel()`（`~/.codex/config.toml` 顶层 `model`）、`listModelProviders()`、`readModelsJson()`（`~/.codex/models.json`，解析成功 → 模型名数组；**缺文件/解析失败 → `undefined`**，展示层据此标注"未检测到"，与"注册 0 个模型"可区分）；展示"主会话模型（默认继承实际值）/ provider 条目 / 注册模型 N 个 / 未检测到"，读取失败不阻断。
4. **doctor 新增第 7 项检查**"Codex 子代理模型配置"：以 `resolveSpawnableModels` 为清单，三字段逐项判定（留空=OK；∈=OK 标注模型；∉=FAIL 附修配指引），detail 展示生效清单（用户配置或"内置默认"）。
5. **模板注入 + 模板规则**：`installer-template.ts` 新增占位 `{{SPAWNABLE_MODELS_DEFAULT}}`（渲染列表文本，仅作后备）；`review-plan/review-code/apply` 三模板的模型指示段补"模型可用性校验"规则——主会话在 spawn 前 SHALL 读取 `~/.ly/config.toml` 的 `[codexHost] spawnableModels`（未配置用模板后备默认）校验非空配置值；∉ 清单 → 明确报"子代理模型配置无效 … 请运行 `lycx doctor` 或配置 `[codexHost] spawnableModels`"，停止该关卡转人工改配（不回退、不归"运行期失败"）；留空 → 继承回退（既有口径）。spawn 失败报错含 `Available models:` 时如实展示供用户维护清单。留空 → 继承回退（既有口径）。spawn 失败报错含 `Available models:` 时如实展示供用户维护清单。模板运行时读取 `~/.ly/config.toml` 失败（缺文件/解析错误）时 SHALL 视为"配置状态未知"，明确提示"无法读取配置，请运行 `lycx doctor` 检查"，SHALL NOT 按"未配置"静默继承回退（避免掩盖存量非法模型值）；配置合法的初始 spawn 环境失败仍按既有"环境级不可用"回退口径处理（与"配置无效"两分支不混淆）。`spawnableModels` 维护方式 = 手改 `~/.ly/config.toml`（TOML 数组格式 `spawnableModels = ["model-a", ...]`，spec 场景含示例），编辑交互入口列为后续增强。
6. **menu 写回保全**：`configReviewModel` 写回重建 `codexHost` 时同时保留 `reviewModelB`/`codingModel`/`spawnableModels`。
7. **i18n 文案**：新增现状检测三行展示、候选"留空/保留当前值（警告）"文案、doctor 检查标签与 FAIL 详情；同步 zh-CN/en。

## Risks / Trade-offs

- [内置默认 5 模型随 Codex 版本演变] → `spawnableModels` 可配置覆盖；发版时同步常量；doctor/init 文案提示"以本机实测为准"。
- [移除自由输入影响旧流程] → 既有清单外值不静默丢弃（候选"保留当前值（警告）"+ doctor FAIL 暴露），spec 已有对应场景约束。
- [模板注入列表是安装时快照，改配置后不重装不刷新] → 模板规则以"运行时读取 `~/.ly/config.toml`"为主、注入仅为后备默认；用户改配置后重跑 `lycx init/update` 即刷新模板。
- [内置默认随版本变化，CLI 代码常量与模板后备快照可能不同步] → 发版规则注明"升级后建议重跑 `lycx init/update` 刷新模板"；模板后备仅作兜底，判定以模板运行时读取 `~/.ly/config.toml` 为准。

## Migration Plan

- 存量配置零破坏：`spawnableModels` 未配置 → 全链路回退内置默认；`update`（`--skip-prompt`）保留三字段与 `spawnableModels` 原值。
- 存量清单外模型值：不自动改写，doctor FAIL + init 警告暴露，由用户主动修配。
- 回滚：删除本 change 改动即回退旧行为（`/models` 候选 + 自由输入可经 revert 恢复），无数据迁移残留。

## Open Questions

无（可在实现中按 spec 直接落地的决策均已收敛）。
