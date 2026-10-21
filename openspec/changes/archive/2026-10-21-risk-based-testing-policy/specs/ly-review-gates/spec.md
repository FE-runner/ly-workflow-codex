## ADDED Requirements

### Requirement: 审查按测试风险策略判定测试相关发现

`/ly:review-plan` 与 `/ly:review-code` SHALL 按 `risk-based-testing-policy` 区分纯展示改动、行为或契约缺口、逻辑缺陷复现和补充边界覆盖。纯展示改动没有新增自动化测试 SHALL NOT 单独形成 Critical、Warning 或 Info。补充边界覆盖不足 SHALL 只形成 Warning 并落快照，不得触发自动补测试、不得阻塞正常清零。

核心行为未覆盖、接口或配置契约不一致、已确认逻辑缺陷缺少复现测试时，SHALL NOT 使用纯展示或补充覆盖豁免；这些情况继续按既有 Critical/Warning 规则判定。对于未声明任何 New/Modified Capability 的纯展示 change，review-plan SHALL 将空 Capabilities 与 `skip_specs: true` 视为合法组合；一旦声明了 Capability，缺失 delta spec 仍按既有 Critical 处理。

#### Scenario: 纯展示改动缺测试不产生发现

- **WHEN** review-code 审查只修改静态文案和样式的 diff，且相称的既有验证已通过
- **THEN** 审查报告不因“没有新增测试”产生 Critical、Warning 或 Info

#### Scenario: 补充边界用例只落快照

- **WHEN** review-plan 认为 tasks 可以增加一个额外的空输入测试任务，但该边界不是 proposal 的验收场景
- **THEN** 该条作为 Warning 落快照，不自动补任务，不影响正常清零

#### Scenario: 核心行为缺口不放宽

- **WHEN** proposal 声明的新行为在 delta spec 中完全未覆盖
- **THEN** review-plan 仍报告 Critical

#### Scenario: 已声明 capability 时 skip_specs 仍属误用

- **WHEN** proposal 声明了 New/Modified Capability，但 change 设置 `skip_specs: true` 且没有任何 delta spec
- **THEN** review-plan 仍报告 `skip_specs` 使用不当

## MODIFIED Requirements

### Requirement: 审查发现的自动修复标注

`/ly:review-code` 与 `/ly:review-plan` 的审查发现 SHALL 在既有严重度分级（Critical / Warning / Info）之外，为**每条 Warning** 附一项正交标注 `可自动修复：是 / 否`。Critical 与 Info SHALL NOT 被标注——不可安全自动修复的 Critical 由既有终止条件「无法安全自动修复」处理。该标注 SHALL 由审查者产出：`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文，`reviewExecutor = "main"`（默认）时为主 agent 在本轮审查报告中产出的标注；两条执行者路径 SHALL 使用同一份判据，SHALL NOT 因路径不同而放宽或收紧。命令 SHALL 把该标注视为待当前会话确认的建议值：当前会话 SHALL 可覆盖任一方向，但必须（SHALL）在报告中逐条列出被覆盖的条目、原标注、覆盖后取值与理由，SHALL NOT 静默覆盖。

判「是」的四条须同时成立：**目标唯一**（要改的东西已存在，且以谁为准是确定的——另一方是权威或事实）；**不新造决策**（不引入新格式 / 默认值 / 命名 / 口径 / 分支选择）；**改法机械**（只改审查范围内文件，SHALL NOT 动公开 API / 接口契约 / DB schema / 依赖版本）；**可验证**（现有类型检查 / 测试 / `openspec validate` 可确认未改坏，或纯文档改动的一致性可机械核对）。

命中以下任一即判「否」：建议句含「要么…要么…」「二选一」「取决于」等需要拍板的分支；需要新定格式 / 默认值 / 命名 / 口径；需要产品业务判断，或依赖当前会话不具备的凭据与环境；需要改公开 API / 接口契约 / DB schema / 依赖版本；只要求"提高覆盖率"而未点名具体用例；纯风格偏好或抽象层次之争；审查者自述带不确定性（"可能""疑似"）；建议属于补充边界覆盖、额外测试或 Scenario 增加。

**例外**：建议句虽含分支，但同时显式给出推荐方向时 SHALL 判「是」；采纳该方向后 SHALL 在报告中写明采纳了哪条建议与依据。

**测试风险策略例外**：纯展示改动没有新增自动化测试 SHALL NOT 单独形成 Critical、Warning 或 Info；补充边界覆盖只形成 Warning 并固定标注 `可自动修复：否` 与 `影响落地：否`。已确认逻辑缺陷缺少复现测试、核心行为未覆盖或契约不一致时 SHALL NOT 使用本例外。

**必须判「是」的反向清单**（防借"不可自动修"逃避）：同一事实在两处表述不一致且权威方明确；已点名的漏改或漏同步（含项目「改动对称清单」覆盖的 i18n 文案键、宿主片段、命令表、README 双语）；明确缺陷且写法唯一（如漏捕获异常、漏设错误标志、用错函数）。审查者点名测试补齐 SHALL NOT 单独使该条进入本清单；只有复现已确认 Critical 所必需的测试调整属于该 Critical 修复范围。

一条 Warning 含多个子问题时 SHALL 整条判级：任一部分需要判断即整条判「否」，SHALL NOT 半修。

#### Scenario: 机械性条目判「是」

- **WHEN** 某轮 review-code 的 Warning 为「`archive.md` 未说明归档后应读取归档目录下的 `proposal.md`」且建议是单方向补写路径说明
- **THEN** 该条标注为 `可自动修复：是`，进入自动修复候选

#### Scenario: 需要拍板的分支判「否」

- **WHEN** 某轮 review-plan 的 Warning 建议为「要么在 delta spec 补 `## Purpose` 修改块，要么把 design 的措辞改成不暗示自动合并」
- **THEN** 该条标注为 `可自动修复：否`

#### Scenario: 建议显式给出推荐方向时判「是」并留痕

- **WHEN** 某轮 Warning 的建议为「二选一；建议改 design 措辞（推荐），因为 Purpose 属非规范性叙述」
- **THEN** 该条标注为 `可自动修复：是`，且命令在报告中写明采纳了哪条建议与依据

#### Scenario: 补充测试覆盖判「否」

- **WHEN** 某轮 Warning 只建议增加额外边界用例或补充测试覆盖
- **THEN** 该条标注为 `可自动修复：否`，不进入自动修复

#### Scenario: 多子问题条目整条判「否」

- **WHEN** 一条 Warning 同时涉及三处修复点，其中一处需要业务判断
- **THEN** 整条标注为 `可自动修复：否`，SHALL NOT 只修其中可机械修的子项

#### Scenario: Critical 与 Info 不标注

- **WHEN** 某轮审查返回 1 条 Critical、2 条 Warning 与 1 条 Info
- **THEN** 只有那 2 条 Warning 带 `可自动修复` 标注；Critical 与 Info 不带该标注

#### Scenario: 主会话覆盖标注并在报告中留痕

- **WHEN** 审查者把某条 Warning 标注为「是」，当前会话依据"该修复会变更已发布的公开接口契约"覆盖为「否」
- **THEN** 报告逐条列出该条目、原标注「是」、覆盖后取值「否」与上述理由

### Requirement: 审查发现的影响落地标注

`/ly:review-code` 与 `/ly:review-plan` 的审查发现 SHALL 在严重度分级与 `可自动修复` 标注之外，为**每条 Warning** 再附一项正交标注 `影响落地：是 / 否`。Critical 与 Info SHALL NOT 标注。该标注 SHALL 由审查者产出（`reviewExecutor = "subagent"` 时为审查 subagent 返回的原文；`reviewExecutor = "main"` 时为主 agent 在本轮审查报告中产出的标注），两条执行者路径 SHALL 使用同一份判据。命令 SHALL 把该标注视为待当前会话确认的建议值：当前会话 SHALL 可覆盖任一方向，但必须（SHALL）在报告中逐条列出被覆盖条目、原标注、覆盖后取值与理由。

以下任一条成立即判「是」：**改变实施方式**（不修会导致 tasks 漏项、顺序错误或实施步骤错）；**改变交付结果**（不修会导致已实现行为与 change 目标或 spec 不一致）；**改变验收标准**（不修会导致验收场景不覆盖或无法通过）；**引入回归**（不修会导致既有能力被破坏）。任一条成立即判「是」。

**必须判「是」的反向清单**（防借"不影响"逃避）：接口签名 / 数据模型 / 配置契约不一致；`proposal.md` 的 What Changes 与 delta spec 或 tasks 脱节；已点名的漏实现或漏同步；会导致既有测试或验收场景失败的改动。

**必须判「否」的清单**（防把纯润色升级为阻塞项）：纯措辞、排版、术语统一；补充说明性文档而不改变行为契约；可读性偏好或抽象层次之争；审查者自述带不确定性（"可能""疑似"）且无法给出可复现影响；补充边界用例、额外 Scenario 或额外测试覆盖；纯展示改动未新增自动化测试。

一条 Warning 含多个子问题时 SHALL 整条判定；任一部分 `影响落地=是` 即整条判「是」，SHALL NOT 拆分处理。

#### Scenario: 影响实施方式的条目判「是」

- **WHEN** review-plan 的 Warning 指出 `tasks.md` 漏掉一个会改变接口签名的实施步骤
- **THEN** 该条标注为 `影响落地：是`

#### Scenario: 纯文档润色判「否」

- **WHEN** review-plan 的 Warning 只建议调整 `design.md` 的术语统一，不改变任何行为或实施步骤
- **THEN** 该条标注为 `影响落地：否`

#### Scenario: 补充边界和额外测试判「否」

- **WHEN** 审查者建议增加一个额外空输入测试或提高未声明场景的覆盖率
- **THEN** 该条标注为 `影响落地：否`，只落快照，不阻塞正常清零

#### Scenario: 纯展示改动缺测试判「否」

- **WHEN** 审查者仍对纯展示改动提出“没有新增测试”的建议
- **THEN** 该建议 SHALL NOT 形成 Warning；若作为观察保留，也不得标注 `影响落地=是` 或以任何双轴组合阻塞流程

#### Scenario: 影响本次交付的代码问题判「是」

- **WHEN** review-code 的 Warning 指出某分支逻辑会使验收场景中的结果与 spec 不一致
- **THEN** 该条标注为 `影响落地：是`

#### Scenario: 多子问题任一部分影响即整条判「是」

- **WHEN** 一条 Warning 同时包含术语统一与接口签名不一致两个子问题
- **THEN** 整条标注为 `影响落地：是`，SHALL NOT 只修术语部分

#### Scenario: 主会话覆盖影响判定并留痕

- **WHEN** 审查者把某条 Warning 标注为 `影响落地：否`，当前会话依据"该条会导致验收场景失败"覆盖为「是」
- **THEN** 报告逐条列出该条目、原标注「否」、覆盖后取值「是」与上述理由
