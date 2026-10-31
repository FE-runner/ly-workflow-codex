## Why

上一阶段已经建立 `evals/skills/` 场景和 `run-state.md` 证据格式，但四个核心场景仍全部是 `not-executed`。因此目前只能证明模板结构和安装产物正确，不能证明 agent 在真实压力场景下会按新规则询问、停止、裁决并记录证据。现在应把手工场景变成可复跑的 Codex runner，并以改动前 `dce2466` 与当前实现做真实对比。

## What Changes

- 新增内部 `pnpm eval:skills` 运行器：按 case 创建独立临时 Git 仓库，安装目标版本的本地 skill bundle，隔离 HOME，调用 `codex exec --json`，保存 agent 最终输出、退出码和通过/失败判定。
- 为 propose、apply、review-plan、review-code 四个已有场景补齐可执行 fixture、用户 prompt、通过条件和不适用原因。
- 支持 `--case`、`--version baseline|current|both`、`--baseline-ref`、`--output` 参数；默认只在显式调用时运行，不进入普通 `pnpm test` 或 CI。
- 默认 baseline 使用 `dce2466`（Superpowers 改动前），current 使用当前工作树；两边使用相同 fixture 和 prompt，仅 skill bundle 不同。
- 实际运行 8 次评测（4 场景 × 2 版本），生成仓库内精简报告，记录命令、环境、通过/失败、关键证据和失败原因；原始 transcript 存临时目录，不提交凭据或完整环境输出。
- 更新 `docs/skill-behavior-evals.md`、`evals/skills/README.md` 和相关测试，说明可复跑命令与判定格式。
- 不新增用户可调用 `lyx-*` skill，不改变安装后的 15 个命令、运行配置或工作流语义。

## Capabilities

### New Capabilities

### Modified Capabilities
- `skill-behavior-evals`: 增加可执行 runner、baseline/current fixture 对照、真实 Codex 调用和持久化证据报告要求。

## Impact

- 新增 `src/evals/` runner 与 case 定义、`pnpm eval:skills` 脚本和对应测试。
- 更新评测文档、场景文件与 `evals/results/` 报告。
- 运行评测时会创建和清理临时 Git 仓库、HOME 与输出目录；不修改用户现有仓库或安装目录。
- 运行成本高于普通单测，因此保持显式执行，不进入默认 CI/`pnpm test`。
