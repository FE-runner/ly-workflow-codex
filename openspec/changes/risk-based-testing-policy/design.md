## Context

参见 `proposal.md` 的 Why。当前实现把测试要求在四个位置重复表达：`fix` 模板要求所有改动先红后绿；`propose` 自审把漏任务统一视为机械断链；reviewer 角色词和共享审查模板把测试补齐列入必须自动修复；`archive` 又负责最终完整验证。模板正文在 `templates/skills/`，Codex 角色词位于 `templates/hosts/codex/prompts/`，Claude 角色词位于 `templates/hosts/claude/agents/`，现有测试要求代码审查与方案审查的判级标准在角色词和共享模板间逐字一致。

## Goals / Non-Goals

**Goals:**

- 用一份共享 capability 定义风险分类、测试义务和补充边界覆盖的记录口径。
- 让 fix、propose、review-plan、review-code 在安装后的模板中得到一致且可执行的行为。
- 保留逻辑缺陷复现、核心行为覆盖、公开契约与 archive 完整验证等高风险门槛。
- 用现有模板断言测试防止双宿主角色词和共享模板再次漂移。

**Non-Goals:**

- 不改变 `@lyx-archive` 的完整测试、类型检查与构建门禁。
- 不引入自动识别“纯展示改动”的运行时分类器；分类仍由执行 agent 基于实际 diff 判断并留痕。
- 不修改 OpenSpec CLI、宿主适配器或安装器机制。
- 不放宽已确认逻辑 bug 的复现测试、接口或配置契约缺口、数据安全与迁移风险。

## Decisions

### D1. 新增共享 capability，而不是把完整策略复制为四份规范

新增 `risk-based-testing-policy`，定义分类边界、测试义务与补充边界覆盖的非阻塞语义。`lightweight-fix-flow`、`ly-propose-flow`、`ly-review-gates` 只修改或新增引用该策略的行为条款。

替代方案是直接在三个既有 capability 中重复完整规则；这样会让同一口径在归档后出现三套文本，且后续修改容易只改一处。共享 capability 增加一份规范文件，但降低长期漂移风险。

### D2. 纯展示豁免采用严格静态展示定义

豁免仅适用于只改变静态展示层、文案、样式、布局或图标，且不改变状态、事件、条件分支、数据流、业务计算、公开组件契约、接口或配置行为的改动。纯展示改动不要求新增自动化测试，但仍要求运行项目提供的相关既有测试、类型检查或构建，并在可用时执行视觉检查；无法验证时必须记录原因。

替代方案是按“UI 目录”或组件层级判定；这会把带业务逻辑的组件误判为纯展示。实际 diff 语义比文件路径更可靠。

### D3. 补充边界覆盖统一为 Warning + 双否标注

propose 不把补充边界覆盖自动扩为核心 tasks；review-plan / review-code 发现该类建议时保留 Warning 以进入 `review-findings.md`，固定标注 `可自动修复：否` 与 `影响落地：否`。正常清零只要求 Critical 为 0 且 `影响落地=是` 的 Warning 已解决，因此双否标注不会阻塞流程。

替代方案是把补充覆盖降为 Info；但现有快照只收 Warning，降为 Info 会导致记录丢失，不符合“只记录下来”的目标。

### D4. 高风险测试义务不由豁免覆盖

逻辑缺陷可在自动化时仍要求先写复现测试；核心行为声明完全未覆盖仍按 Critical；声明了 Capability 却使用 `skip_specs: true` 仍属误用。纯展示豁免只改变“是否必须新增测试”和“补充覆盖是否阻塞”，不改变正确性、契约与验收底线。

替代方案是让审查完全忽略所有测试缺失；这会混淆“额外覆盖”与“关键行为未验证”，不可接受。

### D5. 模板与角色词保持短条款并继续由测试锁定一致性

共享 capability 提供规范来源，运行模板只保留执行所需的短规则。`review-code` 与 `review-plan` 的四象限段继续逐字一致；Codex/Claude 的 reviewer 与 plan-reviewer 判级标准继续与各自共享模板逐字一致。新增文本断言覆盖纯展示豁免和补充边界双否规则。

替代方案是新增跨模板共享片段机制；现有 `HOST_FRAGMENT` 只承载宿主差异，为该策略扩展通用片段机制超出本次范围。

### D6. 文档和安装产物同步，但 archive 保持不变

同步 `AGENTS.md`、`CLAUDE.md`、README 双语与 `templates/CLAUDE.md`。不修改 `archive-verification-gate` 与归档模板中的完整验证逻辑。模板修改安装后需通过 `lycx update` 或重装刷新用户环境，属于发布后的常规安装动作，不在本 change 内自动执行。

## Risks / Trade-offs

- **纯展示误判导致跳过必要测试** → 使用严格分类条件；状态、事件、分支、数据流或契约任一命中即失去豁免；核心行为缺口和逻辑缺陷复现保持原门槛。
- **不同执行者对“补充边界”理解不一致** → 以 proposal、Requirement、Scenario、确认缺陷复现作为边界是否必要的判据；审查仍产出 Warning 快照供人工回看。
- **模板与角色词漂移** → 保留四象限逐字一致测试，扩充 reviewer/plan-reviewer 判级标准一致性测试，并增加正向、反向文本断言。
- **说明过长再次增加执行成本** → 共享 capability 承载完整规范，安装模板仅保留短执行条款；不新增运行时配置文件或分类命令。
- **用户环境继续使用旧规则** → 发布说明中提示已安装用户运行更新；验证只针对仓库产物，不声称已刷新全局安装。

## Migration Plan

1. 修改共享审查模板、fix/propose 模板与双宿主角色词。
2. 更新主 spec、权威文档和模板断言测试。
3. 运行 `pnpm test`、`pnpm typecheck`、`pnpm build` 与 `openspec validate --changes`。
4. 归档后按项目发布流程发版；用户环境通过 `lycx update` 或重装获得新模板。
5. 回滚时恢复模板、角色词、specs 与文档即可；无数据迁移或兼容层。
