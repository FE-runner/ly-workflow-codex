## MODIFIED Requirements

### Requirement: 每宿主 testMode 配置

每个宿主的配置文件 SHALL 在 `[host]` 节提供可选字段 `testMode`，取值 SHALL 为 `normal` 或 `off`。该字段 SHALL 作为未命中项目路径覆盖时的宿主默认值。未配置、空白或非法取值 SHALL 等价于 `normal`。配置读写链路 SHALL 保留既有 `testMode`，非交互重装或未触碰该字段的编辑 SHALL NOT 清除该值。

宿主配置文件 MAY 同时包含路径键项目覆盖表，形如 `[projects."<project-root>"]`；本项目级能力当前只识别每个条目内的可选 `testMode` 字段。项目条目取值 SHALL 为 `normal` 或 `off`。配置读写链路 SHALL 保留全部既有项目条目及其全部既有字段，非交互重装、菜单编辑或宿主默认值变更 SHALL NOT 删除或改写路径键。

有效 `testMode` SHALL 按以下顺序解析：

1. 当前项目路径对应且取值合法的项目条目 `testMode`；
2. `[host].testMode`；
3. `normal`。

项目路径 SHALL 归一到主仓库根：普通 checkout 与 separate-git-dir checkout 取 `show-toplevel`；子模块取子模块自身的 `show-toplevel`；非 bare 仓库上的 linked worktree 取主工作树根；bare repository 上的 linked worktree 因不存在主工作树根，取当前 worktree 的 `show-toplevel`；当前目录不在 Git 仓库内时，取规范化后的当前目录。匹配 SHALL 使用规范化后的绝对路径，SHALL NOT 依赖调用时的原始相对路径。

匹配项目条目缺失、项目条目内的 `testMode` 缺失/空白/非法，或项目覆盖表形态非法时，有效模式 SHALL 回退到 `[host].testMode`；非法项目覆盖形态 SHALL 由 `lycx doctor` 输出 WARN。宿主配置整体缺失、不可读或 TOML 解析失败时，SHALL 视为“测试模式未知”并在执行任何测试文件写入、测试任务生成或测试命令前停止，明确提示运行 `lycx doctor` 检查；SHALL NOT 静默按 `normal` 继续。

`normal` SHALL 保持现有测试义务；`off` SHALL 启用无测试模式。宿主默认值和项目覆盖 SHALL 分别保存在各宿主自己的配置文件中，SHALL NOT 从一个宿主的配置文件推断另一个宿主的值。

#### Scenario: 未配置默认正常测试模式
- **WHEN** 宿主配置没有 `testMode`，且没有匹配当前项目的 `[projects]` 条目
- **THEN** 工作流按 `normal` 执行，现有测试义务不变

#### Scenario: 显式关闭测试
- **WHEN** 当前宿主配置为 `testMode = "off"`，且没有匹配当前项目的覆盖条目
- **THEN** 当前宿主启动的 lyx 工作流进入无测试模式

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

交互 `lycx init` 与菜单配置入口 SHALL 继续采集宿主默认 `testMode`，既有合法值 SHALL 作为默认选中项，未配置或非法值 SHALL 默认选中 `normal`。相关提示与配置摘要 SHALL 明确该值是“未命中项目覆盖时的宿主默认值”。

`lycx doctor` SHALL 在每个宿主的配置检查中展示宿主默认 `testMode`，并在当前目录可解析项目根时展示有效 `testMode`、来源（项目覆盖 / 宿主默认 / 内置默认）与规范化项目路径。未配置或空白宿主默认 SHALL 显示 `normal`，非法非空值 SHALL 输出 WARN。项目覆盖表形态非法、匹配项目条目的 `testMode` 非法，或一个规范化路径对应互相冲突的多个原始键时，doctor SHALL 输出 WARN，且该覆盖 SHALL 不作为有效值来源。

`lycx status` SHALL 在每个宿主分组中展示当前项目有效 `testMode` 及其来源。

#### Scenario: 向导采集正常与无测试模式
- **WHEN** 用户运行交互 `lycx init` 或菜单配置
- **THEN** 命令提供宿主默认 `normal` / `off` 选项并写回所选模式，文案说明项目覆盖可优先于该默认值

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

## ADDED Requirements

### Requirement: 项目级 testMode 管理命令

lyx SHALL 提供 `lycx project test-mode normal|off` 与 `lycx project test-mode --unset`，用于管理当前项目的路径键测试模式覆盖。

命令 SHALL 按与运行时相同的规则解析规范化主仓库根路径。`--host <hosts>` SHALL 复用既有宿主参数解析；未指定时 SHALL 作用于全部已安装宿主。目标宿主的配置文件不存在时，命令 SHALL 将其报告为未安装并跳过，SHALL NOT 隐式安装宿主或创建安装配置文件。

设置时，命令 SHALL 在目标宿主配置中新增或更新 `[projects."<规范化项目根>"]` 的 `testMode`，并保留其他宿主配置、其他项目条目与同一配置中的无关字段。移除时，命令 SHALL 把目标集合定义为所有规范化后等于当前项目根的原始项目键：逐个删除这些条目中的 `testMode`；若条目删除后不再含任何字段，SHALL 删除该空条目；若条目仍含其他字段，SHALL 保留该条目与字段。没有任何规范化等价键时，移除 SHALL 作为幂等成功处理并明确报告。

命令写入任何配置前 SHALL 先完成参数、目标宿主集合、全部目标配置可读性与规范化路径冲突预校验，避免因可提前发现的错误产生部分写入。若其他原始项目键规范化后指向当前主仓库根，且与目标 `testMode` 冲突，命令 SHALL 不写任何配置并以非零状态列出全部冲突键；SHALL NOT 自动合并、删除或改写既有别名键。单宿主写入失败或多宿主后续写入失败时 SHALL 以非零退出状态如实报告已成功与失败的目标；至少覆盖无已安装目标宿主、`--host` 非法、模式参数缺失、模式与 `--unset` 同时出现、目标配置不可读、路径冲突或写入失败。

#### Scenario: 设置当前项目无测试模式
- **WHEN** 用户在项目内运行 `lycx project test-mode off`
- **THEN** 每个目标宿主配置写入当前主仓库根的 `testMode = "off"`，并报告写入的宿主与路径

#### Scenario: 在子目录设置命中主仓库根
- **WHEN** 用户在 Git 仓库子目录运行 `lycx project test-mode off`
- **THEN** 命令写入主仓库根路径键，而不是子目录路径键

#### Scenario: linked worktree 更新同一项目键
- **WHEN** 用户在 linked worktree 运行 `lycx project test-mode normal`
- **THEN** 命令更新主仓库根路径对应的同一项目条目

#### Scenario: 移除项目覆盖
- **WHEN** 用户运行 `lycx project test-mode --unset`
- **THEN** 当前项目条目的 `testMode` 被移除，后续有效值回退宿主默认

#### Scenario: 移除覆盖包含规范化别名键
- **WHEN** 当前项目覆盖只存在于非 canonical 的原始路径键，该键规范化后等于当前主仓库根
- **THEN** 命令移除该原始键的 `testMode`；条目为空时删除条目，仍含其他字段时保留字段，避免覆盖继续生效

#### Scenario: 移除不存在覆盖仍成功
- **WHEN** 当前项目没有路径键覆盖，用户运行 `lycx project test-mode --unset`
- **THEN** 命令不修改配置并报告无需移除，退出状态为成功

#### Scenario: 未安装宿主被跳过
- **WHEN** 用户未指定 `--host`，且仅一个已注册宿主有配置文件
- **THEN** 命令只修改该已安装宿主，并明确报告另一宿主未安装、未写入

#### Scenario: 非法参数不写配置
- **WHEN** 用户同时传入模式值与 `--unset`，或宿主参数非法
- **THEN** 命令不写入任何配置文件，以非零状态退出并报告原因

#### Scenario: 目标配置不可读时预校验阻止写入
- **WHEN** 任一目标宿主配置文件存在但不可读或 TOML 解析失败
- **THEN** 命令在写入任何目标前失败并报告该宿主，不产生部分配置更新

#### Scenario: 规范化路径冲突阻止写入
- **WHEN** 当前主仓库根已有多个规范化等价但原始写法不同的项目键，且取值互相冲突
- **THEN** 设置命令不写入任何目标配置，以非零状态列出冲突键并报告需要人工处理

### Requirement: 工作流使用项目有效测试模式

`@lyx-fix`、`@lyx-propose`、`@lyx-apply`、`@lyx-review-plan`、`@lyx-review-code` 与 `@lyx-archive` SHALL 使用本能力定义的有效 `testMode`，SHALL NOT 只读取 `[host].testMode` 而忽略当前项目覆盖。

无测试模式相关跳过状态 SHALL 使用 `[跳过] ...（testMode=off）`；来源为项目覆盖时 SHALL 同时标明项目来源，来源为宿主默认时 MAY 标明宿主默认。审查角色词 SHALL 使用同一有效模式抑制测试缺失类发现，同时保留核心行为、契约、错误路径、安全与数据完整性审查。

#### Scenario: fix 使用项目覆盖
- **WHEN** 宿主默认为 `normal`，当前项目覆盖为 `testMode = "off"`，用户运行 `@lyx-fix`
- **THEN** fix 不新增或修改测试文件、不运行测试命令，并继续执行 typecheck / build 等非测试验证

#### Scenario: propose 使用项目覆盖生成任务
- **WHEN** 当前项目覆盖为 `testMode = "off"`
- **THEN** `@lyx-propose` 的 tasks 不包含测试文件或测试命令任务，行为契约 spec 仍正常生成

#### Scenario: archive 使用项目覆盖
- **WHEN** 宿主默认为 `normal`，当前项目覆盖为 `testMode = "off"`，用户运行 `@lyx-archive`
- **THEN** 归档前验证跳过测试类别，仍执行项目提供的类型检查与构建，并报告项目覆盖来源

#### Scenario: 项目 normal 覆盖宿主 off
- **WHEN** 宿主默认为 `testMode = "off"`，当前项目覆盖为 `testMode = "normal"`，用户运行测试相关流程
- **THEN** 工作流按 `normal` 执行既有测试义务，SHALL NOT 沿用宿主默认的无测试模式

#### Scenario: 双宿主使用各自配置中的同一项目键
- **WHEN** Codex 与 Claude 宿主配置都包含同一规范化主仓库根条目，但取值不同
- **THEN** 各宿主工作流分别使用自身配置文件中的项目条目，不跨宿主推断
