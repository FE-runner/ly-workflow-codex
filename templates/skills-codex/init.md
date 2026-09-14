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

### 步骤 2：初始化 OpenSpec

1. **检测 OpenSpec CLI**：
   ```bash
   openspec --version
   ```
2. **未安装则全局安装**：
   ```bash
   npm install -g @fission-ai/openspec@latest
   ```
3. **检查是否已初始化**：
   ```bash
   ls -la openspec/ 2>/dev/null || echo "Not initialized"
   ```
4. **未初始化则运行**（当前工作目录下执行，禁止 `cd` 到其他路径；不确定当前目录先 `pwd` 确认）——用 `--tools codex` 非交互指定 AI 工具为 Codex，避免卡在交互式选择上：
   ```bash
   openspec init --tools codex
   ```

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
