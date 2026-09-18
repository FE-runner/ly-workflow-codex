---
name: lyx-archive
description: '归档前先执行项目完整验证（测试/类型检查/构建），通过后按 opsx:archive 编排流程归档完成的 change，完成后 commit'
argument-hint: '[<change-name>]'
---

# Archive

> 调用方式：`@lyx-archive` mention 后跟随的自然语言即参数（如 `@lyx-archive` 带需求描述/选项）；无参数时直接 `@lyx-archive`。

按 `@openspec-archive-change skill`（opsx archive 编排 prompt）定义的流程归档指定 change（`参数` 未指定时按 opsx:archive 流程的默认规则确定目标）。

## 归档前完整验证（SHALL，先于任何归档动作）

在委托 OpenSpec 归档流程**之前**，对当前工作区执行一次项目完整验证，覆盖测试 / 类型检查 / 构建三类：

- 按项目实际提供的脚本选择（例如 `package.json` 的 `scripts.test` / `scripts.typecheck` / `scripts.build`，或项目 README/AGENTS.md 声明的等价命令）。
- 项目未提供的类别 SHALL 跳过并在报告中注明（例如"未提供 typecheck 脚本"），SHALL NOT 因缺失判定失败。
- 全部通过才继续；任一类别失败 SHALL 停止归档，**不移动** `openspec/changes/<change-name>/`，如实报告失败的脚本与原始错误输出。

该验证是慢验证的**唯一执行点**：审查关卡（`@lyx-review-plan` / `@lyx-review-code`）SHALL NOT 重复执行测试 / 类型检查 / 构建（`openspec validate` 仍由 review-plan 每轮执行，不属于本步范围）。

## 提交归档改动

归档会把 `openspec/changes/<change-name>/` 移动到 `openspec/changes/archive/`，并可能同步更新 `openspec/specs/`。提交涉及的全部文件：

```bash
git add -- openspec/
# 先将完整 message 写入 .git/COMMIT_EDITMSG：
# chore(openspec): 归档 <change-name>
#
# - 动机：完成 <change-name> 的归档收尾
# - 改动：移动 change 目录并同步 openspec/specs
# - 影响：归档后的 change 不再作为活跃 change
#
# Change-Stage: archive
# Change-Name: <change-name>
git commit -F .git/COMMIT_EDITMSG
```

message 采用 Conventional Commits 前缀 + 正文 + trailer 结构：先按 `@lyx-commit` 规范写入完整 message，CC 前缀固定 `chore(openspec)`，正文包含动机/改动/影响，末尾带 `Change-Stage: archive` 与 `Change-Name: <change-name>` trailer。

若无可提交内容或 `git commit` 失败，跳过提交，如实报告原始错误，不视为归档失败。
