# Propose Recovery And Evidence

## Run State

在 change 确定后创建 `openspec/changes/<change-name>/run-state.md`。读取 `{{LYX_CONFIG_FILE}}` 的 `[general].language`（缺失、空白或非法时按 `zh-CN`）：frontmatter 键名和技术枚举使用固定英文，Markdown 正文按语言配置使用中文或英文。后续阶段续写时沿用正文现有语言，不得无理由切换。

```md
---
lyx:
  schemaVersion: 1
  change: <change-name>
  stage: propose-self-review | propose | review-plan | apply | review-code | archive-ready | archived
  executionMode: full-auto | manual
  pipelineStage: review-plan | apply | review-code | none
  testModeDecision: normal | off | null
  isolation:
    mode: worktree | branch | none
    sourceBranch: <branch> | null
    developmentBranch: <branch> | null
    worktreePath: <absolute-path> | null
  lastGoodCommit: <sha> | null
  completedTasks:
    done: <number>
    total: <number>
  review:
    planRounds: <number>
    codeRounds: <number>
    terminationType: normal | <other> | null
  nextSafeAction:
    command: <command-id> | null
    skillPath: <relative-skill-path> | null
    change: <change-name> | null
    condition: <short-condition> | null
---

# 运行状态

## 任务证据

- 已完成任务: <done>/<total>

## 基线评测

- <skill>: passed|failed|not-executed — <summary>

## 修改后评测（中间）

- <skill>: passed|failed|not-executed — <summary>

## 修改后评测（最终）

- <skill>: passed|failed|not-executed — <summary>

## 审查状态

## 验证

## 裁决
```

- YAML frontmatter 是阶段、执行模式、测试模式、隔离、commit、任务计数、审查状态和下一步安全动作的唯一机器状态来源；Markdown 正文不得作为这些字段的第二权威来源。正文与 frontmatter 冲突时以 frontmatter 为准，并在报告中记录不一致。
- `context.md` 记录“为什么这样做”，run-state 记录“做到哪、证据是什么、下一步做什么”。
- run-state 作为 change artifact 纳入 propose 阶段 commit，不得用它替代 proposal/design/tasks。
- 任务、阶段和验证后增量更新；尚未归属统一 commit 时写“待本次阶段提交归属”，不得填不存在的 SHA。
- 执行模式在用户完成全自动/手动选择且 run-state 创建后立即写入 frontmatter；恢复时直接沿用该值，SHALL NOT 重复询问。
- 全自动模式下，`lyx.pipelineStage` 与 `lyx.nextSafeAction` 是阶段报告后的续跑依据。`nextSafeAction` SHALL 写明下一阶段命令、同级 skill 路径、change 参数和继续条件；坐标模糊时，SHALL 从当前阶段和 `reviewMode` 重建后再执行。
- 新 change 的 lyx 状态 SHALL NOT 写入 `.openspec.yaml`。旧 change 没有 YAML frontmatter 时 MAY 只读回退旧 `.openspec.yaml lyx`；frontmatter 存在但损坏、`lyx` 缺失或不是 mapping、`schemaVersion` 缺失或不受支持时 SHALL 停止，不得静默回退。
- 阶段正常完成且无未决业务决策时，报告只是中间状态；当前回合 SHALL 读取下一阶段同级 `lyx-<next-command>/SKILL.md` 及其全部 references 后继续，SHALL NOT 把命令标识或文字说明当作执行。

## Rulings

机械歧义可自行选择并立即记录：

```text
裁决：<选择>；理由：<依据>；如果判断错误：<代价与重做范围>
```

涉及产品语义、公开契约、安全或不可逆操作时停止询问，不得用机械裁决绕过。

## Evidence

完成声明必须引用本轮执行的命令、退出码和结果摘要。字符串测试通过不等于行为评测通过；行为评测未执行时写 `not-executed` 和原因。
