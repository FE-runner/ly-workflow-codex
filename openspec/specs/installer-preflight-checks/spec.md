## Purpose

让安装器在入口处检测 OpenSpec 依赖（openspec CLI + openspec-* skills），把"装了 ly-workflow-codex 但 OpenSpec 生命周期命令不可用"的发现时机从第一次命令调用前移到安装期，并为 `lycx doctor` 提供体检项。

codex 单宿主下，技能存在性判定检测用户级 `~/.agents/skills/` 与项目 `.agents/skills/` 下的 `openspec-*` skill（`openspec-explore`/`openspec-propose`/`openspec-apply-change`/`openspec-archive-change` 任一存在 `SKILL.md` 即可，即已跑过 `openspec init`）。

## Requirements

### Requirement: 安装器入口执行 OpenSpec 依赖前置检查
`npx ly-workflow-codex` 默认动作（裸命令即菜单）与 `lycx init` 两个入口 SHALL 在主流程开始前执行共享的 OpenSpec 依赖前置检查。检查 SHALL 分两级：① openspec CLI 是否存在（执行 `openspec --version` 判定，超时/挂起按"已安装但异常"处理不触发重装）；② openspec-* skills 是否已初始化（`~/.agents/skills/` 或项目 `.agents/skills/` 下存在 `openspec-explore`/`openspec-propose`/`openspec-apply-change`/`openspec-archive-change` 任一 `SKILL.md`）。`lycx update`、`lycx uninstall` 及其余子命令 SHALL NOT 执行该检查；`lycx doctor` SHALL 复用同一检测函数作 OpenSpec CLI 与 OpenSpec skills 两项体检。

#### Scenario: CLI 与技能齐备时静默通过
- **WHEN** 用户执行 `npx ly-workflow-codex`，openspec CLI 存在且 `~/.agents/skills/` 或项目 `.agents/skills/` 下已有 openspec-* skills
- **THEN** 检查静默通过（SHALL NOT 输出任何"检查通过"类信息），安装器主流程照常进行

#### Scenario: update 与 uninstall 不执行前置检查
- **WHEN** 用户执行 `lycx update` 或 `lycx uninstall`
- **THEN** 不出现任何 openspec 依赖检查行为或相关提示

### Requirement: openspec CLI 缺失时询问是否就地安装
前置检查发现 openspec CLI 不存在时，SHALL 提示该依赖缺失。交互终端下 SHALL 询问用户是否就地执行 `npm install -g @fission-ai/openspec@latest`；非交互（CI、管道、`--skip-prompt`）下跳过询问按"拒绝"口径处理。用户同意 → 执行安装；安装完成后 SHALL 二次判定：复查 openspec CLI（npm 安装成功但全局 bin 不在 PATH 时说明并继续），并复用技能检测判定 openspec-* skills——已存在（CLI 缺失但技能残留的场景）提示"openspec 已可用"，否则提示"运行 @lyx-init 完成 openspec init 后 OpenSpec 生命周期命令可用"。安装失败 SHALL 如实报告错误并继续安装器主流程（SHALL NOT 中断退出）。用户拒绝 → SHALL 明确列出直接依赖 openspec CLI/openspec-* skills、缺失时不可用的命令清单（`@lyx-init` `@lyx-explore` `@lyx-propose` `@lyx-review-plan` `@lyx-archive`），并说明 `@lyx-apply` 与 `@lyx-review-code` 仅依赖项目内 change 目录结构与本地 git diff、不受全局 CLI 缺失直接影响，Git 工具链照常可用，然后继续安装器主流程。两种情况下 ly-workflow-codex 自身的安装 SHALL NOT 被阻断。

#### Scenario: 用户同意就地安装且安装成功（含技能目录残留边界）
- **WHEN** 检查发现 openspec CLI 缺失，用户同意就地安装，`npm install -g @fission-ai/openspec@latest` 成功
- **THEN** 复用技能检测函数二次判定：openspec-* skills 已存在（曾装过 openspec 后卸载 CLI 的残留场景）则提示"openspec 已可用"；否则提示"运行 @lyx-init 完成 openspec init 后 OpenSpec 生命周期命令可用"，安装器主流程继续

#### Scenario: 非 TTY 环境跳过询问按拒绝口径继续
- **WHEN** 检查发现 openspec CLI 缺失，但当前运行环境非交互终端（CI、管道执行），无法进行确认询问
- **THEN** 跳过安装询问，按"用户拒绝"同等口径输出不可用清单提示后继续安装器主流程，SHALL NOT 挂起等待输入

#### Scenario: 就地安装失败不阻断安装器
- **WHEN** 用户同意就地安装但 npm 安装失败（网络错误、权限不足等）
- **THEN** 如实报告 npm 原始错误，按"用户拒绝"同等口径继续安装器主流程

### Requirement: CLI 在但 opsx 技能缺失时非阻断提示
前置检查发现 openspec CLI 存在但 `~/.agents/skills/` 与项目 `.agents/skills/` 下均无任何 openspec-* skills 时，SHALL 输出一次性非阻断提示："codex 宿主缺少 openspec-* skills——运行 `openspec init` 安装到 `~/.agents/skills/` 或项目 `.agents/skills/`"，SHALL NOT 询问、SHALL NOT 阻断、SHALL NOT 自动代跑 `openspec init`。

#### Scenario: 技能缺失仅提示不阻断
- **WHEN** openspec CLI 存在但用户尚未跑过 `openspec init`，执行 `lycx init`
- **THEN** 输出一次性提示说明运行 `@lyx-init` 初始化后 OpenSpec 生命周期命令可用，安装器主流程继续，不询问、不自动代跑

### Requirement: 检查失败不阻断安装器
整个前置检查流程 SHALL 永不抛错打断安装器主流程：检测函数失败（命令超时、文件读写异常等）时按对应当前状态的降级口径输出提示后继续，安装器主流程照常执行。

#### Scenario: 检测异常时降级提示
- **WHEN** `openspec --version` 检测异常（如进程被 kill、ETIMEDOUT）或技能目录读取失败
- **THEN** 按"已安装但异常"或"技能未知"口径输出说明，不触发重装、不抛错，安装器主流程继续
