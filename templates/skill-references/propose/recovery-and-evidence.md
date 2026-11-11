# Propose Recovery And Evidence

## Run State

在 change 确定后创建 `openspec/changes/<change-name>/run-state.md`。读取 `{{LYX_CONFIG_FILE}}` 的 `[general].language`（缺失、空白或非法时按 `zh-CN`）：`zh-CN` 使用下面中文骨架，`en` 使用等价英文标题和字段。后续阶段续写时沿用 `run-state.md` 现有语言，不得无理由切换。

```md
# 运行状态

- 变更名:
- 阶段:
- 源分支:
- 开发分支:
- 执行模式: full-auto | manual
- 流水线阶段:
- 最后成功 commit:
- 下一步安全动作:

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

- `context.md` 记录“为什么这样做”，run-state 记录“做到哪、证据是什么、下一步做什么”。
- run-state 作为 change artifact 纳入 propose 阶段 commit，不得用它替代 proposal/design/tasks。
- 任务、阶段和验证后增量更新；尚未归属统一 commit 时写“待本次阶段提交归属”，不得填不存在的 SHA。
- 执行模式在用户完成全自动/手动选择后立即写入；恢复时直接沿用该值，SHALL NOT 重复询问。
- 全自动模式下，`流水线阶段` 与 `下一步安全动作` 是阶段报告后的续跑依据。阶段正常完成且无未决业务决策时，报告只是中间状态，当前回合 SHALL 继续下一阶段。

## Rulings

机械歧义可自行选择并立即记录：

```text
裁决：<选择>；理由：<依据>；如果判断错误：<代价与重做范围>
```

涉及产品语义、公开契约、安全或不可逆操作时停止询问，不得用机械裁决绕过。

## Evidence

完成声明必须引用本轮执行的命令、退出码和结果摘要。字符串测试通过不等于行为评测通过；行为评测未执行时写 `not-executed` 和原因。
