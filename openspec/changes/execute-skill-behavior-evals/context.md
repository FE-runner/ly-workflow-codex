# Context

## 关键决策

- 评测 runner 是仓库维护工具，通过 `pnpm eval:skills` 显式运行，不新增用户可调用 `lyx-*` skill。
- baseline 使用 `dce2466` 的 skill bundle，current 使用当前工作树；同一 case 共用 fixture 和 prompt。
- 真实执行使用本机 `codex exec --json`，每个 case 在独立临时 Git 仓库中运行。
- child `HOME` 指向 fixture，使 skill 内的 `~/.codex/lyx/config.toml` 和角色路径隔离；`CODEX_HOME` 继承当前真实目录以复用认证。
- 通过条件只看少量关键行为 pattern 和 fixture 副作用，不比较完整文本；环境不可用与行为失败分开标记。

## 已否决方案

- 把 runner 放进普通 `pnpm test`：网络、认证与模型非确定性会污染默认测试。
- 直接用 shell 脚本生成 fixture：JSONL 解析、参数组合和清理逻辑容易失控。
- 复制真实 `auth.json` 到 fixture：违反凭据最小暴露原则。
- 首轮同时支持 Codex 与 Claude runner：会扩大范围，先用当前可用 Codex 证明评测链路。

## 范围边界

- 本轮只实际执行现有四个场景，不新增第五个场景。
- 本轮不根据失败自动修改 skill；失败先记录并转后续修复。
- 原始 transcript 不提交，仓库只保存精简报告。

## 已知坑

- `codex exec --ignore-user-config` 曾导致模型请求超时，因此 runner 使用真实 `CODEX_HOME` 配置，只隔离 `HOME`。
- 全局 `.agents/skills` 可能包含旧版 lyx；fixture HOME 和本地 skill 路径必须阻止误用。
- Agent 可能以提问结束而非主动执行；通过条件需接受“按规则正确停住”作为一种通过行为。

## 实施决策

- runner 直接复用 Codex 适配器渲染单命令 bundle，并给 `replaceHomePathsInTemplate` 增加可选 `homeDir`，确保 `~/` 指向 fixture HOME 而不是父进程 HOME。
- review-code case 单独使用 `reviewExecutor=subagent`：main 路径按既有契约不适用驳回硬线，subagent 路径才覆盖第二轮同一误报 Critical 的终止行为；其余三 case 保持 main。
- propose 的非交互通过边界改为“停在第一个未决问题（通常是隔离方式）且不写目标 change 目录”；模板本身按隔离方式 → 自动/手动顺序提问，单轮调用不要求一次问完。
- 正式评测前进行过两轮校准：修正 apply fixture 中占位实现已满足任务的漏洞，并放宽 review-plan/propose 对同义表达的 pattern；最终完整 8 单元为 8/8 passed。
