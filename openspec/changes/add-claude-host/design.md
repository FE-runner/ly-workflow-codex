## Context

见 `proposal.md`。现状约束（读代码得出，非推测）：

- `src/utils/host-adapters.ts` 已经定义了 `HostAdapter` 接口与 `ADAPTERS` 注册表，但注册表类型写死为 `Record<'codex', HostAdapter>`，且 `installer.ts` 两处直接取 `ADAPTERS.codex`（安装与卸载各一处），并非遍历。
- `installer.ts` 的 `installPromptFiles` 是 codex 专属逻辑，却挂在共享安装路径里无条件调用；而接口上的 `installExtras` 钩子恰好是为此预留的，当前无人使用。
- `installer-template.ts` 的 `injectConfigVariables` 内建 codex 语义（`{{REVIEWER_MODEL}}` → `codex`、`LY:IF:IMPLEMENTER_*` 折叠）。
- `package-meta.ts` 的 `LY_DIR` / `CONFIG_FILE` / `PROMPTS_DIR` / `AGENTS_SKILLS_DIR` 是单例常量，被 `config.ts` / `installer.ts` / `preflight.ts` / `doctor.ts` / `menu.ts` / `update.ts` 直接引用。
- `src/index.ts` 对外导出 `getConfigPath()` / `getLyDir()` / `getLyPromptsDir()` 三个无参函数，是公开 API 面。
- `package.json` 的 `files` 字段逐项列举模板目录（`templates/prompts/codex/`、`templates/skills-codex/`），不随目录新增自动扩展。
- 模板层宿主分歧面很小：仅 `review-plan.md` / `review-code.md` / `apply.md` / `propose.md` 四个文件含宿主专属内容（约 20 处）；`@lyx-` 交叉引用散落在 14 个文件。
- 实测（本次调查）：`openspec init --tools <claude|codex|agents|all|none>` 已支持按宿主投放——codex 落到 `.agents/skills/openspec-*` 并写 `.agents/skills/.openspec-target`，claude 落到 `.claude/skills/openspec-*` 并额外产出 `.claude/commands/opsx/*.md`；在已有 codex root 的项目里追加 `openspec init --tools claude` 可行，`openspec update --force` 保留双 target；但 `openspec/config.yaml` 不记录 tools，无法反推宿主。

## Goals / Non-Goals

**Goals:**

- 共享层（core）不出现任何具体宿主的名称与路径；新增宿主只需新增该宿主的自包含包与注册表登记。
- Codex 宿主行为与产物保持逐字不变，升级用户零迁移。
- 模板正文单源共享，宿主差异收敛到渲染阶段与少量宿主片段。
- 多宿主共有行为由一组遍历断言守护，而不是每个宿主一份等价断言。

**Non-Goals:**

- 不把 lyx 做成插件/包管理器，不引入宿主侧的插件清单或市场概念。
- 不实现 Claude 侧 Provider（模型网关）配置的采集或写入——那是宿主自有配置域。
- 不补齐原 Claude 侧 `code-tester`（补测试）与 `code-doc-writer`（跟随 diff 同步文档）的等价能力（见 proposal `Impact` 的已知覆盖差）。
- 不重写既有 spec 中所有历史措辞；仅在载体语义发生变化的范围内加"自本 change 起"条款。

## Decisions

**D1：宿主包目录 `src/hosts/<id>/` 自包含，core 只依赖接口与注册表。**
每个宿主包内含适配器实现、路径常量、配置 schema、模板与角色词/子代理定义；注册表是唯一登记处。替代方案"共享模板目录 + 内联宿主条件块"被否：那会让每个分歧模板都知道所有宿主是谁，加宿主时改动扩散到共享文件——这正是用户明确要避免的耦合。替代方案"每宿主复制一整套模板目录"也被否：14 个文件的正文立刻开始漂移，共享正文会失去单源。

**D2：模板共享正文 + 宿主片段隔离，命令前缀用渲染期改写。**
14 个模板正文共享；仅 4 个文件含宿主分歧段落，抽成宿主片段由渲染阶段注入。`@lyx-` → `/lyx-` 的前缀差异由 Claude 适配器的 `renderTemplate` 做全局改写，模板一个字不改。替代方案"模板里写 `{{LYX_CMD_PREFIX}}` 变量"也可行且更显式，但要在 14 个文件里批量改正文；渲染期改写零正文改动，成本更低，代价是这条差异对读模板的人不显式——因此把它写进宿主包 README 与设计文档留痕。

**D3：每宿主一个自包含配置文件，"已安装"由文件存在判定。**
路径：`~/.codex/lyx/config.toml`（不变）与 `~/.claude/lyx/config.toml`（新增）。`installedHosts` 字段删除，`listInstalledHosts()` 改为扫描各宿主配置文件是否存在。该设计使**部分卸载**成为天然行为（删该宿主配置与产物即可），并让 `general.version` 按宿主分别记录，`update` 可只刷新落后的宿主。替代方案"单配置 + `[codexHost]`/`[claudeHost]` 并列"被否：共享状态耦合度更高，且部分卸载要小心维护共享字段。

**D4：宿主配置节归一为不带宿主名的 `[host]`，兼容读取旧节名。**
文件本身已经表达宿主作用域，节名再带宿主名属于重复；归一后 codex 与 claude 的字段语义完全一致。迁移代价是读取时兼容历史 `[codexHost]` 节并在下次 init 重写——实现为一次解析回退，不做独立迁移命令。替代方案"沿用 `[codexHost]`/`[claudeHost]`"改动更小，但语义重复且会让"新增宿主"继续引入新节名。

**D5：宿主选择显式化，非交互复用已安装集合。**
交互 `lycx init` 增加一次多选（默认按 `~/.codex` / `~/.claude` 存在性勾选）；`--skip-prompt` 以磁盘上已存在的宿主配置文件集合为安装集合，不新增必填参数。替代方案"纯探测、不询问"被否：隐式行为在多机/CI 场景不可预期；替代方案"每宿主一个子命令（`lycx init claude`）"被否：改变既有 CLI 形态且与 `update` 的复用逻辑冲突。

**D6：Claude 侧审查以 main 为基线，子代理为可选增强。**
main 路径复用既有语义（分级产出、Critical 清零准出、自审最多 2 轮、快照留痕），不因宿主不同降级。子代理路径以非 fork 自定义子代理实现：宿主默认给非 fork 子代理全新隔离上下文，天然满足既有"非 fork"契约；跨轮复用走宿主的子代理续跑能力。模型与推理档在 Claude 侧写进子代理定义（安装期渲染），未配置时以"继承会话"为默认；这是对宿主能力差异的适配，不是行为降级。替代方案"Claude 侧只做 main、不实现子代理"被否：用户明确表示子代理走得通就可以有；替代方案"用宿主的 fork 子代理"被否：会带入父会话历史，违反既有的软上下文经 change 目录到达的契约。

**D7：Claude 侧禁止子代理 worktree 隔离。**
该宿主的子代理隔离特性会把改动写到独立 worktree，而 apply 契约要求改动留在主检出、由主会话统一提交。因此 Claude 侧实施子代理定义 SHALL NOT 启用该隔离。这是显式的边界写入，不是默认值的偶然结果。

**D8：OpenSpec 集成按宿主传递，不自行实现投放逻辑。**
扫描根按已安装宿主展开（补 `.claude/skills` 与 `~/.claude/skills`）；项目级修复改为按缺失技能的宿主执行 `openspec init --tools <宿主>`（实测可在已有 root 上追加目标，`openspec update --force` 保留双 target）。宿主集合由 lyx 侧配置文件判定后传入，因为 `openspec/config.yaml` 不记录 tools。替代方案"从 `openspec/config.yaml` 反推宿主"被实测否掉。

**D9：Claude 侧项目记忆产出 `CLAUDE.md` 导入 `AGENTS.md`。**
宿主仅在项目没有 `CLAUDE.md` 时读取 `AGENTS.md`，实测 `openspec init --tools claude` 也不产出记忆文件，所以该产出必须由 lyx 负责。产出一个薄的导入文件既保持 `AGENTS.md` 作为单源，又让该宿主实际加载到项目指令。替代方案"直接生成 `CLAUDE.md` 作为主文件"被否：会让两个宿主各有一份主文件并开始漂移。

**D10：公开 API 兼容优先。**
`src/index.ts` 的三个无参路径函数保留签名，内部默认指向 codex 宿主并标注 deprecated；新增按宿主取值的函数作为替代。替代方案"直接改成带宿主入参"被否：这是发布包的公开导出，破坏成本高于收益。

**D11：spec 边界——字段载体由 `subagent-agent-config` 拥有，引用方按宿主解读。**
执行者/模型/推理档字段的载体定义集中在 `subagent-agent-config`；`ly-review-gates` 与 `ly-propose-flow` 只在各自涉及配置读取或模型取值的要求里加"自本 change 起"的宿主作用域条款，不逐条重写其余 Requirement。替代方案"把所有提到配置路径的 Requirement 全部 MODIFIED"被否：改动面与审阅负担远超语义变化本身（多数提及只是字段名引用）。

**D12：文档同步在本次 change 内完成，`CHANGELOG.md` 例外。**
`README.md`、`README.zh-CN.md`、`CLAUDE.md`、`templates/CLAUDE.md`、`workflow.md`、`AGENTS.md` 随本 change 更新；`CHANGELOG.md` 按仓库既有约定留到 `chore(release)`。本 change 触及架构级描述，把 `AGENTS.md` 推迟到发版会让权威文档在这段时间内描述错误的单宿主形态。

## Risks / Trade-offs

- [发布包缺模板导致静默安装失败] → `package.json` 的 `files` 逐项列举模板目录，新增目录必须同步登记；把该登记列为实施任务并在测试中校验包内模板目录与实际源目录一致。
- [老配置节名兼容读取遗漏导致用户配置静默丢失] → 兼容读取是独立任务项，并配一条断言：含历史节名的配置读取后字段值与重写后值一致。
- [Claude 交互模式的后台子代理让"同轮等待"名存实亡] → 在模板与 spec 里把等待语义按宿主如实标注，禁止出现"本轮内同步等待"这类与宿主行为不符的表述；验收以报告文案为准。
- [preflight 把单宿主用户误判为 `missing`] → 扫描根按已安装宿主展开，并加"仅 claude 宿主已安装"的断言；`global-only` 仍按 WARN 继续，不阻断。
- [多宿主共有行为在两侧漂移] → 用遍历宿主的单组断言守护共有不变量；共享正文单源，宿主差异只在渲染阶段产生。
- [改动面大（core + 两个宿主包 + 6 份文档 + 多组测试）] → 任务按层次拆分，先做 core 解耦并保持 codex 行为不变（可用既有测试证明），再新增 Claude 宿主包；codex 路径的回归由既有测试与同一组断言覆盖。
- [Claude 侧子代理定义数量增加触发宿主的子代理描述总量告警] → 该宿主现有的 5 个代理已在本 change 前置动作中移除，本次只新增 lyx 前缀的少量定义，且描述保持精简。

## Migration Plan

- **Codex 宿主（升级用户）**：配置路径不变；读取时兼容历史节名与历史"已安装宿主集合"字段；下次 `lycx init` / `lycx update` 以新版节名重写。已有命令产物路径不变。
- **Claude 宿主（新用户）**：新增 `~/.claude/lyx/config.toml` 与 `~/.claude/{skills,agents}/lyx-*`；该路径与既有其它项目的目录不冲突。
- **OpenSpec 侧**：既有项目若只有 codex 技能目标，按需执行 `openspec init --tools claude` 追加；已实测不破坏既有目标。
- **回滚**：移除注册表中的 claude 登记与该宿主包即可；codex 宿主与其配置不受影响；`~/.claude/` 下本包产物可用 `lycx uninstall`（限定 claude 宿主）清理。已追加的 Claude 记忆文件为普通文本，删除无害。

## Open Questions

- 是否额外提供 `--hosts codex,claude` 命令行覆盖参数：当前设计可从配置文件推断，非必需；若后续出现"配置缺失但想预装"的场景，再加不改变本设计。
