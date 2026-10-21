## ADDED Requirements

### Requirement: propose 产物按风险测试策略生成

`/ly:propose` 在生成与自审 artifacts 时 SHALL 应用 `risk-based-testing-policy`，并把测试与验证要求写入 proposal、spec 或 tasks 中最合适的既有结构，SHALL NOT 为了满足形式而虚构 Requirement、Scenario 或测试任务。

纯展示改动且不改变行为或契约时，MAY 在 `proposal.md` 明确声明为展示型改动、保持 New/Modified Capabilities 为空并设置 `skip_specs: true`；此时 SHALL NOT 要求 delta spec 或测试任务，但 `tasks.md` SHALL 包含实现任务与相称的验证任务（如 typecheck、build 或视觉检查）。行为或契约改动 SHALL 继续生成对应 delta spec，并在可自动化时包含与风险相称的测试任务。

补充边界覆盖 SHALL NOT 被自动扩为核心 tasks，也 SHALL NOT 仅因其缺失被判定为正向或反向闭环断链。若 proposal 的 What Change 声明了核心行为而 tasks 完全缺少对应该行为的实施任务，仍 SHALL 按机械断链处理。

#### Scenario: 纯展示改动不生成 spec 和测试任务

- **WHEN** 需求只修改静态文案与样式，proposal 明确声明无行为或契约变化
- **THEN** change 可设置 `skip_specs: true`，不生成 delta spec 与测试任务，tasks 只包含实现与相称验证任务

#### Scenario: 行为改动仍生成 spec 和测试任务

- **WHEN** proposal 声明新增或修改可观察行为
- **THEN** change 生成对应 delta spec，并在可自动化时生成测试任务

#### Scenario: 补充边界缺失不构成闭环断链

- **WHEN** 自审发现某个额外边界用例未列入 tasks，但该边界不属于 proposal 的核心行为或验收场景
- **THEN** 自审将其记录为可选补充，不自动补任务，也不判定为机械断链

#### Scenario: 核心行为缺任务仍是机械断链

- **WHEN** proposal 的某条 What Change 声明了必须交付的核心行为，而 tasks 完全没有对应实施任务
- **THEN** 自审判定为机械断链并补齐任务，或按业务判断规则移除该 What Change
