## MODIFIED Requirements

### Requirement: uninstall 真正删除本包私有目录 config.toml 与 prompts/

`lycx uninstall` SHALL 删除本包在各宿主下的私有目录与产物，SHALL NOT 采取"保守保留 + 警告"策略——这些目录已是 ly-workflow-codex 私有产物，不存在"可能是别的工具的数据"的顾虑。删除前 SHALL NOT 询问用户二次确认（uninstall 命令本身的确认已在更早步骤完成）。

**按宿主界定卸载范围（自本 change 起）**：卸载范围 SHALL 按宿主分别界定，并 SHALL 支持只作用于单一宿主：

- codex 宿主：`~/.codex/lyx/`（`config.toml` 与 `prompts/`）与该宿主的命令产物（`~/.agents/skills/lyx-*`）。
- claude 宿主：`~/.claude/lyx/`、该宿主的命令产物（`~/.claude/skills/lyx-*`）与该宿主的子代理定义（`~/.claude/agents/lyx-*`）。

作用于单一宿主时，SHALL NOT 删除、移动或修改另一宿主的私有目录与产物。

**不触碰 OpenSpec 自有产物**：卸载任一宿主时 SHALL NOT 删除或修改 OpenSpec 自行生成的产物——包括项目内的 `.claude/commands/` 下由 OpenSpec 创建的命令、`.claude/skills/openspec-*`，以及 Codex 侧的 OpenSpec 技能目录。这类产物的归属方是 OpenSpec 而非本包，卸载本包不构成删除理由。

#### Scenario: 卸载时删除配置与角色词
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/` 存在
- **THEN** 两者均被删除，命令不输出"保留配置"类警告

#### Scenario: 配置或角色词本就不存在
- **WHEN** 用户运行 `lycx uninstall`，`~/.codex/lyx/config.toml` 或 `~/.codex/lyx/prompts/` 不存在
- **THEN** 命令跳过对应删除动作，不报错，汇总中如实说明"本就不存在，已跳过"

#### Scenario: 卸载 claude 宿主不动 codex 宿主
- **WHEN** 两个宿主均已安装，用户只卸载 claude 宿主
- **THEN** `~/.claude/lyx/`、`~/.claude/skills/lyx-*` 与 `~/.claude/agents/lyx-*` 被移除，而 `~/.codex/lyx/` 与 `~/.agents/skills/lyx-*` 原样保留

#### Scenario: 卸载保留 OpenSpec 自有产物
- **WHEN** 用户卸载 claude 宿主，项目中存在 OpenSpec 生成的 `.claude/commands/` 命令与 `.claude/skills/openspec-*` 技能
- **THEN** 这些 OpenSpec 产物原样保留，命令不删除、不移动、不改动其中任何文件

#### Scenario: 卸载顺序无关且可重复
- **WHEN** 用户在两个宿主间以任意顺序执行单宿主卸载，或对已卸载的宿主再次执行卸载
- **THEN** 每次只影响目标宿主，已不存在的目标路径被跳过并如实说明，不报错、不牵连另一宿主
