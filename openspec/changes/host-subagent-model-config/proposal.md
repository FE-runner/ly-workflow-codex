## Why

claude 宿主的子代理模型与推理档目前只能手改 `~/.claude/lyx/config.toml` 再触发重装——`lycx init` 与交互菜单都只采集执行者字段。结果是两个宿主的采集面不对称：codex 的 init 已支持模型二连 + 推理档二连，claude 侧却一处都没有，菜单甚至只能改执行者。手工编辑容易漏掉重装，进而留下"配置已改、定义未重渲染"的偏差。

## What Changes

- `lycx init` 的 claude 分支补齐模型二连（`reviewModel` / `codingModel`）与推理档二连（`reviewReasoningEffort` / `codingReasoningEffort`）采集，采集条件、候选语义与清洗规则与 codex 完全一致：仅在对应执行者为 `subagent` 时采集，候选为「留空（继承当前会话）+ 自定义输入 + 既有值」。
- 交互菜单的配置入口由"仅审查侧"扩为 执行者二连 → 模型二连 → 推理档二连 → 写回 → 重渲染产物，两个宿主行为统一；菜单标签由「配置审查模型」改为「配置执行者与模型」。
- **BREAKING（交互行为变更）**：codex 菜单新增编码侧的执行者 / 模型 / 推理档提问；claude 菜单新增审查侧模型 / 推理档提问，并保留既有执行者二连。菜单交互轮次因此变多。
- 推理档建议档位清单改为按宿主提供（挂宿主适配器，共享层不出现宿主名与宿主路径判断）：claude = `low` / `medium` / `high` / `xhigh` / `max`，codex 保持 `minimal` / `low` / `medium` / `high` / `max`。清单仍只作提示、不做枚举强校验，既有值不在清单内时照常保留并默认选中。
- 边界不变：不采集、不读取、不写入宿主自身的 provider / settings 配置（含 claude 的 `~/.claude/settings.json`）；claude 子代理定义未配置时仍以"继承当前会话"为默认。
- 同步 i18n 文案（zh-CN / en，含菜单标签与采集提示）与 `README.md` / `AGENTS.md` / `CLAUDE.md` 中"claude 只采集执行者"的表述，并更新 `CHANGELOG.md`。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `subagent-agent-config`: 交互采集面由"codex init 二连 + 菜单仅审查侧"扩为**两宿主一致的 `init` 与菜单二连**（执行者 → 模型 → 推理档）；claude 宿主不再被禁止采集模型与推理档字段；推理档建议档位清单由单一内置清单改为按宿主提供。

## Impact

- `src/commands/init.ts`：claude 分支的采集扩展；`collectCodexHostConfig` 中的模型 / 推理档采集段抽出为两宿主共用步骤
- `src/commands/menu.ts`：配置入口扩为二连（含编码侧），菜单标签与相关提示文案更新
- `src/utils/host-adapters.ts` 与 `src/hosts/codex/`、`src/hosts/claude/`：新增宿主级推理档建议清单字段
- `src/utils/model-candidates.ts`：`buildReasoningEffortChoices` 的建议清单改为按宿主传入
- `src/i18n/index.ts`（zh-CN / en）：新增与更新采集提示、菜单标签、摘要文案
- 文档：`README.md`、`AGENTS.md`、`CLAUDE.md` 中"claude 只采集执行者"的表述同步
- 测试：`src/commands/__tests__/{init,menu,host-ops}.test.ts`、`src/hosts/claude/__tests__/claude-host.test.ts`、`src/i18n/__tests__/i18n.test.ts`、`src/utils/__tests__/model-candidates.test.ts`
- `CHANGELOG.md`
- 不涉及运行时依赖、打包产物布局与既有配置字段的兼容读取
