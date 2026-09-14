# ly-workflow-codex 工作流程图

> Codex 单 Agent 流程：同一会话内 propose/review/apply 编排；审查关卡走 `codex exec` 独立子会话（调用契约见 [docs/codex-exec-contract.md](./docs/codex-exec-contract.md)）。

## 1. /ly:propose（编排入口）

```mermaid
flowchart TD
    Start["/ly:propose 触发"] --> InWt{已在 worktree 内?}
    InWt -->|是| AskAuto["问: 全自动 / 手动?"]
    InWt -->|否| AskIso["问: 隔离方式(三选一)"]
    AskIso -->|隔离 worktree| WtDirty{"脏改动?<br/>(git status --porcelain)"}
    WtDirty -->|有| WtHint["提示: 改动留在原 worktree<br/>确认后继续"]
    WtDirty -->|无| WtCreate
    WtHint --> WtCreate["git worktree add -b 开发分支名<br/>~/.ly/worktrees/项目名/开发分支名<br/>(从当前分支 HEAD 切出) + baseline"]
    WtCreate --> WtCd["同会话 cd 进 worktree + 目录校验<br/>(失败即停,不静默继续)"]
    WtCd --> AskAuto
    AskIso -->|本项目切新分支| Dirty1{"脏改动?"}
    Dirty1 -->|有| Disp["脏改动三选处置:<br/>WIP commit / Stash / 原样保留"]
    Dirty1 -->|无| Branch
    Disp --> Branch["git checkout -b 开发分支名<br/>(无 baseline/无 cd/无兜底命令)"]
    Branch --> AskAuto
    AskIso -->|留在当前分支| Dirty2{"脏改动?"}
    Dirty2 -->|有| Disp
    Dirty2 -->|无| AskAuto

    AskAuto -->|手动| M1["opsx:propose 生成方案<br/>(快照比对确定 change 名)"]
    AskAuto -->|全自动| A1["opsx:propose 生成方案<br/>(快照比对确定 change 名)"]

    M1 --> SelfReview["方案自审(四项检查+逐项结论清单)<br/>机械断链直接修 / 业务判断类问用户"]
    A1 --> SelfReview
    SelfReview --> Commit["commit: propose: change-name<br/>(自审修复一并落库)"]

    Commit -->|手动分支| C3["问: 要不要跑 review-plan?"]
    C3 -->|否| C4["结束(方案已 commit,<br/>apply/review-code 日后手动)"]
    C3 -->|是| C5["/ly:review-plan 审查-修复循环<br/>(审查对象: propose commit)"]
    C5 --> C6{终止原因}
    C6 -->|清零| C7["结束(修复已统一提交,<br/>日后自行 apply/review-code)"]
    C6 -->|其余终止条件| C8["输出终止报告,结束"]

    Commit -->|全自动分支| B1["/ly:review-plan 审查-修复循环"]
    B1 --> B2{终止原因}
    B2 -->|清零| BApply["/ly:apply 本会话实施<br/>-> commit: apply: change-name"]
    B2 -->|其余终止条件| B6["输出终止报告,流水线停止"]
    BApply --> BCode["/ly:review-code 审查-修复循环<br/>(审查对象: apply commit)"]
    BCode --> B5{终止原因}
    B5 -->|清零| B7["结束(archive 仍手动)"]
    B5 -->|其余终止条件| B8["输出终止报告,停止"]
```

## 2. /ly:apply（当前会话本人实施）

```mermaid
flowchart TD
    Apply["/ly:apply 触发"] --> Resolve["解析 change 名:<br/>显式参数 -> 唯一未归档 change -> 询问"]
    Resolve --> SelfImpl["当前会话读 tasks.md<br/>逐任务实施 + 验证 + 勾 checkbox<br/>(无外部委托 / 无 wrapper)"]
    SelfImpl --> PreCheck{"有与本次无关的预存改动?"}
    PreCheck -->|是| PreNote["git add 仅限本次改动, 预存改动不提交"]
    PreCheck -->|否| Normal["git add 本次实际改动"]
    PreNote --> AppCommit["commit: apply: change-name"]
    Normal --> AppCommit
    AppCommit --> End["结束(apply commit 即 review-code 审查对象)"]
```

## 3. 审查-修复循环（review-plan / review-code 共用）

```mermaid
flowchart TD
    R1["首轮: codex exec 独立子会话<br/>codex exec -C $WORKDIR --json -m 审查模型 -<br/>(ROLE_FILE + TASK 经 stdin, agentic 运行)"] --> R2{审查调用失败?<br/>超时/非零退出/空响应/<br/>格式无法解析}
    R2 -->|是| R8a["终止条件8: 审查调用失败<br/>停止循环,报告原始失败信息"]
    R2 -->|否| R3{本轮 Critical 数}
    R3 -->|0| R4["终止条件1: 清零<br/>停止循环,统一提交修复(--no-commit 除外)"]
    R3 -->|大于0| R5["逐条 Critical: 当前会话判断是否认可"]
    R5 -->|不认可| R6["不修复,写反驳理由<br/>同一 Critical 连续 2 轮都不认可"]
    R6 --> R7a["终止条件5: 分歧未决<br/>停止循环,并列展示两轮发现与反驳"]
    R5 -->|认可| R8["修复(仅认可的 Critical + 必需依赖条目)"]
    R8 --> R9{无法安全修复?<br/>需业务决策/缺凭据/<br/>改变公开接口/信息不足}
    R9 -->|是| R9a["终止条件3: 无法安全自动修复<br/>停止循环,不做猜测性修改"]
    R9 -->|否| R10["本轮验证<br/>review-code: 测试/类型检查/构建<br/>review-plan: openspec validate"]
    R10 -->|失败| R10a["终止条件4: 修复后验证失败<br/>停止循环"]
    R10 -->|通过| R11{"同一 Critical 相邻两轮仍存在<br/>且上一轮当前会话认可过?"}
    R11 -->|是| R11a["终止条件2: 熔断<br/>停止循环"]
    R11 -->|否| R12{"连续 3 轮全部 Critical<br/>均判为同一大类系统性误判?"}
    R12 -->|是| R12a["终止条件6: 审查对象类型持续系统性误判<br/>停止循环,转人工"]
    R12 -->|否| R13{"达到全局轮数上限?<br/>(默认 5 轮)"}
    R13 -->|是| R13a["终止条件7: 达到轮数上限<br/>停止循环,附完整轮次轨迹"]
    R13 -->|否| R14["下一轮: codex exec resume session_id<br/>增量 TASK(上一轮 Critical 原文 + 路径清单)"]
    R14 --> R2
```

> 循环期间不提交；仅正常清零时统一提交一次。详细契约（session_id 提取、增量传递、终止条件八条、升级 codex 复核清单）见 [docs/codex-exec-contract.md](./docs/codex-exec-contract.md)。
