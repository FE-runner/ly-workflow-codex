# subagent-reasoning-effort 设计

## Context

动机与范围见 `proposal.md`，行为约束见 `specs/subagent-agent-config/spec.md`。本设计只说明实现方式。

现状约束：

- `LyConfig.codexHost` 已有三个模型字段，`createDefaultConfig` 对模型字段做 trim 清洗，并对 `spawnableModels` 做原样透传保全。
- `init` 交互只采集三个模型字段；交互与非交互路径都把既有 `spawnableModels` 透传给 `createDefaultConfig`。
- `menu` 的审查模型编辑只改 `reviewModel`，写回时显式保留其余 `codexHost` 字段。
- `doctor` 第 7 项通过 `assessSubagentModelConfig` 纯函数判定并展示三个模型字段。
- `review-plan` / `review-code` / `apply` 模板在 spawn 前读取 `~/.ly/config.toml`；模型值不通过安装时占位符注入。
- `~/.codex/cc-switch-model-catalog.json` 由外部工具维护，不是本项目可控配置面，不作为本 change 的运行时依赖。

## Goals / Non-Goals

**Goals:**

- 让不同 subagent 可独立指定推理档，且未配置时严格保持现状行为。
- 让配置在交互 init、非交互 init/update、menu 单字段编辑中均可保真保留。
- 让三个 skill 模板成为推理档参数的实际传递入口，不依赖安装时快照。
- 让 `doctor` 能看见当前推理档配置，但不对取值作本地合法性裁决。

**Non-Goals:**

- 不新增 `lycx init` / menu 的推理档交互问题。
- 不维护推理档枚举、模型到推理档的映射，也不改模型候选逻辑。
- 不修改或依赖 CC Switch 的 model catalog。
- 不改变模型字段、spawn 回退、审查共识、修复循环或提交语义。
- 不在本 change 中发版或改写历史安装位。

## Decisions

### D1: 每个模型字段配一个推理档字段，而不是全局单字段

`[codexHost]` 新增：

- `reviewReasoningEffort` ↔ `reviewModel`
- `reviewReasoningEffortB` ↔ `reviewModelB`
- `codingReasoningEffort` ↔ `codingModel`

选择一一配对。三个 subagent 可能使用不同上游模型，全局单字段无法同时服务“需要 `low` 的模型”和“使用默认档的模型”；模型名到档位的硬编码映射又会随环境漂移，且违反现有“不做清单强校验”的契约。

语义为独立透传：对应模型留空时若推理档非空，仍把该档位用于继承后的当前会话模型；是否合法由宿主/上游报错决定。

### D2: 非空才传，空白等价未配置，不维护枚举

三个字段统一走文本清洗：非字符串或 trim 后为空 → `undefined`；否则保留 trim 后原值。写入配置时省略空值；模板只在非空时传 `reasoning_effort`。

不采用枚举校验。上游档位集合可能随模型和 relay 变化，本地白名单会把可工作的新值误判为无效；也不在未配置时补 `low`/`medium`，否则会改变既有默认继承行为。

### D3: 模板运行时读取并传递，不增加安装时占位符

三个模板继续把 `~/.ly/config.toml` 当作唯一运行时来源，在既有模型读取规则旁补充对应推理档读取：

- review agent A：`reviewModel` + 非空时的 `reviewReasoningEffort`
- review agent B：`reviewModelB` + 非空时的 `reviewReasoningEffortB`
- coding subagent：`codingModel` + 非空时的 `codingReasoningEffort`

不改 `installer-template.ts` 的渲染接口。安装时注入值会形成快照，用户修改配置后必须重装才生效，并与当前模型的运行时读取方式不一致；原值若含任意标签或特殊字符，也会扩大模板渲染风险。

推理档被拒绝时沿用既有 spawn 失败口径：展示宿主/上游报错，不把它归为“配置格式无效”。

### D4: CLI 只做保全与提示，向导不采集推理档

`createDefaultConfig` 负责统一清洗和写入三个新字段。为让 init 与 menu 的“保留其余字段”语义共用且可单测，`config.ts` 提供 `sanitizeCodexHostExtras(codexHost)`：清洗并返回 `reviewModelB`、`codingModel`、`spawnableModels` 与三个推理档字段（不含被编辑的 `reviewModel`）。`init` 交互与非交互路径展开该结果；`menu` 写回时以同一结果保留三字段与 `spawnableModels`。这样 `lycx update`（`init --force --skip-prompt`）和单字段编辑不会丢值，测试也不必模拟整套 inquirer 流程。

init 现状检测中的 `reasoningHint` 改为指向 `[codexHost]` 的三个推理档字段，明确“向导不提问、手改 `~/.ly/config.toml` 维护”。理由与 `spawnableModels` 相同：档位相关性与运行环境强相关，CLI 无法在当前主机可靠枚举，强行提问会制造错误预期。

### D5: doctor 只展示，不新增警告级别

第 7 项检查在每条模型字段结果旁展示对应推理档：非空显示当前值，空白显示“未配置（不传推理档参数）”。仅 `spawnableModels` 的非法形态继续触发 WARN；推理档取值不影响检查状态。

这样能验证“配置是否被读到”，同时避免 doctor 把在别处可用的档位判死。实际可用性仍由示例 prompt 和宿主 spawn 报错验证。

### D6: 模型目录问题不在本 change 中治理

外部 catalog 的默认档与本项目模板参数是两个层面。前者由 CC Switch 生成且会覆盖手改，后者由本项目安装和版本控制。本 change 只保证模板能显式传入对应档位，不尝试检测、修补或同步 catalog。

## Risks / Trade-offs

- [三个字段增加手工维护面] → 字段均为可选；只给需要显式档位的模型填写，doctor 直接显示已读值。
- [用户配错与模型不对应的字段] → 模板按固定配对读取，doctor 同屏展示，错误会在 spawn 时以原始报错暴露。
- [上游档位集合变化] → 不做枚举校验，避免本地名单过期；代价是非法值只能在运行期发现。
- [旧的运行中 Codex 进程可能缓存模型目录] → 用户可能仍需重启宿主或改用模板显式传档；这是环境行为，不在 CLI 中伪装修复。
- [三处模板说明可能漂移] → 测试断言三个模板都包含自身对应字段与“非空才传”规则；共享语义同时写进 README/CLAUDE。

## Migration Plan

1. 存量配置无需迁移：三个字段缺失或空白时行为与旧版本完全一致。
2. 构建并运行 `lycx init --force --skip-prompt`（或菜单更新入口）刷新 `~/.agents/skills/lyx-*` 与共享角色词，使新模板指示生效。
3. 用户在 `~/.ly/config.toml` 手动填写需要的推理档字段；重复 `lycx update` 或菜单编辑不得清空。
4. 回滚时使用旧版本重新 `init` / `update`。旧版本会忽略未知字段；如需完全清理，可手工删除三个字段，无数据格式残留。

## Open Questions

无。实现所需决策均已收敛，后续仅按 spec 与任务清单落地。
