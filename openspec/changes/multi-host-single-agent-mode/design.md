# multi-host-single-agent-mode 设计

## Context

现状：installer 与 Claude Code 宿主强绑定——`installDir` 硬编码 `~/.claude`，命令模板（templates/commands/*.md）经 `injectConfigVariables` 渲染后复制到 `~/.claude/commands/ly/`，角色词在 `~/.claude/.ly/prompts/`，审查经 ly-wrapper 调外部 CLI。已验证前提：codex custom prompt 支持 `argument-hint` frontmatter 且参数进入模型上下文（~/.codex/prompts/opsx-*.md 同机制在用）；`codex exec -m/-p/resume` 可脚本化；codex 0.146.0。LyConfig（`~/.claude/.ly/config.toml`，config.paths.prompts 指向旧位置）。

## Goals / Non-Goals

**Goals:**
- HostAdapter 抽象：宿主差异（安装目标/渲染/卸载）接口化，claude 行为零回归收敛
- codex 单 Agent 模式落地：~/.codex/prompts/ 安装、单 Agent 版模板、review_model 渲染、exec 子会话审查循环
- prompts 位置中立化（~/.ly/prompts/）+ 存量迁移
- 菜单按宿主无关语义重组

**Non-Goals:**
- 不动 ly-wrapper、claude 侧命令行为、routing.reviewer/implementer 白名单与既有 spec 语义
- 不做多 Agent 并行编排（exec 子会话机制已为未来留位，本次仅审查一个子会话）
- 不做 profile（[profiles.x]）——`-m` 直传已覆盖同 relay 换模型需求
- codex 侧不做 Web UI / liteMode（claude 宿主专属）

## Decisions

### D-A: HostAdapter 接口最小化（4 成员）

`{ id, promptsTarget(ctx), renderTemplate(content, ctx), uninstallList(ctx) }`。安装主流程（遍历所选适配器 → copyMdTemplates → 渲染 → 写入）与宿主解耦。claude adapter 的 renderTemplate 即现有 injectConfigVariables；codex adapter 追加 REVIEW_MODEL 渲染。

**备选否决**：把渲染差异放进模板（{{#host}} 条件块）——模板复杂化，两套内容本就不同，分目录更直白。

### D-B: codex 版模板放独立目录 templates/commands-codex/

单 Agent 版命令模板独立成目录（14 个文件 + codex 专属 frontmatter `argument-hint`），经 codex adapter 渲染后写 `~/.codex/prompts/ly-*.md`。与 claude 版共享的编排语义以文案为准同步维护（两套文件，同源语义不同形态——本 change 已在 proposal 声明不软链的理由）。

### D-C: 单 Agent 审查循环机制

codex 版 review 命令的编排指示：首轮 `codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -` + stdin 任务（与 core.ts 已验证参数构造对齐：-C 指定工作目录、--json 出 JSONL 事件流、`-` 从 stdin 读 prompt；TASK 含 ROLE_FILE 绝对路径 ~/.ly/prompts/codex/reviewer.md + change 路径清单，agentic 自读）；SESSION_ID 提取规则确定性写入指示（JSONL 事件取 `session_id` 字段首现值）；第 2 轮 `codex exec -C "$WORKDIR" --json resume <session-id> -` 续聊。Critical 判定/修复由当前会话执行（同 claude 版循环语义）。tasks 1.1 实测该具体形态。

### D-D: prompts 迁移

LY_DIR 保持 `~/.claude/.ly/`（config 所在，不动）；prompts 写入点改为 `~/.ly/prompts/`（新常量 LY_PROMPTS_DIR）。init/update 时旧位置存在 → 移动到新位置 → 旧目录清理；installer 卸载按宿主分离：claude uninstall 不删 ~/.ly/prompts，codex uninstall 只删 ly-*.md 与自身产物。codex 侧角色词机制定案：不建软链，ROLE_FILE 一律绝对路径指向 ~/.ly/prompts/...（安装后校验目标存在）。

### D-E: 配置扩展

LyConfig 增 `codexHost: { reviewModel?: string }`。init 仅 codex/both 宿主时采集（列出 relay 已知模型提示 + 自由输入）；menu 模型路由入口增"审查模型（codex 宿主）"子项。

### D-F: preflight 宿主化时序

preflight 在入口主流程前执行而宿主选择在 init 向导内部（时序矛盾）的解法：默认动作与 menu 入口双侧都检测并按缺侧提示；init 入口的宿主化检测移到宿主选择步骤之后补检所选宿主侧。codex 侧 opsx prompt 缺失时的安装途径文案由 preflight 提示语静态给出。

## Risks / Trade-offs

- [codex custom prompt 传参的实际注入形态与假设不符] → 已用 opsx-*.md 现网验证 argument-hint + 参数入上下文；apply 实施时先做一个最小 /ly:explore 实测再批量装
- [双份命令模板语义漂移] → 单 Agent 版从 claude 版逐文件派生（删 wrapper/委托段落、改审查调用形态），review-plan 阶段让 codex 对照两套模板审一致性
- [prompts 迁移破坏存量用户审查流程] → 迁移在 init/update 内原子完成（旧→新→旧清理），模板重装同批次写入新路径；失败不静默（报告迁移结果）
- [menu 重组改错既有入口] → 重组仅动分组与文案，不动 handler；menu 测试补逐项断言

## Migration Plan

单分支一次实施。存量 claude 用户升级：prompts 自动迁移 + 模板重装（ROLE_FILE 新路径），行为零变化；codex 宿主为纯新增可选。回滚 = revert 分支。

## Open Questions

无——探索阶段账本全闭合（传参机制已实测验证）。
