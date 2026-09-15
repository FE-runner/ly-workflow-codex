# multi-host-single-agent-mode — 多宿主单 Agent 编排架构

## Why

ly-workflow v2.x 的编排层与 Claude Code 宿主强绑定（/ly:* 装在 ~/.claude/commands/、审查经 ly-wrapper 调外部 CLI）。用户日常主用 codex CLI，希望在不破坏现有 Claude Code 双角色工作流的前提下，新增一个 codex 单 Agent 模式（宿主内自己 propose/review/apply，模型靠切换区分角色），并把 installer 抽象为多宿主架构——未来其他宿主加适配器即可接入。已验证前提：~/.codex/prompts/ 的 custom prompt 支持 argument-hint 传参（opsx-* 同机制在用）；codex exec 支持 -m/--profile/resume（验证时点 codex-cli 0.154.0）。

## What Changes

- **新增 HostAdapter 宿主抽象**：installer 收敛出适配器接口（promptsTarget / renderTemplate / uninstallList），现有 claude 安装行为收敛为实现该接口的 claude adapter（行为不变）；新增 codex adapter
- **新增 codex 单 Agent 模式安装**：14 个命令的单 Agent 版模板安装到 `~/.codex/prompts/ly-*.md`（codex custom prompt 形态，argument-hint frontmatter）；编排契约：propose → review（`codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -` 独立子会话审查）→ Critical 判定/修复循环（codex resume 续聊）→ apply（当前会话自实施）；无 wrapper、无 OVERALL 解析、无 routing.implementer
- **init 向导增加宿主选择步骤**：claude（现有）/ codex（新增）/ both；`installDir` 参数化，选 both 时双侧都装（共享 prompts 与 LyConfig）
- **prompts 角色词位置中立化**：`~/.claude/.ly/prompts/` → `~/.ly/prompts/`——installer 写入点与引用路径更新；命令模板中 `ROLE_FILE: ~/.claude/.ly/prompts/...` 全量改为 `~/.ly/prompts/...`；codex 侧 ROLE_FILE 以绝对路径指向中立位置（不建软链）；legacy-cleanup 补旧位置清理；卸载按宿主分离（卸 claude 不再连带 prompts）
- **命令模板本体不软链**（决策保留）：双宿主模板内容本就不同，且模板变量安装期渲染、源路径随 npx 缓存漂移
- **menu 重组**：Claude Code 独立组解散并入"工作流"组（1.初始化 / 2.更新 / 3.配置API / 4.模型路由 / D.显示设置）；其他工具组新增"X. 安装 Codex"；模型路由入口在双宿主语义下同时管理 review_model（codex）与 routing.reviewer（claude）
- **实施前复核传参机制**：以最小 test prompt 在 codex TUI 实测参数注入形态与编排指示假设一致（探索阶段已用 opsx-*.md 现网佐证，apply 前置任务 1.1 再实测一次），不符则调整模板形态后再继续
- **新增配置字段**：`codexHost.reviewModel`（init/menu 采集，渲染进 codex 版审查命令模板的 `-m` 参数）
- **保持不变**：ly-wrapper 全套、claude 侧 14 命令行为、全部既有 spec 语义不变

## Capabilities

### New Capabilities

- `host-adapters`: installer 多宿主适配器契约——HostAdapter 接口（安装目标/模板渲染/卸载清单）、claude 与 codex 两个实现的注册方式、宿主选择（claude/codex/both）对安装流程的影响
- `codex-single-agent-mode`: codex 单 Agent 模式的端到端契约——单 Agent 版命令安装到 ~/.codex/prompts/、review_model 配置与 `codex exec -m` 渲染、审查循环（独立子会话 + resume 续聊）、apply 当前会话自实施、prompts 中立位置依赖

### Modified Capabilities

- `installer-preflight-checks`: preflight 检查在 codex 宿主语义下的适配（CLI 检测目标新增 codex 分支）——逐条对照基线后在 delta 中明确波及面
- `review-display-mode`: liteMode/Web UI 选项为 claude 宿主专属，codex 宿主下 init 步骤跳过该问（选 both 时仅对 claude 侧生效）——delta 明确

## Impact

- `src/utils/installer.ts`（HostAdapter 重构 + codex 安装分支）、`src/utils/preflight.ts`（技能检测宿主化）、新增 `src/utils/host-adapters.ts`、`src/commands/init.ts`（宿主选择步骤）、`src/commands/menu.ts`（重组 + X.安装 Codex）、`src/utils/installer-template.ts`（codex 渲染分支 + ROLE_FILE 路径更新）、`templates/commands-codex/`（新增单 Agent 版命令模板目录）、`src/utils/legacy-cleanup.ts`（旧 prompts 位置清理）、根 CLAUDE.md / README、vitest
- 配置：LyConfig 增 `codexHost.reviewModel`；paths.prompts 更新为 ~/.ly/prompts/（含存量迁移）
- 版本：minor bump（feature 新增，非 BREAKING——claude 宿主行为不变）
