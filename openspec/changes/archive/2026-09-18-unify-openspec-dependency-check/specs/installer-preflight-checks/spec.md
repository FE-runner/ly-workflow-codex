## MODIFIED Requirements

### Requirement: 安装器入口执行 OpenSpec 依赖前置检查
`npx ly-workflow-codex` 默认动作（裸命令即菜单）与 `lycx init` 两个入口 SHALL 在主流程开始前执行共享的 OpenSpec 依赖前置检查。检查 SHALL 分三层：① openspec CLI 是否存在（执行 `openspec --version` 判定，超时/挂起按"已安装但异常"处理不触发重装）；② OpenSpec skills 是否按当前 workflow profile 齐备；③ OpenSpec root 是否健康（在 CLI 存在且存在 OpenSpec root 时执行 `openspec doctor --json`）。`lycx update`、`lycx uninstall` 及其余子命令 SHALL NOT 执行该检查；`lycx doctor` SHALL 复用同一检查结果模型作 OpenSpec CLI、skills 与 root 三项体检。

skills 检查 SHALL NOT 以"任一 `openspec-*` skill 存在"判定通过。检查器 SHALL 读取 `openspec config list --json` 的 workflows，将 workflow 映射为 required skill 清单（如 `explore` → `openspec-explore`、`propose` → `openspec-propose`、`apply` → `openspec-apply-change`、`sync` → `openspec-sync-specs`、`archive` → `openspec-archive-change`），并逐个解析 skill 是否可发现。扫描根 SHALL 至少覆盖 `<project>/.agents/skills`、`<project>/.codex/skills`、`~/.agents/skills`、`~/.codex/skills`；项目级命中优先于全局级命中。全部 required skill 均在项目级可发现时状态为 `project-ready`；全部 required skill 只能通过全局级命中时状态为 `global-only` 且 SHALL 输出 WARN 后继续；任一 required skill 在项目级与全局级均不可发现时状态为 `missing` 且 SHALL 输出缺失 skill 清单与建议修复命令。

`lycx init` 默认 SHALL 采用只检查、不写当前项目的策略：输出与 `@lyx-init` 一致的诊断和建议动作，但 SHALL NOT 创建 `openspec/`、SHALL NOT 自动安装项目级 skills、SHALL NOT 运行 `openspec update --force`。`lycx init --init-openspec` SHALL 作为显式逃生口，在 CLI 可用时执行项目级修复动作（root 缺失时 `openspec init --tools codex`；root 存在但 skills 为 `missing` 时 `openspec update --force`，必要时回退 `openspec init --tools codex`）并复查；`global-only` SHALL NOT 触发项目级修复。

#### Scenario: CLI 与技能齐备时静默通过
- **WHEN** 用户执行 `npx ly-workflow-codex` 或 `lycx init`，openspec CLI 存在且全部 required skills 均在项目级 `.agents/skills` 或 `.codex/skills` 中可发现，OpenSpec root 健康
- **THEN** 检查静默通过（SHALL NOT 输出任何"检查通过"类信息），安装器主流程照常进行

#### Scenario: 仅全局技能可用时 WARN
- **WHEN** 用户执行 `lycx init`，openspec CLI 存在且全部 required skills 仅能在 `~/.agents/skills` 或 `~/.codex/skills` 中可发现
- **THEN** 检查输出 `global-only` WARN，说明命令当前可用但未固化到当前项目，并给出可选固化建议；安装器主流程继续，SHALL NOT 自动运行 `openspec update --force`

#### Scenario: 必需技能缺失时输出缺失清单
- **WHEN** 用户执行 `lycx init`，openspec CLI 存在但某个 required skill（如 `openspec-explore`）在项目级与全局级扫描根中均不可发现
- **THEN** 检查输出 `missing` 状态、缺失 skill 清单与修复命令，安装器主流程继续且 SHALL NOT 自动写当前项目

#### Scenario: lycx init 默认不执行项目级修复
- **WHEN** 用户执行 `lycx init`（未传 `--init-openspec`），OpenSpec root 缺失或 skills 仅全局可用
- **THEN** 检查只输出诊断和建议动作，SHALL NOT 创建 `openspec/`、SHALL NOT 安装项目级 skills、SHALL NOT 运行 `openspec update --force`

#### Scenario: --init-openspec 执行项目级修复
- **WHEN** 用户执行 `lycx init --init-openspec`，openspec CLI 可用但 OpenSpec root 缺失
- **THEN** 检查器执行 `openspec init --tools codex`，完成后复查 CLI、skills 与 root 健康；若 root 已存在但 skills 缺失，则执行 `openspec update --force`（必要时回退 `openspec init --tools codex`）并复查；仅全局可用时不触发修复

#### Scenario: update 与 uninstall 不执行前置检查
- **WHEN** 用户执行 `lycx update` 或 `lycx uninstall`
- **THEN** 不出现任何 openspec 依赖检查行为或相关提示

### Requirement: openspec CLI 缺失时询问是否就地安装
前置检查发现 openspec CLI 不存在时，SHALL 提示该依赖缺失。交互终端下 SHALL 询问用户是否就地执行 `npm install -g @fission-ai/openspec@latest`；非交互（CI、管道、`--skip-prompt`）下跳过询问按"拒绝"口径处理。用户同意 → 执行安装；安装完成后 SHALL 复用共享检查器二次判定：复查 openspec CLI（npm 安装成功但全局 bin 不在 PATH 时说明并继续），并输出 skills/root 层结果（`project-ready` 静默、`global-only` WARN、`missing` 缺失清单、root 缺失提示运行 `@lyx-init`）。安装失败 SHALL 如实报告错误并继续安装器主流程（SHALL NOT 中断退出）。用户拒绝 → SHALL 明确列出直接依赖 openspec CLI/openspec-* skills、缺失时不可用的命令清单（`@lyx-init` `@lyx-explore` `@lyx-propose` `@lyx-review-plan` `@lyx-archive`），并说明 `@lyx-apply` 与 `@lyx-review-code` 仅依赖项目内 change 目录结构与本地 git diff、不受全局 CLI 缺失直接影响，Git 工具链照常可用，然后继续安装器主流程。两种情况下 ly-workflow-codex 自身的安装 SHALL NOT 被阻断。

#### Scenario: 用户同意就地安装且安装成功（含技能目录残留边界）
- **WHEN** 检查发现 openspec CLI 缺失，用户同意就地安装，`npm install -g @fission-ai/openspec@latest` 成功
- **THEN** 复用共享检查器二次判定：CLI 已可用；skills 按 `project-ready` / `global-only` / `missing` 输出对应状态；root 缺失时提示运行 `@lyx-init` 完成 openspec init；安装器主流程继续

#### Scenario: 非 TTY 环境跳过询问按拒绝口径继续
- **WHEN** 检查发现 openspec CLI 缺失，但当前运行环境非交互终端（CI、管道执行），无法进行确认询问
- **THEN** 跳过安装询问，按"用户拒绝"同等口径输出不可用清单提示后继续安装器主流程，SHALL NOT 挂起等待输入

#### Scenario: 就地安装失败不阻断安装器
- **WHEN** 用户同意就地安装但 npm 安装失败（网络错误、权限不足等）
- **THEN** 如实报告 npm 原始错误，按"用户拒绝"同等口径继续安装器主流程

### Requirement: CLI 在但 opsx 技能缺失时非阻断提示
前置检查发现 openspec CLI 存在但 required skills 未达到 `project-ready` 时，SHALL 按共享检查器结果输出非阻断提示，SHALL NOT 询问是否代跑 `openspec init`。`global-only` 状态 SHALL 输出 WARN，说明 skills 仅全局可用但命令可继续；`missing` 状态 SHALL 输出缺失 skill 清单、当前 required workflows 来源和修复命令。`lycx init` SHALL NOT 自动写当前项目；`lycx init --init-openspec` 与 `@lyx-init` SHALL 按各自修复策略处理，且 SHALL NOT 因 `global-only` 自动写项目。

#### Scenario: 仅全局技能可用时 WARN 不阻断
- **WHEN** openspec CLI 存在，required skills 全部只在 `~/.agents/skills` 可发现，用户执行 `lycx init`
- **THEN** 输出一次性 `global-only` WARN，说明命令可用但未固化到当前项目，安装器主流程继续，不询问、不自动代跑、不自动 `openspec update --force`

#### Scenario: 技能缺失仅提示不阻断
- **WHEN** openspec CLI 存在但 required skills 中至少一个在项目级与全局级均缺失，用户执行 `lycx init`
- **THEN** 输出缺失 skill 清单和修复命令，安装器主流程继续，不询问、不自动代跑

### Requirement: 检查失败不阻断安装器
整个前置检查流程 SHALL 永不抛错打断安装器主流程：检测函数失败（命令超时、文件读写异常、`openspec config list --json` 失败、`openspec doctor --json` 失败等）时按对应当前状态的降级口径输出提示后继续，安装器主流程照常执行。`openspec config list --json` 失败时 skills 状态 SHALL 标记为 `unknown` 并输出 WARN，SHALL NOT 以空 required 清单静默通过；`openspec doctor --json` 执行失败（非 `no_openspec_root`）时 root 状态 SHALL 标记为 `unhealthy` 或 `not-checked` 并输出 WARN/ERROR，SHALL NOT 视为通过。

#### Scenario: 检测异常时降级提示
- **WHEN** `openspec --version` 检测异常（如进程被 kill、ETIMEDOUT）、技能目录读取失败、`openspec config list --json` 失败或 `openspec doctor --json` 执行失败
- **THEN** 按"已安装但异常"、"技能未知"、`unknown` skills 或 `unhealthy`/`not-checked` root 口径输出说明，不触发重装、不抛错，安装器主流程继续
