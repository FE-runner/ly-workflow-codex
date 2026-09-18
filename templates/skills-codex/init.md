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

由当前会话直接生成/更新项目根目录的 `AGENTS.md`（单 Agent 模式，无外部技能委托）：以 `参数`（项目摘要或名称）为线索，结合当前仓库结构，写清模块职责、入口与启动方式、核心类型、构建/测试命令、关键约定。已存在时增量更新，不推翻既有内容、不删除既有章节。

### 步骤 2：确保 OpenSpec 可用（共享检查/修复入口）

1. **调用共享 ensure 入口**（当前工作目录下执行，禁止 `cd` 到其他路径；不确定当前目录先 `pwd` 确认）：
   ```bash
   lycx openspec ensure --yes --json
   ```
   若 `lycx` 不在 PATH，则回退：
   ```bash
   npx -y ly-workflow-codex openspec ensure --yes --json
   ```
2. **解析 JSON 结果**：读取 `cli.status`、`skills.status`、`skills.missing`、`root.status`、`actions` 与 `executed`。
   - `skills.status === "global-only"`：输出 WARN 说明 skills 仅全局可用但命令可继续；不自动固化项目级。
   - `cli.status !== "ok"`、`skills.status === "missing"` 或 `root.status` 为 `missing` / `unhealthy` 且 ensure 后仍未修复：停止，展示缺失 skill 清单与 `openspec doctor --json` 的 fix 建议。
   - `root.status === "healthy"` 且 `skills.status` 为 `project-ready` 或 `global-only`：继续步骤 3。
3. **不要自行复制 workflow → skill 检测逻辑**。CLI、skills、root 的检查与修复统一由 `lycx openspec ensure` 负责。

### 步骤 3：提交初始化产物

```bash
git add -- AGENTS.md openspec/
git commit -m "chore: init AGENTS.md + openspec structure"
```

仅暂存本次初始化产生的文件（`AGENTS.md`、`openspec/`），不用 `git add -A`。若无可提交内容（两者均已存在且未变化）或 `git commit` 失败，跳过提交，在汇总中如实报告，不中断步骤 4。

### 步骤 4：汇总

```
📋 初始化结果
  AGENTS.md    ✓/✗
  openspec/    ✓/✗

接下来可以：
  @lyx-propose "描述你要做什么"   — 起一个change
  @lyx-explore                    — 想清楚再动手
```
