## MODIFIED Requirements

### Requirement: 每宿主 testMode 配置

每个宿主的配置文件 SHALL 在 `[host]` 节提供可选字段 `testMode`，取值 SHALL 为 `normal`、`off` 或 `ask`。该字段 SHALL 作为未命中项目路径覆盖时的宿主默认值。未配置、空白或非法取值 SHALL 等价于 `normal`。配置读写链路 SHALL 保留既有 `testMode`，非交互重装或未触碰该字段的编辑 SHALL NOT 清除该值。

宿主配置文件 MAY 同时包含路径键项目覆盖表，形如 `[projects."<project-root>"]`；本项目级能力当前只识别每个条目内的可选 `testMode` 字段。项目条目取值 SHALL 为 `normal`、`off` 或 `ask`。配置读写链路 SHALL 保留全部既有项目条目及其全部既有字段，非交互重装、菜单编辑或宿主默认值变更 SHALL NOT 删除或改写路径键。

有效配置 `testMode` SHALL 按以下顺序解析：

1. 当前项目路径对应且取值合法的项目条目 `testMode`；
2. `[host].testMode`；
3. `normal`。

项目路径 SHALL 归一到主仓库根：普通 checkout 与 separate-git-dir checkout 取 `show-toplevel`；子模块取子模块自身的 `show-toplevel`；非 bare 仓库上的 linked worktree 在可确定主工作树时取主工作树根；bare repository 上的 linked worktree，或 separate-git-dir 布局无法从 linked worktree 反推主 checkout 时，取当前 worktree 的 `show-toplevel`；当前目录不在 Git 仓库内时，取规范化后的当前目录。匹配 SHALL 使用规范化后的绝对路径，SHALL NOT 依赖调用时的原始相对路径。

匹配项目条目缺失、项目条目内的 `testMode` 缺失/空白/非法，或项目覆盖表形态非法时，有效配置 SHALL 回退到 `[host].testMode`；非法项目覆盖形态 SHALL 由 `lycx doctor` 输出 WARN。宿主配置整体缺失、不可读或 TOML 解析失败时，SHALL 视为“测试模式未知”并在执行任何测试文件写入、测试任务生成或测试命令前停止，明确提示运行 `lycx doctor` 检查；SHALL NOT 静默按 `normal` 继续。

`normal` SHALL 保持现有测试义务；`off` SHALL 启用无测试模式；`ask` SHALL 要求 change 级命令在首次需要测试决策时询问一次并持久化选择。宿主默认值和项目覆盖 SHALL 分别保存在各宿主自己的配置文件中，SHALL NOT 从一个宿主的配置文件推断另一个宿主的值。

#### Scenario: 未配置默认正常测试模式
- **WHEN** 宿主配置没有 `testMode`，且没有匹配当前项目的 `[projects]` 条目
- **THEN** 工作流按 `normal` 执行，现有测试义务不变

#### Scenario: 显式关闭测试
- **WHEN** 当前宿主配置为 `testMode = "off"`，且没有匹配当前项目的覆盖条目
- **THEN** 当前宿主启动的 lyx 工作流进入无测试模式

#### Scenario: 显式启用询问模式
- **WHEN** 当前宿主配置为 `testMode = "ask"`，且没有匹配当前项目的覆盖条目
- **THEN** change 级命令在首次需要测试决策时询问用户

#### Scenario: 非法值按正常模式处理并告警
- **WHEN** 宿主默认 `testMode` 为非空非法字符串，且没有匹配当前项目的覆盖条目
- **THEN** 运行时按 `normal` 处理，`lycx doctor` 输出 WARN

#### Scenario: 配置不可读时停止而不是默认运行测试
- **WHEN** 当前宿主配置文件缺失、不可读或 TOML 解析失败
- **THEN** 工作流在测试相关动作前停止并提示运行 `lycx doctor`，不得静默按 `normal` 执行

#### Scenario: 项目路径覆盖宿主默认
- **WHEN** `[host].testMode = "normal"`，且当前主仓库根对应项目条目为 `testMode = "off"`
- **THEN** 有效测试模式为 `off`

#### Scenario: 项目正常模式覆盖宿主无测试模式
- **WHEN** `[host].testMode = "off"`，且当前主仓库根对应项目条目为 `testMode = "normal"`
- **THEN** 有效测试模式为 `normal`，测试义务按既有风险策略恢复

#### Scenario: 子目录归一到主仓库根
- **WHEN** 用户在 Git 仓库的子目录运行 lyx 工作流，命中条目仅以该仓库主根路径为键
- **THEN** 该条目被作为当前项目覆盖生效

#### Scenario: linked worktree 与主仓库共享配置
- **WHEN** 用户在 linked worktree 内运行 lyx 工作流，主仓库根存在匹配项目条目
- **THEN** 当前 worktree 使用主仓库根的同一项目条目，不需要为 worktree 路径单独配置

#### Scenario: 子模块使用自身仓库根
- **WHEN** 用户在 Git 子模块内运行 lyx 工作流
- **THEN** 项目键使用子模块自身的 `show-toplevel`，不归并到 superproject

#### Scenario: bare 仓库 worktree 使用自身路径
- **WHEN** 用户位于 bare repository 的 linked worktree 内
- **THEN** 项目键使用当前 worktree 的 `show-toplevel`，因为该仓库不存在可共享的主工作树根

#### Scenario: separate-git-dir 主树无法反推时使用当前 worktree
- **WHEN** 主 checkout 使用 separate-git-dir，且 linked worktree 无法从 Git metadata 确定主工作树路径
- **THEN** 项目键使用当前 worktree 的 `show-toplevel`，不得猜成 common git dir 的父目录

#### Scenario: 项目条目缺失时回退宿主默认
- **WHEN** 当前主仓库根没有对应 `[projects]` 条目，且 `[host].testMode = "off"`
- **THEN** 有效测试模式回退为 `off`

#### Scenario: 项目条目非法时回退宿主默认并告警
- **WHEN** 匹配项目条目的 `testMode` 为空白或非法值，且 `[host].testMode = "off"`
- **THEN** 有效测试模式回退为 `off`，`lycx doctor` 输出项目覆盖非法的 WARN

#### Scenario: 重装保留项目覆盖条目
- **WHEN** 配置中已存在多个 `[projects]` 条目，用户运行 `lycx update` 或编辑宿主默认字段
- **THEN** 全部项目条目原样保留，不因非交互重装或未触碰项目字段的编辑而丢失

#### Scenario: 重装遇到不可读配置不覆盖
- **WHEN** 任一所选宿主的配置文件存在但不可读或 TOML 解析失败，用户运行 `lycx init` 或 `lycx update`
- **THEN** 命令在写入任何宿主配置前停止，报告全部不可读配置路径并提示运行 `lycx doctor`，不得以默认配置覆盖既有项目表或未知字段

### Requirement: testMode 的采集与展示

交互 `lycx init` 与菜单配置入口 SHALL 继续采集宿主默认 `testMode`，候选 SHALL 为 `normal` / `off` / `ask`，既有合法值 SHALL 作为默认选中项，未配置或非法值 SHALL 默认选中 `normal`。相关提示与配置摘要 SHALL 明确该值是“未命中项目覆盖时的宿主默认值”，并说明 `ask` 会在每个 change 首次需要测试决策时询问。

`lycx doctor` SHALL 在每个宿主的配置检查中展示宿主默认 `testMode`，并在当前目录可解析项目根时展示有效配置 `testMode`、来源（项目覆盖 / 宿主默认 / 内置默认）与规范化项目路径。未配置或空白宿主默认 SHALL 显示 `normal`，非法非空值 SHALL 输出 WARN。项目覆盖表形态非法、匹配项目条目的 `testMode` 非法，或一个规范化路径对应互相冲突的多个原始键时，doctor SHALL 输出 WARN，且该覆盖 SHALL 不作为有效值来源。

`lycx status` SHALL 在每个宿主分组中展示当前项目有效配置 `testMode` 及其来源。有效配置为 `ask` 时，展示文案 SHALL 明确其不是最终测试决策。

#### Scenario: 向导采集正常与无测试模式
- **WHEN** 用户运行交互 `lycx init` 或菜单配置
- **THEN** 命令提供宿主默认 `normal` / `off` / `ask` 选项并写回所选模式，文案说明项目覆盖可优先于该默认值

#### Scenario: doctor 展示无测试模式
- **WHEN** 宿主默认 `testMode = "off"`，且当前项目没有覆盖
- **THEN** `lycx doctor` 明确展示有效无测试模式及其来源为宿主默认

#### Scenario: doctor 展示项目覆盖来源
- **WHEN** 当前主仓库根对应项目条目为 `testMode = "off"`，宿主默认为 `normal`
- **THEN** `lycx doctor` 展示有效模式 `off`、来源为项目覆盖，并展示规范化项目路径

#### Scenario: status 展示有效模式
- **WHEN** 用户在当前项目运行 `lycx status`
- **THEN** 每个已安装宿主分组均展示该项目下的有效 `testMode` 与来源

#### Scenario: 项目覆盖非法时 doctor 告警
- **WHEN** 匹配项目条目的 `testMode` 为非法非空值
- **THEN** `lycx doctor` 输出 WARN 并展示实际回退后的有效值

#### Scenario: doctor 标明询问模式不是最终决策
- **WHEN** 当前项目有效配置 `testMode = "ask"`
- **THEN** `lycx doctor` 与 `status` 展示 `ask`，并说明最终测试模式由 change 级决策决定

## ADDED Requirements

### Requirement: change 级 ask 决策持久化

`effective testMode = "ask"` 时，change 级命令 SHALL 读取目标 change 的 `.openspec.yaml` 中可选字段 `lyx.testModeDecision`，取值仅允许 `normal` / `off`。

决策解析 SHALL 按以下顺序：

1. effective 配置为 `normal` / `off` 时直接使用配置，忽略 `lyx.testModeDecision`；
2. effective 配置为 `ask` 且 `lyx.testModeDecision` 为合法值时，使用该持久化决策；
3. effective 配置为 `ask` 且决策缺失或非法时，询问用户选择 `normal` / `off`，并把选择写入 `.openspec.yaml` 的 `lyx.testModeDecision`。

询问 SHALL 明确区分 `normal`（写测试、跑测试）与 `off`（不写测试、不跑测试）。用户未回答、取消或当前环境无法交互时，命令 SHALL 停止，SHALL NOT 以 `normal` / `off` 猜测继续。

写入 SHALL 保留 `.openspec.yaml` 的其他字段与 `lyx` 命名空间下的其他字段；非法旧值 SHALL 被当次选择覆盖。写入决策的命令 SHALL 把 `.openspec.yaml` 纳入其本阶段 commit 范围；即使该命令原本没有其他修改，也 SHALL 提交该元数据变更，不得留下未提交的决策修改。

`@lyx-fix` 不创建 change 元数据，因此不适用本 Requirement；其 `ask` 行为由 `lightweight-fix-flow` 定义。

#### Scenario: ask 决策在 propose 首次询问并持久化
- **WHEN** effective 配置为 `ask`，用户运行 `@lyx-propose`
- **THEN** 命令在生成 artifacts 前询问一次，并在真实 change 名确定后把选择写入 `lyx.testModeDecision`

#### Scenario: 后续命令沿用持久化决策
- **WHEN** change 的 `lyx.testModeDecision = "off"`，effective 配置仍为 `ask`
- **THEN** apply / review / archive 使用 `off`，不再重复询问

#### Scenario: 配置 normal 覆盖历史决策
- **WHEN** change 已保存 `lyx.testModeDecision = "off"`，当前 effective 配置变为 `normal`
- **THEN** 后续命令使用 `normal`，SHALL NOT 继续使用历史 `off`

#### Scenario: 配置 off 覆盖历史决策
- **WHEN** change 已保存 `lyx.testModeDecision = "normal"`，当前 effective 配置变为 `off`
- **THEN** 后续命令使用 `off`

#### Scenario: 决策缺失时补问并持久化
- **WHEN** effective 配置为 `ask`，目标 change 没有 `lyx.testModeDecision`，用户在 apply / review / archive 中选择 `off`
- **THEN** 命令写入 `lyx.testModeDecision = "off"` 并把 `.openspec.yaml` 纳入该阶段提交

#### Scenario: 非法历史决策重新询问
- **WHEN** effective 配置为 `ask`，`lyx.testModeDecision` 为非空非法值
- **THEN** 命令忽略该值、询问一次并用新选择覆盖

#### Scenario: 未获得回答时停止
- **WHEN** effective 配置为 `ask` 且决策缺失，用户取消或当前环境不能交互
- **THEN** 命令停止在测试动作前，不新增测试文件、不生成测试任务、不执行测试命令
