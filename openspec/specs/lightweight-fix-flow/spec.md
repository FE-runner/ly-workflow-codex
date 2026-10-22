# lightweight-fix-flow Specification

## Purpose
为小需求与 bug 修复提供 `@lyx-fix` 轻量路径：不创建 OpenSpec change，以单个命令完成定位、spec 分流、实施、自审、验证与单次提交，并把主 spec 同步作为强制步骤，防止绕开全流程导致 spec 漂移。

## Requirements

### Requirement: fix 命令是不创建 change 的单命令轻量流程

`@lyx-fix` SHALL 以用户参数描述的问题或需求为输入，在当前会话由主 agent 按「定位 → spec 分流 → 实施 → 自审 → 最终验证 →（B 类确认）→ 提交」顺序一次完成。命令 SHALL NOT 创建 OpenSpec change 目录、SHALL NOT 写 `context.md`（MAY 写 `review-findings.md`，如追加解决标注；写入内容属于本次修复的待提交单元）、SHALL NOT 询问隔离方式或全自动/手动、SHALL NOT 创建分支或 worktree，直接在当前分支工作。执行主体固定为主 agent：SHALL NOT 读取或受 `[host]` 的 `reviewExecutor` / `codingExecutor` / `reviewMode` 及模型字段影响，SHALL NOT spawn 子代理。

开始前 SHALL 检查 `git status --porcelain`：存在预存改动时如实提示并记录其路径清单，这些改动 SHALL NOT 被纳入本次提交。

#### Scenario: 小 bug 走轻量流程
- **WHEN** 用户在 `main` 分支运行 `@lyx-fix "doctor 读目录失败时打印堆栈"`
- **THEN** 命令不询问隔离方式与自动化档位、不创建 change 目录，直接在 `main` 上定位、实施、自审、验证并提交一个 commit

#### Scenario: 配置不影响 fix 的执行主体
- **WHEN** 宿主配置 `reviewExecutor = "subagent"`、`reviewMode = "off"`，用户运行 `@lyx-fix`
- **THEN** 自审仍由主 agent 执行一轮，不 spawn 子代理、不因 `reviewMode = "off"` 跳过自审

#### Scenario: 预存改动不混入提交
- **WHEN** 运行 `@lyx-fix` 前工作区已有与本次无关的未提交改动
- **THEN** 命令提示这些改动的存在，提交时只暂存本次修复涉及的文件，预存改动保持原状

### Requirement: spec 分流是实施前的强制步骤

定位完成后、实施之前，命令 SHALL 对照 `openspec/specs/` 的相关 Requirement 给出分流结论并展示给用户，结论 SHALL 为以下之一：

- **A（代码对齐 spec）**：改动使代码符合既有 Requirement / Scenario，主 spec 不改；
- **B（小幅行为变化）**：改动改变或新增少量 Scenario / Requirement 描述的行为，主 spec SHALL 在同一提交中就地修改（直接编辑 `openspec/specs/<capability>/spec.md`，SHALL NOT 创建 delta spec、SHALL NOT 经归档合并）；
- **C（超出轻流程）**：需要新增 capability、新增多条 Requirement、跨多个模块的设计取舍、需要产品决策，或需改动的 capability 在进行中 change（`openspec/changes/` 下未归档目录）中存在 delta spec 时，命令 SHALL 停止并建议改用 `@lyx-propose`，SHALL 写明判定理由；用户明确坚持留在轻流程时 SHALL 按 B 继续并在提交正文注明"用户坚持轻流程"。

项目不存在 `openspec/specs/` 时，分流结论 SHALL 记为"无 spec 基线"，跳过 spec 同步与自审中的 spec 复核，其余步骤照常。SHALL NOT 在未给出分流结论的情况下开始实施。

#### Scenario: A 类不改 spec
- **WHEN** 修复使代码符合某 capability 既有 Scenario
- **THEN** 分流结论为 A 并点名对齐的 Requirement，提交中不包含 `openspec/specs/` 的改动

#### Scenario: B 类就地改主 spec
- **WHEN** 修复改变了某 Scenario 描述的行为
- **THEN** 分流结论为 B，命令直接编辑对应主 spec 文件，与代码改动进入同一提交，不创建 change 或 delta spec

#### Scenario: C 类转全流程
- **WHEN** 需求需要新增一个 capability
- **THEN** 命令在实施前停止，说明判定理由并建议 `@lyx-propose`，不修改任何文件

#### Scenario: 相关 capability 有进行中 delta 时转全流程
- **WHEN** 修复需改动的 capability 在某个未归档 change 中存在 delta spec
- **THEN** 分流结论为 C，命令说明冲突风险并建议 `@lyx-propose` 或先完成该 change

#### Scenario: 用户坚持留在轻流程
- **WHEN** 分流结论为 C，用户回复坚持使用 `@lyx-fix`
- **THEN** 命令按 B 继续，提交正文 `- spec：` 条目注明"用户坚持轻流程"

### Requirement: 实施先写回归测试并观察失败

实施前 SHALL 读取当前宿主 `testMode`。`testMode = "off"` 时，`@lyx-fix` SHALL NOT 新增或修改测试文件、SHALL NOT 运行测试命令；行为或契约改动仍 SHALL 正常实施，并改用项目提供的类型检查、构建或其他非测试验证。`testMode = "normal"` 时 SHALL 按 `risk-based-testing-policy` 对改动单元分类并记录测试策略：行为或契约改动与逻辑缺陷修复在可自动化时 SHALL 先编写能复现问题或刻画新行为的测试并运行、确认其失败，再修改实现直至通过；失败记录 SHALL 保留供自审⑤核对。纯展示改动 SHALL NOT 被要求新增自动化测试，但仍 SHALL 运行相关既有测试、类型检查或构建，并在可用时执行视觉检查。补充边界覆盖 SHALL NOT 被自动扩为核心实施步骤或提交前置条件。

无测试模式下，`@lyx-fix` 的非测试职责 SHALL 保持不变，包括定位、spec 分流、实现、自审、类型检查、B 类确认与单 commit。任何无法执行的验证 SHALL 明确记录原因，SHALL NOT 静默省略。

#### Scenario: 回归测试先红后绿
- **WHEN** `testMode = "normal"` 且修复一个可复现的逻辑 bug
- **THEN** 命令先新增测试并展示其失败输出，再修改实现使其通过

#### Scenario: 纯展示改动不新增测试
- **WHEN** `testMode = "normal"`，需求只改动纯 UI、文案或样式，且不涉及行为、状态、数据流或契约
- **THEN** 命令不要求新增测试，改为运行相关既有测试、类型检查或构建，并在可用时完成视觉检查

#### Scenario: 无测试模式不写不跑测试
- **WHEN** `testMode = "off"`，用户运行 `@lyx-fix`
- **THEN** 命令不新增或修改测试文件、不运行测试命令，只用类型检查、构建或其他非测试验证后提交

#### Scenario: 补充边界不扩为实施任务
- **WHEN** 实施中识别到与用户请求和既有 Scenario 无关的额外边界用例
- **THEN** 命令将其作为可选补充记录，不自动新增测试或扩大本次实施范围

#### Scenario: 无法写测试时说明原因
- **WHEN** `testMode = "normal"` 且改动无法被自动化测试覆盖，或环境无法执行相称验证
- **THEN** 命令记录具体原因并写入提交正文 `- 自审：` 与 `- 验证：` 条目

### Requirement: 自审由主 agent 对稳定 diff 执行一轮五项检查

实施完成且按风险策略执行测试或验证后、最终验证之前，主 agent SHALL 对实际 diff 执行一轮自审，逐项给出结论：

1. **修对了吗**：修的是根因而非症状，用户原始描述逐条覆盖；
2. **spec 一致吗**：用实际 diff 复核分流结论（判 A 但 diff 改变了 spec 描述的行为 → 改判 B 并补改 spec；判 B 但 spec 与 diff 不一致 → 修正）；以 diff 涉及的标识符检索 `openspec/specs/`，命中的 Requirement 逐条确认仍成立；
3. **漏改了吗**：同一逻辑的其他调用点与分支、成对位置是否同步；成对清单 SHALL 优先读取项目 `AGENTS.md` 的「改动对称清单」小节逐项核对，该小节缺失时由 agent 按代码结构推断并说明推断依据；
4. **改多了吗**：diff 不含与本次修复无关的改动，预存改动未混入；
5. **验证充分吗**：按 `risk-based-testing-policy` 核对复现测试、行为验证或纯展示验证是否充分；无法验证的原因是否如实记录。

自审发现的问题 SHALL 直接修正并纳入同一提交。自审 SHALL NOT 做 Critical/Warning/Info 分级、SHALL NOT 循环多轮，SHALL NOT 覆盖安全/性能/风格等通用审查维度。补充边界覆盖缺失 SHALL NOT 作为自审不通过条件。

#### Scenario: 自审发现漏改的成对位置
- **WHEN** 项目 AGENTS.md 的「改动对称清单」列出 zh-CN ↔ en 文案键成对，diff 只改了 zh-CN
- **THEN** 自审③判定漏改，补齐 en 文案后继续，结论写入提交正文

#### Scenario: 自审复核推翻分流结论
- **WHEN** 分流结论为 A，但实际 diff 改变了某 Scenario 描述的行为
- **THEN** 自审②改判为 B 并补改对应主 spec，后续按 B 类流程提交前确认

#### Scenario: 无对称清单时推断
- **WHEN** 项目 AGENTS.md 无「改动对称清单」小节
- **THEN** 自审③按代码结构推断成对位置并说明依据，不因小节缺失而跳过该项

#### Scenario: 纯展示改动记录验证替代项
- **WHEN** 本次修复只涉及纯展示改动
- **THEN** 自审⑤确认已运行相称的既有测试、类型检查、构建或视觉检查，并记录“无需新增测试”的依据

### Requirement: 最终验证是提交门禁

自审完成（含其修正）后，命令 SHALL 运行最终验证：与本次改动相关的测试，以及项目提供的类型检查（缺失项跳过并注明）；可不运行全量构建。验证失败时 SHALL 修正后重跑，且只对为修复验证失败新增的 diff 重新执行自审③④；同一验证连续失败 2 次 SHALL 停止并原样呈报失败输出转人工，改动留在工作区，SHALL NOT 提交。

#### Scenario: 验证失败后修正再验证
- **WHEN** 最终验证中类型检查失败一次，修正后通过
- **THEN** 命令仅对修正引入的 diff 重跑自审③④，然后继续提交

#### Scenario: 验证连续失败转人工
- **WHEN** 同一验证修正后再次失败
- **THEN** 命令停止，呈报原始失败输出，不提交，改动保留在工作区

### Requirement: B 类提交前确认 spec 改动

分流结论（含自审复核后）为 B 时，命令 SHALL 在提交前展示主 spec 的改动 diff 与代码改动摘要并等待用户确认；用户确认后提交，用户拒绝则不提交、改动保留在工作区并如实说明。**用户要求修改时，命令 SHALL 修改后重新执行最终验证（并只对本次修改新增的 diff 重跑自审③④），通过后重新展示确认；SHALL NOT 在未重新通过验证的情况下直接提交。** 分流结论为 A 或"无 spec 基线"时 SHALL 直接提交，不发起确认。

#### Scenario: A 类直接提交
- **WHEN** 分流结论为 A 且最终验证通过
- **THEN** 命令直接提交，不发起确认询问

#### Scenario: B 类等待确认
- **WHEN** 分流结论为 B 且最终验证通过
- **THEN** 命令展示主 spec diff 并等待用户确认后才提交

#### Scenario: 用户拒绝 B 类提交
- **WHEN** 用户在确认环节拒绝
- **THEN** 命令不提交，改动保留在工作区，并说明当前状态

#### Scenario: 用户要求修改后重新验证再确认
- **WHEN** 用户在 B 类确认环节要求修改
- **THEN** 命令修改后重新执行最终验证，通过后才重新展示确认；SHALL NOT 未经重新验证直接提交

### Requirement: fix 提交为单个非 change 生命周期 commit

命令 SHALL 只产生一个 commit，按路径暂存本次修复涉及的代码、测试与主 spec 文件（SHALL NOT 使用 `git add -A` 全量暂存，SHALL NOT 纳入预存改动；本次修复主动写入的 `review-findings.md` SHALL 随路径清单一并暂存）。message SHALL 遵守 `@lyx-commit` 正文规范：`<type>(<scope>): <subject>` 首行（type 按实际改动判断，主 spec 改动作为附带改动不改变 type 与 scope），正文含 `- 动机：` / `- 改动：` / `- 影响：`，并追加：

- `- spec：` 分流结论（A 点名对齐的 Requirement；B 点名修改的 capability 与 Requirement/Scenario；无 spec 基线如实注明）；
- `- 自审：` 五项中有内容的结论；
- `- 验证：` 运行的验证与结果，未运行项写原因。

message SHALL NOT 追加 `Change-Stage` / `Change-Name` trailer。`git commit` 失败时 SHALL 如实报告原始错误，不重试不兜底。

#### Scenario: fix 提交 message 结构
- **WHEN** 命令完成一次 B 类修复并提交
- **THEN** commit message 首行为 CC 前缀，正文含动机/改动/影响与 spec/自审/验证六条 bullet，末尾无 `Change-Stage` / `Change-Name` trailer

#### Scenario: 提交只含本次文件
- **WHEN** 工作区同时存在预存改动（含其他 change 的 `review-findings.md`）
- **THEN** 提交的文件集合只包含本次修复涉及的文件（含本次主动写入的 `review-findings.md`，如有）

### Requirement: fix 在 ask 模式下每次调用询问

`@lyx-fix` 不创建 change 元数据，effective 配置 `testMode = "ask"` 时 SHALL 在每次调用进入实施前询问一次 `normal` / `off`。该选择 SHALL 只对本次 fix 生效，SHALL NOT 写入任何 change 元数据或宿主配置。

选择 `normal` 时 SHALL 使用风险测试策略；选择 `off` 时 SHALL 遵守无测试模式。用户取消或环境无法交互时 SHALL 停止在测试动作前。effective 配置为 `normal` / `off` 时 SHALL 直接使用配置，不询问。

#### Scenario: ask 每次 fix 都询问
- **WHEN** effective 配置为 `ask`，用户连续两次运行 `@lyx-fix`
- **THEN** 两次调用分别询问测试模式，不沿用上一次 fix 的选择

#### Scenario: fix 选择 normal
- **WHEN** `@lyx-fix` 在 `ask` 下选择 `normal`，本次为逻辑 bug 修复
- **THEN** 命令按风险策略先写复现测试并确认失败，再修复至通过

#### Scenario: fix 选择 off
- **WHEN** `@lyx-fix` 在 `ask` 下选择 `off`
- **THEN** 本次不新增或修改测试文件、不运行测试命令，改用 typecheck / build 等非测试验证

#### Scenario: ask 取消时停止
- **WHEN** `@lyx-fix` 在 `ask` 下无法获得用户选择
- **THEN** 命令停止，不开始实施或运行测试
