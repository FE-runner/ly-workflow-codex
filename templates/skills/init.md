---
name: lyx-init
description: '生成 AGENTS.md，初始化 OpenSpec 目录结构'
argument-hint: '<项目摘要或名称>'
---

# Init - 项目初始化

> 调用方式：`@lyx-init` mention 后跟随的自然语言即参数（如 `@lyx-init` 带需求描述/选项）；无参数时直接 `@lyx-init`。

两步初始化：生成/更新项目的 AGENTS.md 上下文文档，并搭建 OpenSpec 目录结构。

## 使用方法

```bash
@lyx-init <项目摘要或名称>
```

## 步骤

### 步骤 1：生成 AGENTS.md

{{HOST_FRAGMENT:memory-files}}

### 步骤 2：确保 OpenSpec 可用（共享检查/修复入口）

1. **调用共享 ensure 入口**（当前工作目录下执行，禁止 `cd` 到其他路径；不确定当前目录先 `pwd` 确认）：
   ```bash
   lycx openspec ensure --host {{HOST_ID}} --yes --json
   ```
   若 `lycx` 不在 PATH，则回退：
   ```bash
   npx -y ly-workflow-codex openspec ensure --host {{HOST_ID}} --yes --json
   ```
2. **解析 JSON 结果**：读取 `cli.status`、`skills.status`、`skills.missing`、`root.status`、`actions` 与 `executed`。
   - `skills.status === "global-only"`：输出 WARN 说明 skills 仅全局可用但命令可继续；不自动固化项目级。
   - `cli.status !== "ok"`、`skills.status === "missing"` 或 `root.status` 为 `missing` / `unhealthy` 且 ensure 后仍未修复：停止，展示缺失 skill 清单与 `openspec doctor --json` 的 fix 建议。
   - `root.status === "healthy"` 且 `skills.status` 为 `project-ready` 或 `global-only`：继续步骤 3。
3. **不要自行复制 workflow → skill 检测逻辑**。CLI、skills、root 的检查与修复统一由 `lycx openspec ensure` 负责；`--host` 限定只针对当前宿主检查与补齐（`--tools` 取值由宿主映射），不重建或清理另一宿主的 OpenSpec 产物。

### 步骤 3：提交初始化产物

```bash
MSG_FILE="$(git rev-parse --git-path COMMIT_EDITMSG)"
{{HOST_FRAGMENT:stage-files}}
# 先将完整 message 写入 "$MSG_FILE"：
# chore: init AGENTS.md + openspec structure
#
# - 动机：初始化项目上下文与 OpenSpec 目录结构
# - 改动：生成/更新 AGENTS.md，并初始化 openspec/
# - 影响：后续 propose/apply 可在该项目内使用 OpenSpec 流程
git commit -F "$MSG_FILE"
```

{{HOST_FRAGMENT:stage-scope}}

### 步骤 4：汇总

```
📋 初始化结果
  {{HOST_FRAGMENT:summary-memory}}
  openspec/    ✓/✗

接下来可以：
  @lyx-propose "描述你要做什么"   — 起一个change
  @lyx-explore                    — 想清楚再动手
```
