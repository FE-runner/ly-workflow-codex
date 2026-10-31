# Propose Recovery And Evidence

## Run State

在 change 确定后创建 `openspec/changes/<change-name>/run-state.md`，固定结构：

```md
# Run State

- Change:
- Stage:
- Source branch:
- Development branch:
- Last good commit:
- Next safe action:

## Task Evidence

- Completed tasks: <done>/<total>

## Baseline Eval

- <skill>: passed|failed|not-executed — <summary>

## Modified Eval (intermediate)

- <skill>: passed|failed|not-executed — <summary>

## Modified Eval (final)

- <skill>: passed|failed|not-executed — <summary>

## Review State

## Verification

## Rulings
```

- `context.md` 记录“为什么这样做”，run-state 记录“做到哪、证据是什么、下一步做什么”。
- run-state 作为 change artifact 纳入 propose 阶段 commit，不得用它替代 proposal/design/tasks。
- 任务、阶段和验证后增量更新；尚未归属统一 commit 时写“待本次阶段提交归属”，不得填不存在的 SHA。

## Rulings

机械歧义可自行选择并立即记录：

```text
Ruling: <选择>；理由：<依据>；如果判断错误：<代价与重做范围>
```

涉及产品语义、公开契约、安全或不可逆操作时停止询问，不得用机械裁决绕过。

## Evidence

完成声明必须引用本轮执行的命令、退出码和结果摘要。字符串测试通过不等于行为评测通过；行为评测未执行时写 `not-executed` 和原因。
