## Context

见 `proposal.md` 的 Why。当前实现的相关约束：

- `src/commands/init.ts` 的 `collectClaudeHostConfig` 只遍历 `EXECUTOR_FIELDS`；`collectCodexHostConfig` 在同一会话内完成"提供方 → 现状检测 → 执行者二连 → 模型二连 → 推理档二连"。模型与推理档的采集原语（`MODEL_FIELDS`、`REASONING_FIELDS`、`pickModelField`、`pickReasoningEffortField`）本已是宿主无关代码，只是从未被 claude 分支调用。
- `src/commands/menu.ts` 的 codex 分支只编辑 `reviewExecutor` / `reviewModel` / `reviewReasoningEffort`，写回时用 `mergeHostConfig` 显式保留 coding 三字段；claude 分支 `configClaudeExecutors` 只编辑执行者二连。两个入口的能力集合互不相同。
- 推理档建议清单是共享层常量 `REASONING_EFFORT_SUGGESTIONS`（`src/utils/model-candidates.ts`），单一清单同时服务两个宿主。
- `HostAdapter`（`src/utils/host-adapters.ts`）是宿主专属知识的唯一登记处；`multi-host-install` 的"宿主适配层与共享安装流程解耦"约束要求共享层不出现宿主名与宿主路径判断。
- claude 子代理定义的渲染（`renderAgentModelLines`）与 doctor 的取值展示 / 偏差检测早已支持 `model` 与 `effort`，本次不需要改动渲染与体检逻辑。

## Goals / Non-Goals

**Goals:**

- 两个宿主的交互 `init` 与交互菜单收敛到同一采集面与同一候选语义：执行者二连 → 模型二连 → 推理档二连。
- 建议档位清单按宿主提供，且该知识落在宿主侧、不泄漏到共享层。
- 菜单写回语义与 `init` 一致：既有的未触碰字段按默认值回填，不因编辑入口而丢失。

**Non-Goals:**

- 不采集、不读取、不写入宿主自身的 provider / settings 配置（含 claude 的 `~/.claude/settings.json`）。
- 不引入 provider `/models` 或 relay 模型列表作为候选或校验来源。
- 不对推理档取值做枚举白名单强校验。
- 不改动子代理定义的渲染格式（`model` / `effort` 行）与 `doctor` 的判定口径。
- 不改动非交互路径（`--skip-prompt`）与 `lycx update` 的既有保留语义。

## Decisions

### 1. 抽出宿主无关的采集步骤，而非为 claude 复制一份

把 `collectCodexHostConfig` 中"执行者二连 → 模型二连 → 推理档二连"的采集段抽成一个宿主无关函数（输入：既有值 defaults、该宿主的建议档位清单；输出：`CodexHostCollected` 形态的采集结果），`collectCodexHostConfig` 与 `collectClaudeHostConfig` 共同调用；codex 的"提供方选择 → 现状检测"保持为其专属前置步骤。

**为什么**：采集原语本就宿主无关，重复实现会导致候选语义与清洗规则在两侧漂移（本仓库已有过 `reviewModelB` 类的历史包袱）。抽取后新增宿主的成本也为零。

**备选**：在 claude 分支复制一份采集代码。否决——两份实现需要人工同步，且没有任何机制能发现漂移。

### 2. 建议档位清单挂在 `HostAdapter` 上

在 `HostAdapter` 增加一个只读字段（如 `reasoningEffortSuggestions: readonly string[]`），由 `codex` / `claude` 适配器各自提供；共享层的 `buildReasoningEffortChoices` 改为接收该清单参数，不再引用单一常量。

**为什么**：宿主能力差异属于宿主专属知识；共享层出现 `if (host === 'claude')` 会直接违反 `multi-host-install` 的解耦约束，也会让"新增宿主 = 新增宿主包"的成本假设失效。

**备选**：共享层按宿主名分支；或把清单塞进 i18n。均否决——前者破坏架构约束，后者语义错位（档位是能力而非文案）。

### 3. 菜单入口合并为单一通用流程，两个宿主共用

菜单的配置入口改为通用流程：执行者二连 → 模型二连 → 推理档二连 → 回填 → 重渲染产物，两个宿主走同一函数；原 codex 分支的"仅审查侧"实现与 claude 的 `configClaudeExecutors` 一并被替换。

**为什么**：这正是"菜单能力与 init 对齐"的最小实现——保留两个分支会继续维护两套入口集合。

**备选**：只给 claude 补一个独立入口。否决——两套入口集合的不对称会被继续保留，且下一个宿主要再写一遍。

### 4. 未触碰字段按既有值回填，等价于保留

通用流程对每个字段以既有值作为默认选中项；`main` 执行者下不采集对应模型与推理档，既有值原样保留（沿用 codex 现有语义，`doctor` 会对"不生效"输出 WARN）。写回走既有 `mergeHostConfig` + `writeLyConfig`，成功后按当前配置重渲染产物。

**为什么**：保持与 `init` 的"未触碰即保留"语义一致，避免菜单变成隐式清除入口。

### 5. 菜单标签与 i18n key 同步改名

「配置审查模型 / Configure review model」改为「配置执行者与模型 / Configure executors and models」，i18n key 一并改名而非沿用旧 key。

**为什么**：旧 key 名与新语义不符，会误导后续维护；本仓库 `AGENTS.md` 对 `menu.ts` 的描述本就写作"配置执行者与模型"。

**代价**：`src/i18n/__tests__/i18n.test.ts` 与引用该 key 的测试需要同步；实现时全量搜索旧 key 确认无残留。

## Risks / Trade-offs

- [codex 菜单交互轮次变多（新增编码侧三问）] → 仅在对应执行者为 `subagent` 时提问，`main` 下跳过；在 `CHANGELOG.md` 标注交互行为变更。
- [菜单写回范围从"只传审查三项"扩为六项，理论上扩大了误覆盖面] → 沿用既有 read → merge → write → 重渲染流程，所有字段以既有值回填；不新增并发保护，与现有路径保持同一风险等级。
- [建议清单按宿主提供后，共享层调用点漏传参数导致清单退化为空] → 由类型（必填字段）与既有"遍历宿主注册表"的测试断言共同守护，并对两个宿主的清单各写一条断言。
- [claude 侧的 `xhigh` 等档位在部分模型不可用，用户误以为已校验] → 保持"仅提示、不做枚举校验"并在文案与 doctor 中维持"取值合法性由宿主判定、报错如实展示"的口径。
- [i18n key 改名遗漏引用点] → i18n 测试已断言 zh/en key 齐备；实现阶段全量搜索旧 key 并确认零残留。

## Migration Plan

无数据迁移，也不改配置格式：本轮之前用户手工写入 `~/.claude/lyx/config.toml` 的 `reviewModel` / `codingModel` / 推理档字段被新采集面直接读取为既有值默认项，语义不变。回滚方式为回退代码后重装 / 更新，已写入的配置字段无需回退（旧版本同样读取这些字段，仅不提供交互采集入口）。

## Open Questions

（无）
