# context.md — add-claude-host

软上下文（文档之外的讨论结论）。行为契约见 delta specs；技术决策与备选理由见 `design.md`，本文件不重复。

## 用户确认结论

- 目标：让同一套 propose → review → apply → archive 流程在 Claude Code 也能跑；**架构上不能耦合太深**——这是本次拆宿主包的动机，不是附带好处。
- 迭代节奏：**先简单点**——Claude 侧以 main（主 agent 直接执行）为基线，**review 能力保留**；子代理"走得通就一并实现"，走不通按既有 `[回退] subagent 不可用` 降级。
- 隔离方式 = 留在当前分支（main 上开发，见 `.openspec.yaml` 的 `isolation: none`；原定 worktree 已改）；流程 = 全自动（propose → review-plan → apply → review-code）。
- 配置形态经讨论选定**方案 C：每宿主一个配置文件**（而非单配置多节、也非共享 state 文件）。
- 宿主配置节按推荐归一；`src/index.ts` 三个公开路径函数按推荐保留无参签名并标 deprecated。
- **文档一并修改是显式要求**；`AGENTS.md` 破"发版才同步"的惯例在本 change 内一并更新（`CHANGELOG.md` 仍留发版）。

## 已完成的前置动作（不在本 change 范围内）

- `~/.claude/agents/` 下 5 个 agent（`code-doc-writer`、`code-implementer`、`code-planner`、`code-reviewer`、`code-tester`）已由用户确认并移出至 `~/.claude/.agents-removed-20260929/`（保留可回滚）。动机是命名冲突与宿主子代理描述总量。
- 该动作属用户侧配置变更，**不随本 change 提交**，也不在本 change 的 spec 范围内；此处仅记录，以便解释为什么本 change 不再需要避让既有 agent 命名。

## 已知覆盖差（记录，不实现）

- 被移除的 `code-tester`（实施后补测试）与 `code-doc-writer`（跟随 diff 同步文档）在 lyx 的流程里**没有等价物**：测试与文档同步依赖各 change 的 `tasks.md` 显式声明。移除上述 agent 后这层隐式保障消失，本 change 只如实记录，不新增等价命令。

## 实施注意

- Claude 宿主子代理默认以后台方式运行，"同轮等待"不能照搬；等待语义按宿主如实表述（见 `ly-review-gates` 的宿主条款）。
- Claude 侧实施子代理**禁止 worktree 隔离**，否则改动离开主检出，破坏"改动回传主会话统一提交"的契约。
- `openspec` 侧的宿主只能由 lyx 传入：其 `config.yaml` 不记录 tools（实测），宿主集合取自各宿主配置文件是否存在。
- spec 正文里的 `@lyx-<command>` 一律视为**命令标识**，不因某宿主用不同前缀而改写既有引用（约定归属 `multi-host-install`）。
- Claude 向导保留执行者二连（main / subagent），只不采集 provider、模型与推理档；子代理定义始终安装（`model: inherit`），执行者只决定是否使用。
- 模板中的 `@openspec-<skill>` 委托引用在 Claude 侧改写为 skill 调用（`openspec-<skill>`），不用 `/opsx:*` 命令——preflight 只检查 skill。
- 依赖 Claude 宿主路径 `~/.claude/lyx/` 与既有其它项目目录不冲突（已确认该路径当前不存在）。

## 受影响文件（实施范围）

见 `tasks.md` 分组；change 内不重复列清单。

## 实施决策（apply 阶段回写）

- 模板物理布局：共享正文 `templates/skills/`，宿主差异在 `templates/hosts/<id>/fragments/<命令>/<片段>.md`，正文以 `{{HOST_FRAGMENT:<片段>}}` 占位；另有 `{{LYX_CONFIG_FILE}}` / `{{HOST_ID}}` 两个宿主变量。片段缺失时安装抛错，不静默留空；两宿主片段集合由测试断言一致。
- codex 产物相对改造前的**有意差异**（其余逐字一致，已对比基线验证）：`[codexHost]` → `[host]`（配置节归一的直接结果）；changelog / release 的"告诉 Codex"→"告诉助手"；`@lyx-init` 的 ensure 命令带 `--host codex`（按当前宿主补齐，不牵连另一宿主）。
- 方案遗漏、已补：`propose.md` 兜底续接命令写死 `codex "…"`，已抽为宿主片段（claude 侧为 `claude "…"`）。
- Claude 侧改写：`@lyx-` → `/lyx-`；`@openspec-<skill>` → `openspec-<skill>`（不改为 `/opsx:*`）；各模板"调用方式"说明行改写为 slash 语法并注明 openspec skill 经 Skill 工具调用。
- Claude 子代理定义正文取自 codex 角色词（清单与输出格式照搬），去掉 "Codex Role" 标题，READ-ONLY sandbox 换为"只读 + Bash 仅限只读 git/openspec"，`WORKDIR` 改为仓库根目录。frontmatter 的 `tools` 不能按子命令硬限制，约束落在正文。
- codex 专属的 `codex-provider.ts` / `legacy-cleanup.ts` 随宿主包迁入 `src/hosts/codex/`（留在 `src/utils` 会违反"共享层不出现宿主路径"）；codex 专属卸载逻辑（旧 `ly-*` 残留、`prompts/codex/`、legacy cleanup）迁入适配器新增的 `uninstallExtras` 钩子。
- `installWorkflows` / `uninstallWorkflows` 的测试注入参数改为 `hostPaths: { <host>: {...} }`（原 `promptsDir` / `codexSkillsDir` / `lyPromptsDir` / `lyDir` 移除）；公开 API `LyConfig.codexHost` → `LyConfig.host`、`installedHosts` 移除（proposal 已标 BREAKING），`mergeCodexHostConfig` / `sanitizeCodexHostExtras` 保留为 deprecated 别名。
- `lycx init --init-openspec` 的写入型修复从前置检查挪到宿主确认之后执行（只针对所选宿主）；ensure 的补齐顺序改为先 `openspec init --tools <缺失宿主>`、仍缺再 `openspec update --force`（与 spec 表述一致）。
- 测试稳定性：preflight 测试 mock 了 `listInstalledHosts`，不再受本机真实安装状态影响；模板断言改为先经宿主渲染（`src/test-utils/render.ts`）再断言。
- 运维命令：体检项 / 偏差检测 / update 备份清单由适配器提供（`doctorChecks` / `definitionDrift` / `backupList`），命令层只遍历宿主；codex 的子代理模型体检（`assessSubagentModelConfig`）迁入 `src/hosts/codex/doctor.ts`，`commands/doctor.ts` 保留再导出。
- update 按宿主决策：版本落后 → 整体重装（`init --force --skip-prompt --host <宿主>`）；版本一致但子代理定义与配置偏差 → 本地按当前配置重渲染、不联网；否则跳过。`init` 新增 `--host`（非交互时限定宿主，交互时作默认勾选）。
- uninstall 未指定宿主且一个都没安装时回退兜底宿主（codex），以保留"清理旧版本残留"的改造前行为。
- 注册表改为惰性求值（getter / 函数）：宿主包 → 共享配置读写 → 注册表存在模块循环，模块求值期直接取值会拿到未初始化的适配器。
- lint：仓库基线本就有 72 个 eslint 错误（改造前 HEAD 实测），本 change 只保证改动过的 `src/` 文件 lint 干净；`package.json` 的 `files` 排序告警为既存问题，未处理。
