# ly-workflow-codex 工作流程图

> Codex 单 Agent 编排：同一会话内 propose / review / apply；审查与实施主体由 `~/.codex/lyx/config.toml` 的 `[codexHost] reviewExecutor` / `codingExecutor` 决定（未配置等价 `main` = 主 agent 直接执行；`subagent` = spawn 独立子代理）。慢验证（测试 / 类型检查 / 构建）统一由 `@lyx-archive` 的归档前关卡执行一次，审查循环不再重复执行。

## 1. @lyx-propose（编排入口）

```mermaid
flowchart TD
    Start["@lyx-propose 触发"] --> InWt{已在 worktree 内?}
    InWt -->|是| AskAuto["问: 全自动 / 手动?"]
    InWt -->|否| AskIso["问: 隔离方式(三选一)"]
    AskIso -->|隔离 worktree| WtDirty{"脏改动?"}
    WtDirty -->|有| WtHint["提示: 改动留在原 worktree<br/>确认后继续"]
    WtDirty -->|无| WtCreate
    WtHint --> WtCreate["git worktree add -b 开发分支名<br/>~/.ly/worktrees/项目名/开发分支名<br/>(从当前分支 HEAD 切出) + baseline"]
    WtCreate --> WtCd["同会话 cd 进 worktree + 目录校验<br/>(失败即停,不静默继续)"]
    WtCd --> AskAuto
    AskIso -->|本项目切新分支| Dirty1{"脏改动?"}
    Dirty1 -->|有| Disp["脏改动三选处置:<br/>WIP commit / Stash / 原样保留"]
    Dirty1 -->|无| Branch
    Disp --> Branch["git checkout -b 开发分支名"]
    Branch --> AskAuto
    AskIso -->|留在当前分支| Dirty2{"脏改动?"}
    Dirty2 -->|有| Disp
    Dirty2 -->|无| AskAuto

    AskAuto --> Gen["opsx:propose 生成方案<br/>(快照比对确定 change 名)"]
    Gen --> SelfReview["方案自审(四项检查+逐项结论清单)<br/>机械断链直接修 / 业务判断类问用户"]
    SelfReview --> Ctx["产出 context.md 软上下文"]
    Ctx --> Commit["commit: propose: change-name"]

    Commit -->|手动| C3["问: 要不要跑 review-plan?"]
    C3 -->|否| C4["结束(方案已 commit)"]
    C3 -->|是| RP
    Commit -->|全自动| RP["@lyx-review-plan 审查-修复循环<br/>主体按 reviewExecutor"]
    RP --> RPExit{终止原因}
    RPExit -->|正常清零| Apply["@lyx-apply<br/>主体按 codingExecutor<br/>-> commit: apply: change-name"]
    RPExit -->|其余| Stop1["输出终止报告,流水线停止"]
    Apply --> RC["@lyx-review-code 审查-修复循环<br/>主体按 reviewExecutor"]
    RC --> RCExit{终止原因}
    RCExit -->|正常清零| Done["结束(archive 仍手动)"]
    RCExit -->|其余| Stop2["输出终止报告,停止"]
```

## 2. 审查关卡（@lyx-review-plan / @lyx-review-code）

```mermaid
flowchart TD
    RStart["进入审查"] --> RExec{"reviewExecutor?"}

    RExec -->|main（默认）| M1["主 agent 直接读审查对象<br/>产出 Critical/Warning/Info"]
    M1 --> M2{"Critical > 0?"}
    M2 -->|否| MDone["清零,统一提交(如有修复)"]
    M2 -->|是| M3["直接修复 Critical"]
    M3 --> M4["自查一轮确认"]
    M4 --> M5{"已达 2 轮?"}
    M5 -->|否| M1
    M5 -->|是| MStop["停止,转人工"]

    RExec -->|subagent| S1["spawn 1 个审查 subagent<br/>非 fork + TASK(context.md 路径)"]
    S1 --> S2["产出 Critical/Warning/Info"]
    S2 --> S3{"Critical > 0?"}
    S3 -->|否| SDone["正常清零,统一提交修复"]
    S3 -->|是| S4["主 agent 逐条裁决<br/>不认可须附可核验依据"]
    S4 --> S5["修复认可的 Critical"]
    S5 --> S6["openspec validate"]
    S6 --> S7{"命中终止条件?"}
    S7 -->|熔断/驳回硬线/5 轮上限| SStop["停止,转人工"]
    S7 -->|否| S8["send_input 复用同一子代理<br/>(失败则重新 spawn)"]
    S8 --> S2
```

> 两条路径 SHALL NOT 运行测试 / 类型检查 / 构建——慢验证统一由归档前关卡执行。

## 3. @lyx-apply（实施）

```mermaid
flowchart TD
    AStart["@lyx-apply 触发"] --> Resolve["解析 change 名"]
    Resolve --> Snapshot["快照 git status --porcelain"]
    Snapshot --> AExec{"codingExecutor?"}

    AExec -->|main（默认）| AM1["主 agent 直接读 tasks.md<br/>逐任务实施 + 验证 + 勾选"]
    AM1 --> AM2["主 agent 自记录改动清单"]

    AExec -->|subagent| AS1["spawn coding subagent<br/>非 fork + TASK(context.md 路径)"]
    AS1 --> AS2["逐任务实施 + 验证 + 勾选"]
    AS2 --> AS3["回传改动清单,不 commit"]
    AS3 --> AS4["主 agent 比对快照<br/>partial apply 检测"]

    AM2 --> ACtx["回写 context.md"]
    AS4 --> ACtx
    ACtx --> ACommit["统一 commit: apply: change-name"]
    ACommit --> AVerify["git show --name-only 校验文件集合"]
```

## 4. @lyx-archive（归档）

```mermaid
flowchart TD
    ArStart["@lyx-archive 触发"] --> Verify["归档前完整验证<br/>测试 / 类型检查 / 构建<br/>(缺失项跳过并注明)"]
    Verify --> VResult{"全部通过?"}
    VResult -->|否| VFail["停止归档<br/>不移动 change 目录<br/>报告失败脚本与原始输出"]
    VResult -->|是| Archive["opsx:archive 归档"]
    Archive --> Commit["commit: archive: change-name"]
```
