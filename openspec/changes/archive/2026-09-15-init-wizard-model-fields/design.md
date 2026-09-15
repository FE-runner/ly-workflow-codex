# init-wizard-model-fields 设计

## 背景

- 现状向导（`src/commands/init.ts`）：Step 1/4 工作流模式（恒"单 Agent（Codex）"）→ Step 2/4 选择 Agent（恒 Codex）→ Step 3/4 API 提供方 → Step 4/4 模型；只采集 `reviewModel` 一个字段，返回 `string | undefined`。
- 现状配置：`codexHost.reviewModel` 经 `sanitizeReviewModel` 白名单清洗；`reviewModelB`/`codingModel` 在 `createDefaultConfig` 中 trim 透传（subagent-multi-agent-mode 引入；不入 shell 命令串、无注入面故不做白名单清洗）。
- 现状持久化：`init()` 非交互与交互路径都以 `{ codexHost: { reviewModel } }` 调 `createDefaultConfig`，`reviewModelB`/`codingModel` 在重装时被丢弃；menu 的 `configReviewModel` 写回 `fresh.codexHost = { reviewModel: next }` 同样丢弃。

## 决策

### D-A: 向导步骤收敛（去单选项步）

- **选择**：移除"工作流模式"与"选择 Agent"两步，交互流程 = 语言 → API 提供方 → 模型三连 → 配置摘要。
- **理由**：codex 单宿主下两步恒为唯一选项，纯冗余交互（用户明确拍板去掉；连同"选择 Agent"单选项步一并去掉）。
- **影响**：删除 `init.mode.select/singleAgent/agentSelect/agentCodex` i18n 键；`collectCodexHostConfig` 的 `askAgent` 参数删除；`init:summary.reviewModelCodex` 键保留给 menu 单行显示，向导摘要改用新增的三行键。

### D-B: 模型三连采集方式（用户确认"采集方式用 provider 的模型列表"）

- **选择**：provider 选定后 `GET {base_url}/models` 拉取**一次**模型列表，三个字段共用该列表逐个 `list` 选择；每字段尾部附"✏️ 自定义输入…"与"不设置（回退当前会话模型）"两项；拉取失败回退为三个 `input` 提示（留空 = 不设置）。
- **默认值语义**（防静默丢值）：既有配置值在列表内 → 默认该项；既有值非空但不在列表 → 默认"自定义输入"（弹框 SHALL 预填既有值，直接回车即保留原值）；否则（无既有值或空白）→ 默认"不设置"；空白等价未配置。
- **清洗归属**：三连 UI 仅为统一采集入口，持久化清洗沿用各字段现状——`reviewModel`（A）走 `sanitizeReviewModel` 白名单，`reviewModelB`/`codingModel` 走 `sanitizeModelField` 仅 trim；不做跨字段统一（与现状一致，不扩大行为变更）。
- **理由**：一次拉取三连用，避免三次网络请求；自定义入口兜底列表外模型（既有值来自其他 provider 时不丢）；显式"不设置"让"回退当前会话模型"语义可见。
- **代价**：三连均为列表交互；全新安装默认值均为"不设置"（回车即全部回退会话模型），由配置摘要明示，用户确认安装前可见。

### D-C: 重装与编辑保真

- **选择**：`init()` 交互与非交互路径都读取既有三字段作为默认并统一写回；menu `configReviewModel` 写回时保留既有 `reviewModelB`/`codingModel`。
- **理由**：`lycx update`（`init --force --skip-prompt`）走非交互路径，现状会丢 B/coding；menu 单字段编辑现状同样会丢。三字段成为一等配置后，任何重写配置的路径 SHALL NOT 静默丢弃。
- **注意**：`installWorkflows(..., { reviewModel })` 入参保留不变（仅服务历史 `{{REVIEW_MODEL}}` 兼容渲染），与三字段持久化解耦——skill 模板在运行时读取 `~/.ly/config.toml`。

### D-E: 范围控制

- **选择**：不动 skill 模板、review 关卡行为、`doctor`/menu 全字段编辑（列为后续候选）；menu 仅做"不丢另一字段"的最小修复。
- **理由**：用户本轮诉求聚焦 init 向导；菜单全字段编辑属另一 UI 变更，宜单独 change。
- 已知边界：`openspec/specs/ly-review-gates/spec.md` 存在 subagent-multi-agent-mode 归档合并遗留（部分段落仍含 `codex exec` 措辞），为既有问题，不在本 change 处理。

## 验证

- `openspec validate --changes init-wizard-model-fields` 结构合法。
- `pnpm typecheck && pnpm build && pnpm test` 全绿。
- 交互烟测（可选）：`node bin/lycx.mjs init` 流程 = 语言 → provider → 三连 → 摘要；`lycx update` 重装后 `~/.ly/config.toml` 三字段保留。
