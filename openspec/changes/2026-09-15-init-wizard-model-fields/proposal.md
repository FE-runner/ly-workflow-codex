# init-wizard-model-fields — init 向导三模型字段采集

## Why

`subagent-multi-agent-mode` 将执行模型迁移到 subagent 多 Agent 模式并新增 `codexHost.reviewModelB` / `codingModel` 配置字段后，`lycx init` 向导未同步：

1. **向导仍只采集一个模型**：交互只收集 `codexHost.reviewModel`（i18n 提示语也写明"agent B / coding 模型暂不在此设置"），用户要配置三个模型只能手动编辑 `~/.ly/config.toml`，与"安装即完成配置"的体验不一致。
2. **两步单选项冗余交互**：向导仍保留"Step 1/4 工作流模式"与"Step 2/4 选择 Agent"，codex 单宿主下两步恒为唯一项，纯属无效点击。
3. **重装静默丢字段**：`init --force --skip-prompt`（`lycx update` 重装路径）以 `createDefaultConfig` 重写配置时仅透传 `reviewModel`，会静默丢弃已有 `reviewModelB` / `codingModel`；menu 的"修改审查模型"单字段写回同样会丢。

## What Changes

1. **向导步骤收敛**：移除"工作流模式"与"选择 Agent"两个单选项步骤；交互流程变为 语言 → 选择 API 提供方 → 模型三连 → 配置摘要。
2. **模型三连采集**：provider 选定后拉取一次模型列表，`reviewModel`（审查 agent A）、`reviewModelB`（审查 agent B）、`codingModel`（coding 实施）三个字段共用该列表逐个选择；每字段附"自定义输入…"与"不设置（回退当前会话模型）"两个特殊项，默认值取既有配置（命中列表内默认该项，命中自定义默认进入输入框，均未配置默认"不设置"）；列表拉取失败时回退为三次自由输入（留空 = 不设置）。
3. **配置保真**：交互与非交互路径统一透传三个字段到 `createDefaultConfig`；update 重装（`init --force --skip-prompt`）不再丢弃已有 `reviewModelB` / `codingModel`；menu 单字段编辑写回时保留另两字段。
4. **摘要与文案**：配置摘要展示三个模型各自状态（配置值 / 未配置回退）；zh/en i18n 提示语同步新增；删除废弃的 mode/agent 文案键。

## Capabilities

### Modified Capabilities

- `subagent-agent-config`: ADD —— `lycx init` 向导 SHALL 按"提供方 → 模型三连"采集 `codexHost` 三个模型字段（含默认值语义、自定义/不设置入口、拉取失败回退输入），非交互重装 SHALL 保留既有三字段。

### New Capabilities

（无）

## Impact

- `src/commands/init.ts`：交互流重构——移除模式/Agent 步、`collectCodexHostConfig` 返回三字段（模型三连 + 拉取失败回退输入）、摘要三行、非交互路径三字段保真。
- `src/utils/config.ts`：抽出 `sanitizeModelField`（trim → undefined，无白名单清洗）供 `reviewModelB`/`codingModel` 与 `createDefaultConfig` 复用。
- `src/commands/menu.ts`：`configReviewModel` 写回保留既有 `reviewModelB`/`codingModel`（本次仍只编辑审查 agent A；全字段菜单编辑列为后续候选）。
- `src/i18n/index.ts`：zh/en —— 新增 `init:model.*` 三连键与 `init:summary.*` 三模型行，收敛 `init:host.reviewModelPrompt`，删除 `init:mode.select/singleAgent/agentSelect/agentCodex`。
- 文档：README（初始化向导描述）、CLAUDE.md（模块职责）、AGENTS.md（工作区文件，`.gitignore` 忽略、不随 commit 落库，与 subagent-multi-agent-mode 同处理）。
- 测试：`src/utils/__tests__/config.test.ts` 补 `sanitizeModelField` 与三字段组合断言。
- 不涉及：skill 模板（模型仍经"模板指示 + 宿主能力"落实，渲染层不动）、review 关卡行为、`docs/codex-exec-contract.md`、`src/utils/installer-data.ts` 命令注册。
