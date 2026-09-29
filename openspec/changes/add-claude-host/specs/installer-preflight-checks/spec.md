## MODIFIED Requirements

### Requirement: 安装器入口执行 OpenSpec 依赖前置检查
`npx ly-workflow-codex` 默认动作（裸命令即菜单）与 `lycx init` 两个入口 SHALL 在主流程开始前执行共享的 OpenSpec 依赖前置检查。检查 SHALL 分三层：① openspec CLI 是否存在（执行 `openspec --version` 判定，超时/挂起按"已安装但异常"处理不触发重装）；② OpenSpec skills 是否按当前 workflow profile 齐备；③ OpenSpec root 是否健康（在 CLI 存在且存在 OpenSpec root 时执行 `openspec doctor --json`）。`lycx update`、`lycx uninstall` 及其余子命令 SHALL NOT 执行该检查；`lycx doctor` SHALL 复用同一检查结果模型作 OpenSpec CLI、skills 与 root 三项体检。

skills 检查 SHALL NOT 以"任一 `openspec-*` skill 存在"判定通过。检查器 SHALL 读取 `openspec config list --json` 的 workflows，将 workflow 映射为 required skill 清单（如 `explore` → `openspec-explore`、`propose` → `openspec-propose`、`apply` → `openspec-apply-change`、`sync` → `openspec-sync-specs`、`archive` → `openspec-archive-change`），并逐个解析 skill 是否可发现。

**扫描根按宿主展开（自本 change 起）**：扫描根 SHALL 覆盖已安装宿主的全部技能位置——codex 宿主为 `<project>/.agents/skills`、`<project>/.codex/skills`、`~/.agents/skills`、`~/.codex/skills`；claude 宿主为 `<project>/.claude/skills`、`~/.claude/skills`。已安装宿主集合 SHALL 由本包各宿主配置文件的存在情况判定（见 `multi-host-install`），SHALL NOT 写死为单一宿主。项目级命中优先于全局级命中。全部 required skill 均在项目级可发现时状态为 `project-ready`；全部 required skill 只能通过全局级命中时状态为 `global-only` 且 SHALL 输出 WARN 后继续；任一 required skill 在项目级与全局级均不可发现时状态为 `missing` 且 SHALL 输出缺失 skill 清单与建议修复命令。仅某一宿主缺少对应技能根时 SHALL NOT 被误判为 `missing`——判定 SHALL 以该宿主实际使用的技能位置为准。

**多宿主结论汇总（自本 change 起）**：宿主集合含多个宿主时，skills 层 SHALL 对每个宿主分别判定并按宿主分行输出各自状态；整体状态 SHALL 取各宿主中最差者（`missing` > `global-only` > `project-ready`）。缺失清单与建议修复命令 SHALL 只针对判定为 `missing` 的宿主，`global-only` 的 WARN 同样按宿主标注；SHALL NOT 因某一宿主就绪而掩盖另一宿主的缺失。

**本能力其他 Requirement 的技能根按宿主解读（自本 change 起）**：本能力其余 Requirement 正文与其 Scenario 中出现的具体技能根路径（`<project>/.agents/skills`、`<project>/.codex/skills`、`~/.agents/skills`、`~/.codex/skills`）SHALL 按上述宿主展开规则解读——在 claude 宿主场景下对应 `<project>/.claude/skills` 与 `~/.claude/skills`。这些 Requirement 描述的分层检查、状态口径、非阻断提示与降级行为本身 SHALL 保持不变。

**宿主集合为空时的处理（自本 change 起）**：本检查在主流程之前执行，此时可能尚不存在任何宿主配置文件。不存在任何宿主配置文件时，读取型检查（技能与 root 的扫描判定）的宿主集合 SHALL 按 `multi-host-install` 的"无配置文件时的宿主集合"语义取全部已注册宿主，SHALL NOT 因集合为空而跳过技能层检查、报告 `missing`，或让修复目标落空。

**写入型修复不得超出已确认的宿主（自本 change 起）**：项目级写入型修复（`--init-openspec` / 项目初始化命令）SHALL 以"已安装宿主集合"为目标，SHALL NOT 为尚未确认选择的宿主写入项目级产物。不存在任何宿主配置文件时，该类命令 SHALL NOT 执行项目级写入型修复，只输出只读诊断与建议；写入型修复 SHALL 延后到宿主选择确认（宿主配置文件已产生）之后执行。多宿主目标 SHALL 以宿主映射后的 `--tools` 取值表达（逗号分隔一次调用，或按宿主逐次调用），两种形式择一并在报告中如实呈现实际执行的命令。

`lycx init` 默认 SHALL 采用只检查、不写当前项目的策略：输出与 `@lyx-init` 一致的诊断和建议动作，但 SHALL NOT 创建 `openspec/`、SHALL NOT 自动安装项目级 skills、SHALL NOT 运行 `openspec update --force`。`lycx init --init-openspec` SHALL 作为显式逃生口，在 CLI 可用时执行项目级修复动作：root 缺失时执行 `openspec init --tools <已安装宿主集合>`；root 存在但 skills 为 `missing` 时执行 `openspec init --tools <缺失技能的宿主>` 补齐该宿主目标（必要时以 `openspec update --force` 刷新），并复查。修复命令的 `--tools` 取值 SHALL 按宿主映射（codex 宿主对应 `codex`，claude 宿主对应 `claude`），SHALL NOT 固定为单一宿主。`global-only` SHALL NOT 触发项目级修复。

#### Scenario: CLI 与技能齐备时静默通过
- **WHEN** 用户执行 `npx ly-workflow-codex` 或 `lycx init`，openspec CLI 存在且全部 required skills 均在已安装宿主对应的项目级技能根中可发现，OpenSpec root 健康
- **THEN** 检查静默通过（SHALL NOT 输出任何"检查通过"类信息），安装器主流程照常进行

#### Scenario: 仅全局技能可用时 WARN
- **WHEN** 用户执行 `lycx init`，openspec CLI 存在且全部 required skills 仅能在已安装宿主对应的全局技能根中可发现
- **THEN** 检查输出 `global-only` WARN，说明命令当前可用但未固化到当前项目，并给出可选固化建议；安装器主流程继续，SHALL NOT 自动运行 `openspec update --force`

#### Scenario: 必需技能缺失时输出缺失清单
- **WHEN** 用户执行 `lycx init`，openspec CLI 存在但某个 required skill（如 `openspec-explore`）在项目级与全局级扫描根中均不可发现
- **THEN** 检查输出 `missing` 状态、缺失 skill 清单与修复命令，安装器主流程继续且 SHALL NOT 自动写当前项目

#### Scenario: lycx init 默认不执行项目级修复
- **WHEN** 用户执行 `lycx init`（未传 `--init-openspec`），OpenSpec root 缺失或 skills 仅全局可用
- **THEN** 检查只输出诊断和建议动作，SHALL NOT 创建 `openspec/`、SHALL NOT 安装项目级 skills、SHALL NOT 运行 `openspec update --force`

#### Scenario: --init-openspec 执行项目级修复
- **WHEN** 用户执行 `lycx init --init-openspec`，openspec CLI 可用但 OpenSpec root 缺失
- **THEN** 检查器执行 `openspec init --tools <已安装宿主集合>`，完成后复查 CLI、skills 与 root 健康；若 root 已存在但某已安装宿主的 skills 缺失，则针对该宿主执行 `openspec init --tools <该宿主>` 补齐并复查；仅全局可用时不触发修复

#### Scenario: 仅 claude 宿主已安装时使用 claude 技能根
- **WHEN** 磁盘上只有 claude 宿主的配置文件，用户执行前置检查，`.claude/skills` 下技能齐备
- **THEN** 检查按 claude 宿主技能根判定为 `project-ready` 或 `global-only`，SHALL NOT 因缺少 codex 侧技能根而报告 `missing`

#### Scenario: 多宿主结论不一致时按宿主分行并取最差
- **WHEN** 两个宿主均已安装，codex 宿主的 required skills 全部项目级可发现，claude 宿主的某个 required skill 在项目级与全局级均不可发现
- **THEN** 输出按宿主分行（codex `project-ready`、claude `missing`），整体状态为 `missing`；缺失清单与修复命令只针对 claude 宿主

#### Scenario: 全新环境首次初始化
- **WHEN** 磁盘上不存在任何宿主配置文件，用户首次执行 `lycx init` 或 `lycx init --init-openspec`
- **THEN** 只读检查的宿主集合取全部已注册宿主，技能层按全部宿主的技能根扫描；`--init-openspec` SHALL NOT 在该时点为任何宿主写入项目级产物，只输出诊断与建议，写入型修复留到宿主选择确认之后，SHALL NOT 因集合为空而跳过检查

#### Scenario: 写入型修复不超出已确认宿主
- **WHEN** 磁盘上只有 codex 宿主的配置文件，用户执行 `lycx init --init-openspec`
- **THEN** 项目级修复只针对 codex 宿主执行，SHALL NOT 为未安装的 claude 宿主写入项目级 OpenSpec 技能或命令产物

#### Scenario: update 与 uninstall 不执行前置检查
- **WHEN** 用户执行 `lycx update` 或 `lycx uninstall`
- **THEN** 不出现任何 openspec 依赖检查行为或相关提示
