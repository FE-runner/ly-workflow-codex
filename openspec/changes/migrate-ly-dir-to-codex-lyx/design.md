## Context

`ly-workflow-codex` 当前把私有配置/角色词/worktree 都放在 `~/.ly/`，`LY_DIR` 常量（`src/utils/package-meta.ts`）指向该路径。这个目录被历史设计为"ly-workflow（双宿主老项目）共享命名空间"——`config.ts` 里有 `migrateLegacyConfig`（把 `~/.claude/.ly/config.toml` 迁移到 `~/.ly/config.toml`）与 `hasCoexistingLegacyLyProducts`（检测 `~/.claude/.ly/` 是否仍被 ly-workflow 使用，若是则跳过迁移避免冲突），`installer.ts` 的 uninstall 逻辑因此保守保留 `config.toml` 不删。见 proposal.md 的 Why：这个"共享"假设已不成立，两个项目的配置早已分叉独立。

本次改动把 ly-workflow-codex 的私有目录从 `~/.ly/` 搬到 `~/.codex/lyx/`，`~/.ly/` 下现有文件不做任何读取/迁移，视为废弃。

## Goals / Non-Goals

**Goals:**
- `LY_DIR` 及其派生常量（`CONFIG_FILE`、`PROMPTS_DIR`）指向 `~/.codex/lyx/`。
- 移除 `migrateLegacyConfig`、`hasCoexistingLegacyLyProducts` 及其调用点、测试用例；同一批"旧路径迁移"逻辑还包括 `installer.ts` 的 `migrateLegacyPrompts`（依赖 `hasCoexistingLegacyLyProducts`，迁移目标是角色词而非配置）——一并移除，包括 `src/commands/init.ts` 的调用点、`src/index.ts` 的公开导出、`src/utils/__tests__/host-adapters.test.ts` 中对应测试。
- `lycx uninstall` 对 `~/.codex/lyx/config.toml` 与 `~/.codex/lyx/prompts/` 真正删除（不再保守保留+警告）；`~/.codex/lyx/worktrees/` 子目录按"是否存在未清理的实际 git worktree"分别处理。
- 所有写死绝对路径的角色词模板、文档、技能描述同步更新。

**Non-Goals:**
- 不做任何 `~/.ly/` → `~/.codex/lyx/` 的自动迁移/拷贝/读取（含只读探测）。`~/.ly/` 被视为无关目录，代码不再引用它。
- 不处理 ly-workflow（老项目，`~/.claude/.ly/`）自身的任何逻辑——它是独立项目，不在本仓库改动范围内。
- 不改变 `[codexHost]` 各字段本身的语义/读写行为，只改变文件所在目录。

## Decisions

### 1. 新目录路径：`~/.codex/lyx/`（而非 `~/.codex/.ly/` 或摊平进 `~/.codex/` 顶层）

- 放在 `~/.codex/` 下：明确这是 codex 单宿主专属产物，不再是"ly-workflow 系列"的中性共享地盘。
- 用 `lyx` 而非 `.ly` 作为子目录名：`lyx` 是本包对外的命令前缀（`@lyx-*` skills、`lycx` CLI 别名），复用它作目录名，语义上"这是 lyx/lycx 自己的数据"，且不产生"点目录嵌套点目录"的辨识负担。
- 不直接摊平进 `~/.codex/` 顶层：`config.toml`、`prompts/` 这两个名字与 codex 官方自己的 `~/.codex/config.toml`、`~/.codex/prompts/` 完全撞车，摊平会有真实的覆盖风险。

### 2. 不做旧值迁移，全新开始

- 用户已在探索阶段明确决定：`~/.ly/` 下的文件不删、不改、不读取。已安装用户需要在 `~/.codex/lyx/config.toml` 重新配置模型字段。
- 相应地，`migrateLegacyConfig`/`hasCoexistingLegacyLyProducts` 整体移除而不是改路径——它们存在的唯一目的就是"从旧位置读到新位置"，新设计下不再需要任何"旧位置"概念。

### 3. uninstall 真正删除，但 worktrees/ 子目录按存活 worktree 分别处理

- `~/.codex/lyx/config.toml`、`~/.codex/lyx/prompts/`：目录私有化后不存在"可能是别的工具的数据"顾虑，回归普通卸载语义——直接删除，不再警告保留。
- `~/.codex/lyx/worktrees/`：这个子目录可能包含**实际的 git worktree**（工作目录 + 未提交改动）。裸 `rm -rf` 一个仍被主仓库 `.git/worktrees/` 元数据引用的 worktree 目录会留下孤儿引用（`git worktree list` 报错、后续 `git worktree add` 用同名分支可能冲突）。因此：
  - **递归**遍历 `worktrees/` 下的目录树（不能只检测第一层子目录）：worktree 实际路径形如 `worktrees/<项目名>/<开发分支名>`，`<项目名>` 本身只是个容器目录（不是 git 仓库），且 `<开发分支名>` 可能含 `/`（如 `feature/login`），此时叶子路径是 `worktrees/<项目名>/feature/login`——只检测第一层会把容器目录 `<项目名>` 误判为"非存活 worktree"，进而错误清理掉实际存活在更深层的 worktree。递归策略：对目录树中每个候选目录，SHALL 在该目录（或其内部任一目录）下执行 `git rev-parse --git-dir` 判断——成功即视为该 worktree 存活；只要整棵树下存在至少一个有效 worktree，就判定"存在存活 worktree"（一个 worktree 根目录内部本身可能还有子目录/文件，判定不要求该命令必须在"无子目录的最深层目录"执行，只要求命中即可，降低实现对目录结构假设的依赖）。
  - 存在有效 worktree → 警告并跳过删除 `worktrees/` 整个子树，提示用户先用 `lycx worktree remove <name>` 清理。
  - `worktrees/` 为空、不存在、或递归遍历后已无任何有效 worktree → 随 `config.toml`/`prompts/` 一并删除整个 `~/.codex/lyx/` 目录。
  - 判断失败（权限问题、目录读取异常等）时保守起见按"存在有效 worktree"处理（跳过删除并警告），不冒险误删。
- **返回结果字段调整**：`UninstallResult` 接口原有的 `configTomlKept` 字段（语义"config.toml 已保守保留"）随本次改动移除——`config.toml` 现在无条件删除，继续沿用该字段名会与实际行为名实不符（字段名说"config 保留"，实际是"worktree 保留"，误导下游消费点如 `cli-setup.ts`/`menu.ts` 的提示文案）。新增 `worktreesKept: boolean` 字段专门表达"因存在存活 worktree 而保留了 `worktrees/` 子目录"，`cli-setup.ts`、`menu.ts`、对应 i18n key 均同步改用新字段/新文案。
- 这一行为变更（真正删除 + worktree 存活检测）此前完全没有 spec 覆盖（`lycx uninstall` 的删除逻辑是纯实现细节），但涉及真实的数据删除风险，本次改动为其新增 `lyx-uninstall-cleanup` capability，用 Requirement/Scenario 固化这套判定规则，避免后续修改在没有测试锚点的情况下悄悄改变删除边界。

**备选方案考虑**：
- 备选 A（全部无条件删除，包括 worktrees/）：更简单，但会静默破坏用户可能还在用的开发环境（未提交改动直接消失），风险太高，否决。
- 备选 B（继续保守保留整个目录，只是改了路径）：不满足用户"回归普通卸载语义"的决策，也和"目录已私有化"的新事实不符，否决。

### 4. 角色词模板与文档的路径替换：全量替换，不保留兼容

`templates/skills-codex/*.md`（`apply.md`/`review-code.md`/`review-plan.md`/`propose.md`/`worktree.md`）中写死的 `ROLE_FILE` 绝对路径与 worktree 路径示例、`AGENTS.md`/`README.md`/`CLAUDE.md` 中的路径引用，全部从 `~/.ly/...` 改为 `~/.codex/lyx/...`。角色词内容本身（`templates/prompts/codex/{reviewer,plan-reviewer}.md`）不含路径字面量，无需改动，仅其安装目标路径随 `LY_DIR` 常量变化。不保留任何"两个路径都认"的兼容层——`~/.ly/` 已被判定为无关目录，兼容层没有意义、反而增加维护负担。

### 5. 一并清理"共享（Shared）"语义的命名残留

`UninstallResult` 的 `removedSharedPrompts` 字段与 `installer.ts` 内部局部变量 `sharedPromptsDir`/`sharedCodexPromptsDir`，以及对应 i18n key（`removedSharedPrompts`）与文案（"共享角色词"/"Shared prompts"），沿用的是旧"ly-workflow 共享命名空间"设计下的命名——现在 `~/.codex/lyx/prompts/` 已是私有目录，继续用"共享/Shared"描述会话名不副实。借这次改动一并改名：字段改为 `removedPrompts`，i18n key 同步为 `removedPrompts`，文案去掉"共享"措辞；`installer.ts` 内部变量名改为不含"shared"字样的名称（如 `codexPromptsDir`/`codexPromptsSubDir`，具体命名由实施时决定，不是行为契约，无需锚定唯一名称）。这是纯命名清理，不改变该字段/变量所表达的实际行为（仍是"是否删除了 `prompts/codex/` 子目录"）。

## Risks / Trade-offs

- **[风险] 已安装用户升级后 review/coding 模型配置"消失"**（`reviewModel`/`codingModel`/`spawnableModels` 等仍留在旧的 `~/.ly/config.toml`，新代码读不到）→ **缓解**：这是本次变更的既定后果（proposal.md 已标注 **BREAKING**），不做静默兜底；`lycx doctor`/`lycx init` 在新位置检测到无配置时走既有"未配置回退当前会话模型"路径，不会阻断使用，只是需要用户重新填模型名。
- **[风险] uninstall 的 worktree 存活检测存在误判空间**（例如 worktree 目录存在但对应主仓库已被删除，`git rev-parse` 行为因 git 版本而异）→ **缓解**：判断失败或不确定时保守按"存在"处理（跳过删除），宁可少删不可误删；不确定场景在报告中如实说明。
- **[风险] 大量文档/模板/CLI 文案出现"路径漂移"（改了代码却漏改某处用户可见字符串或注释）**→ **缓解**：tasks.md 按文件逐条列出所有已定位的 `~/.ly` 出现位置（含代码、i18n 双语文案、模板、文档、注释），实施阶段逐项核对；完成态验证统一用任务 8.1 的扫描命令（`grep -rnE "~/\.ly([^x]|$)|\$HOME/\.ly([^x]|$)|\$\{HOME\}/\.ly([^x]|$)|migrateLegacyConfig|migrateLegacyPrompts|hasCoexistingLegacyLyProducts|共享命名空间|configTomlKept" src/ templates/ AGENTS.md README.md CLAUDE.md workflow.md`，同时覆盖 `~/.ly`、`$HOME/.ly`、`${HOME}/.ly` 三种写法——历史 `CHANGELOG.md` 与未被本次 4 个 Capability 覆盖的基线 spec 文本视为范围外例外，扫描命中时人工确认后排除，不静默忽略）。
- **[Trade-off] 不做旧值迁移意味着已安装用户有一次性的配置体验倒退**（需要重新填模型名）→ 用户已在探索阶段明确接受这个代价，换来的是彻底的解耦和更简单的代码（少了两个专门处理"共存/迁移"的函数及其测试）。
