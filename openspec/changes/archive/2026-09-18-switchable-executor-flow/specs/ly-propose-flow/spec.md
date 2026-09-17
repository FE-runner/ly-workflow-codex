## ADDED Requirements

### Requirement: 全自动流水线按执行者语义衔接

**适用范围覆盖（自本 change 起）**：本能力中凡以"单审查 subagent（非 fork）机制"或"coding subagent 实施"为前提的 Requirement（含「全自动路径 = 自动流水线直到审完代码」「apply 实施由 coding subagent 执行」），其适用范围 SHALL 限定为对应执行者字段为 `"subagent"` 时；执行者为 `"main"`（默认，含未配置）时 SHALL 以本 Requirement 与 `ly-review-gates` 的「审查执行者可切换（main / subagent）」为准。

全自动路径 SHALL 保持原有编排顺序（`propose:` commit → review-plan → 节点前置校验 → apply → 节点前置校验 → review-code），但每一步 SHALL 按执行者字段决定主体：

- review-plan / review-code 按 `reviewExecutor`（见 `ly-review-gates`）
- apply 按 `codingExecutor`（见 `ly-lifecycle-commands`）

**apply 阶段快照与提交规则 SHALL 同时覆盖两条执行者路径**：主 agent 直接实施时无 subagent 回传清单，SHALL 以主会话自己记录的实施改动文件清单充当回传清单；实施前 `git status --porcelain` 快照、partial apply 检测、index 隔离（`git commit --only`）、`git show --name-only` 校验规则 SHALL 与 subagent 路径一致。

节点前置校验（review-plan 必须正常清零才进 apply；最近一期 `apply: <change-name>` commit 的 SHA 必须等于本次记录才进 review-code）SHALL 保持适用，与执行者选择无关。

#### Scenario: 全自动路径默认主 agent 执行
- **WHEN** 用户执行 `/ly:propose` 选择"全自动"，未配置执行者字段（等价 `main`）
- **THEN** 流水线按序自动执行 review-plan（主 agent 直接审查）→ apply（主 agent 直接实施）→ review-code（主 agent 直接审查），节点前置校验照常适用，全程不出现 spawn 与回退标记

#### Scenario: 全自动路径配置为 subagent
- **WHEN** 用户配置 `reviewExecutor = "subagent"` 与 `codingExecutor = "subagent"`，执行 `/ly:propose` 选择"全自动"
- **THEN** 流水线各环节按 subagent 路径执行：审查复用同一子代理，coding subagent 实施后由主会话统一提交

#### Scenario: 主 agent 实施时快照规则照常适用
- **WHEN** `codingExecutor = "main"`，全自动流水线进入 apply，主 agent 直接实施
- **THEN** 主会话仍记录实施前 `git status --porcelain` 快照，以自记录改动清单充当回传清单，partial apply 检测与提交校验照常执行
