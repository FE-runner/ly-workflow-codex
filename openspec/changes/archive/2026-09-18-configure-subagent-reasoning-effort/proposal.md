## Why

当前 `lycx init` 只采集执行者二连与模型二连，推理档仍要求用户手改 `~/.codex/lyx/config.toml`。对 `glm-5.3-flash` 这类必须显式传 `reasoning_effort` 的模型，用户容易在配置阶段遗漏，直到 spawn 报错才发现；同时已有推理档也无法通过向导显式回到"继承默认"状态。

## What Changes

- `lycx init` 在对应执行者为 `subagent` 时，分别为审查与 coding 采集推理档配置：`不覆盖（继承模型/宿主默认）` 或 `覆盖并指定档位`。
- 选择"不覆盖"时 SHALL 清除交互向导中的既有 `reviewReasoningEffort` / `codingReasoningEffort` 值；选择覆盖时写入选定档位。
- 推理档候选 = `不覆盖` + 常见档位建议（`minimal` / `low` / `medium` / `high` / `max`）+ 自定义输入；既有值非法也 SHALL 作为候选项保留并默认选中，SHALL NOT 做枚举白名单强校验。
- `lycx` 菜单"配置审查模型"同步支持编辑 `reviewReasoningEffort` 的覆盖/不覆盖；coding 推理档由 `lycx init` 采集。
- `lycx doctor` 的推理档文案改为区分"未覆盖（继承模型/宿主默认）"与"已覆盖: <值>"，仍不做合法性强校验。
- 交互配置摘要 SHALL 展示每个 subagent 的推理档状态（未覆盖 / 已覆盖: <值>），让确认页能直接看到生效结果。
- 非交互 `lycx update`（`init --force --skip-prompt`）SHALL 保留既有推理档原值，SHALL NOT 隐式清除。
- 同步更新 `subagent-agent-config` spec、i18n、README/CLAUDE/AGENTS 文档与相关测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `subagent-agent-config`: 推理档从"向导不采集、只能手改"改为"交互配置入口可显式选择不覆盖或覆盖并指定档位"，并定义显式不覆盖时的清除语义与保留边界。

## Impact

- CLI：`src/commands/init.ts`、`src/commands/menu.ts`、`src/commands/doctor.ts`
- 配置与 i18n：`src/utils/config.ts`（如需清除辅助逻辑）、`src/i18n/index.ts`
- 测试：`src/commands/__tests__/doctor.test.ts`、`src/utils/__tests__/config.test.ts`、必要的 init/menu 相关测试
- 文档与 spec：`openspec/specs/subagent-agent-config/spec.md`、`README.md`、`CLAUDE.md`、`AGENTS.md`
- 模板：`review-plan` / `review-code` / `apply` 的 spawn 传递契约不变，仍只在字段非空时传 `reasoning_effort`
