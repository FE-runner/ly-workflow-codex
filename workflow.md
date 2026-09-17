# ly-workflow-codex 工作流程图

> Codex 单 Agent 流程：同一会话内 propose/review/apply 编排。审查与实施各有一个执行者开关——`reviewExecutor` / `codingExecutor` 未配置或为 `main` 时由主 agent 直接执行，为 `subagent` 时 spawn 独立子代理（非 fork，软上下文经 change 目录 `context.md` 到达）。

> **设计态说明**：本文档描述执行者可切换后的目标流程。该能力尚未落地到代码与模板；实现前审查关卡与 apply 仍按 subagent 路径执行。

## 1. 总览：执行者分支

```mermaid
flowchart TD
    A["@lyx-propose 需求"] --> B["隔离方式三选一"]
    B --> C["全自动 / 手动"]
    C --> D["生成 artifacts<br/>(主 agent)"]
    D --> E["方案自审 + context.md<br/>(主 agent)"]
    E --> F["commit: propose: change-name"]
    F --> G{"reviewExecutor"}
    G -->|main| H["主 agent 自审<br/>分级发现"]
    G -->|subagent| I["spawn 审查 subagent<br/>非 fork + context.md"]
    H --> J["修复 Critical<br/>再自查确认清零<br/>最多 2 轮"]
    I --> K["逐条裁决 + 修复循环<br/>最多 5 轮 / 驳回硬线"]
    J --> L{"codingExecutor"}
    K --> L
    L -->|main| M["主 agent 直接实施"]
    L -->|subagent| N["spawn coding subagent<br/>非 fork + context.md"]
    M --> O["主会话统一 commit<br/>apply: change-name"]
    N --> O
    O --> P{"reviewExecutor"}
    P -->|main| Q["主 agent 自审代码"]
    P -->|subagent| R["spawn 审查 subagent<br/>基线 = apply commit"]
    Q --> S["结束，可 @lyx-archive"]
    R --> S
```

## 2. 配置如何决定走哪条路

```mermaid
flowchart LR
    subgraph CFG["~/.codex/lyx/config.toml"]
        RE["reviewExecutor"]
        RM["reviewModel"]
        CE["codingExecutor"]
        CM["codingModel"]
    end

    RE -->|"未配置 / main"| MainRev["主 agent 直接审查"]
    RE -->|"subagent"| SubRev["spawn 审查 subagent"]
    RM -.->|"仅 subagent 时生效"| SubRev

    CE -->|"未配置 / main"| MainCod["主 agent 直接实施"]
    CE -->|"subagent"| SubCod["spawn coding subagent"]
    CM -.->|"仅 subagent 时生效"| SubCod

    MainRev --> RevWarn["模型 / 推理档字段被忽略<br/>doctor WARN"]
    MainCod --> CodWarn["模型 / 推理档字段被忽略<br/>doctor WARN"]
```

## 3. 审查循环：两条路径的差异

```mermaid
flowchart TD
    Start["进入审查"] --> Dec{"reviewExecutor"}

    Dec -->|main| M1["主 agent 读 artifacts / diff<br/>产出 Critical/Warning/Info"]
    M1 --> M2{"Critical 数大于 0 ?"}
    M2 -->|否| MDone["确认清零，结束"]
    M2 -->|是| M3["修复 Critical"]
    M3 --> M4["再自查一轮确认"]
    M4 --> M5{"已达 2 轮 ?"}
    M5 -->|否| M1
    M5 -->|是| MStop["停止，转人工"]

    Dec -->|subagent| S1["spawn 全新审查 subagent<br/>非 fork，只携带 TASK"]
    S1 --> S2["产出 Critical/Warning/Info"]
    S2 --> S3{"Critical 数大于 0 ?"}
    S3 -->|否| SDone["正常清零<br/>统一提交修复"]
    S3 -->|是| S4["主 agent 逐条裁决<br/>不认可须附可核验依据"]
    S4 --> S5["仅修复认可的 Critical"]
    S5 --> S6["openspec validate / 测试验证"]
    S6 --> S7{"命中终止条件 ?"}
    S7 -->|"熔断 / 驳回硬线 / 5 轮上限"| SStop["停止，转人工"]
    S7 -->|否| S8["重新 spawn 全新 subagent<br/>携带上轮 Critical 逐字原文"]
    S8 --> S2
```

## 4. apply 实施：两条路径的差异

```mermaid
flowchart TD
    Start["@lyx-apply change-name"] --> Snap["快照 git status"]
    Snap --> Dec{"codingExecutor"}

    Dec -->|main| M1["主 agent 读 tasks.md<br/>逐任务实施 + 验证 + 勾选"]
    M1 --> M2["主 agent 自记录改动清单"]
    M2 --> M3["回写 context.md"]

    Dec -->|subagent| S1["spawn coding subagent<br/>非 fork + context.md"]
    S1 --> S2["逐任务实施 + 验证 + 勾选"]
    S2 --> S3["回传改动清单，不 commit"]
    S3 --> S4["主 agent 比对快照<br/>partial apply 检测"]
    S4 --> M3

    M3 --> Commit["主会话统一 commit<br/>apply: change-name"]
    Commit --> Verify["git show --name-only 校验<br/>文件集合等于待提交清单"]
```

## 5. 时序：混合配置下的一次完整流水线

以 `reviewExecutor = subagent`、`codingExecutor = main` 为例。

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant M as 主 agent
    participant R as 审查 subagent

    U->>M: @lyx-propose 给 status 加 --json
    M->>M: 隔离方式三选一 + 全自动/手动
    M->>M: 生成 artifacts + 方案自审 + context.md
    M->>M: commit propose: status-json-output

    M->>R: spawn（非 fork，TASK = 路径清单 + context.md）
    R-->>M: Critical 1 / Warning 2 / Info 1
    M->>M: 逐条裁决（Critical 认可）+ 修复 + validate
    M->>R: 重新 spawn（上轮 Critical 逐字原文 + 路径清单）
    R-->>M: Critical 0
    M->>M: commit fix: review-plan feedback

    M->>M: codingExecutor = main，主 agent 直接实施
    M->>M: 逐任务实施 + 验证 + 勾选 + 回写 context.md
    M->>M: commit apply: status-json-output

    M->>R: spawn（基线 = apply commit + context.md）
    R-->>M: Critical 0 / Warning 1 / Info 2
    M->>U: 流水线结束，提示可 @lyx-archive
```
