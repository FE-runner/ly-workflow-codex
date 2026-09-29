## Why

ly-workflow-codex 目前是 codex 单宿主：14 个命令模板、角色词、配置读写与安装器都写死 Codex 的目录与宿主能力（`~/.agents/skills`、`~/.codex/lyx`、`spawn_agent`、`@lyx-*`）。用户同时在用 Claude Code，希望同一套 propose → review → apply → archive 流程在两边都能跑，但**不想把两个宿主的细节糅进共享代码**——否则每加一个宿主都要改一遍 core，且模板正文会被条件块污染。

因此本次做两件事：把安装器宿主化（core 不认识任何具体宿主），并在其上接入 Claude 宿主。Claude 侧以 main（主 agent 直接执行）为基线，subagent 作为可选增强。

## What Changes

- **新增宿主包结构**：`src/hosts/<id>/` 自包含（适配器、路径常量、配置 schema、模板、角色词）；`src/core/` 只认适配器接口与宿主注册表，不出现任何宿主名。
- **BREAKING**：配置改为**每宿主一个配置文件**——`~/.codex/lyx/config.toml`（路径不变）与新增 `~/.claude/lyx/config.toml`；`installedHosts` 字段移除，改为"该宿主的配置文件存在即已安装"；宿主配置段由 `[codexHost]` 归一为 `[host]`（旧键保留兼容读取，下次 init 重写）。
- **新增 Claude 宿主**：命令安装到 `~/.claude/skills/lyx-*/SKILL.md`，审查与 coding subagent 定义为 `~/.claude/agents/lyx-*.md`；模板中的 `@lyx-*` 在 Claude 侧由渲染期改写为 `/lyx-*`，模板正文不做条件块。
- **Claude 侧审查保留，main 为基线**：`review-plan` / `review-code` / `apply` 全部可主 agent 直接执行（复用既有 main 语义：分级产出 + Critical 清零 + 自审最多 2 轮 + 快照留痕）；subagent 路径实现为非 fork 自定义 subagent，走不通时按既有 `[回退] subagent 不可用` 口径降级。
- **`lycx init` 增加宿主选择**：默认按 `~/.codex` / `~/.claude` 探测勾选；非交互 `--skip-prompt` 按已存在的 per-host 配置文件重装同一集合，不新增必填参数。Claude 侧向导零字段（不采集 provider、不采集模型，agent 定义用 `model: inherit`），**不写 Claude 的 provider 配置**。
- **OpenSpec 集成按宿主**：技能扫描根补 `<project>/.claude/skills` 与 `~/.claude/skills`；项目级修复命令由写死的 `openspec init --tools codex` 改为按缺失宿主传 `--tools <host>`；宿主集合由 lyx 侧传入（`openspec/config.yaml` 不记录 tools，无法反推）。
- **`@lyx-init` 按宿主产出记忆文件**：Claude 宿主下额外产出导入 `AGENTS.md` 的 `CLAUDE.md`（Claude Code 仅在项目无 `CLAUDE.md` 时读 `AGENTS.md`），提交文件清单与汇总同步。
- **`uninstall` / `doctor` / `status` / `update` 改为遍历宿主**，支持单宿主卸载；卸载 SHALL NOT 触碰 OpenSpec 自有产物（`.claude/commands/opsx/`、`.claude/skills/openspec-*`）与共用 `~/.ly/worktrees/`。
- **不改动 Codex 宿主现有行为**（回归边界）；`src/index.ts` 的三个路径公开函数保留无参签名、内部默认 codex 并标注 deprecated。
- **测试改为遍历宿主**：多宿主共有的行为不变量用一组遍历注册表的断言守护（不做每宿主一份等价断言），并新增多宿主安装、按宿主配置读写与 Claude 宿主专属测试。
- **打包登记**：`package.json` 的 `files` 字段逐项列举模板与宿主包目录，本次新增的目录必须同步登记，否则发布包缺产物并静默安装失败。
- **文档同步**：`README.md`、`README.zh-CN.md`、`CLAUDE.md`、`templates/CLAUDE.md`、`workflow.md`、`AGENTS.md`；`CHANGELOG.md` 按仓库既有约定留到发版。

## Capabilities

### New Capabilities

- `multi-host-install`: 宿主包结构、宿主注册表、每宿主配置文件、宿主选择安装与单宿主卸载、遍历宿主的 init/doctor/status/update，以及跨宿主不变量（由测试遍历宿主断言）。
- `claude-host`: Claude 宿主的产物布局与命令前缀渲染、审查/coding subagent 定义、main 基线语义、subagent 可选路径与三项偏差（交互模式非同轮阻塞、effort 安装期静态、模型取值域）、`@lyx-init` 的记忆文件产出、不写宿主 provider 配置、不碰 OpenSpec 自有产物。

### Modified Capabilities

- `installer-preflight-checks`: skills 扫描根按宿主展开，项目级修复命令由固定 `--tools codex` 改为按宿主传入。
- `lyx-uninstall-cleanup`: 卸载范围按宿主界定（含 `~/.claude/lyx/`、`~/.claude/skills/lyx-*`、`~/.claude/agents/lyx-*`），并明确 SHALL NOT 删除 OpenSpec 自有产物。
- `ly-lifecycle-commands`: `/ly:init` 的 OpenSpec 修复命令按宿主，Claude 宿主下额外产出 `CLAUDE.md`。
- `subagent-agent-config`: 配置载体由 `[codexHost]` 节改为每宿主文件的 `[host]` 节；子代理模型/推理档在 Claude 侧经 agent 定义落实（`model` / `effort`），回退语义保持。
- `ly-review-gates`: 配置路径与角色词来源按宿主（Codex 走 ROLE_FILE 角色词，Claude 走 agent 定义的 system prompt）。
- `ly-propose-flow`: apply 子代理模型字段引用由 `codexHost.codingModel` 改为宿主作用域配置字段。

## Impact

- **代码**：`src/core/*`（installer / installer-template / config / preflight 的宿主化）、新增 `src/hosts/{codex,claude}/*` 与宿主注册表、`src/commands/{init,doctor,menu,update}.ts`、`src/types/*`、`src/index.ts`、`src/i18n/index.ts`。
- **模板**：`templates/` 重组为共享正文 + 宿主包；`review-plan.md` / `review-code.md` / `apply.md` / `propose.md` 四个文件含宿主分歧段落（共 20 处）需隔离；14 个文件含 `@lyx-*` 交叉引用（渲染期改写，不动正文）。
- **配置**：每宿主配置文件；`[codexHost]` → `[host]` 兼容读取与重写；`installedHosts` 移除。
- **打包**：`package.json` 的 `files` 字段现仅列 `templates/prompts/codex/` 与 `templates/skills-codex/`，新增模板目录必须同步登记，否则发布包缺模板并静默安装失败。
- **文档**：`README.md`、`README.zh-CN.md`、`CLAUDE.md`、`templates/CLAUDE.md`、`workflow.md`、`AGENTS.md`。
- **测试**：宿主不变量断言改为遍历宿主；新增多宿主安装、per-host 配置、Claude 渲染与 preflight 扫描根测试。
- **兼容性**：Codex 宿主行为不变；老配置兼容读取（含 `[codexHost]` 与 `installedHosts`）；新增宿主不影响单宿主用户。
- **已知覆盖差（记录不实现）**：原 Claude 侧 `code-tester`（补测试）与 `code-doc-writer`（跟随 diff 同步文档）在 lyx 流程中没有等价物，测试与文档同步依赖 change 的 `tasks.md` 显式声明。
