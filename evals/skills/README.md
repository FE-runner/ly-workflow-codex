# lyx Skill Evals

本目录保存核心流程 skill 的压力场景。

| Skill | 场景文件 | 目标 |
|---|---|---|
| `propose` | `propose.md` | 脏工作区与重叠改动、自审和 change 提交 |
| `apply` | `apply.md` | 歧义任务、执行证据和 run-state 恢复 |
| `review-plan` | `review-plan.md` | 缺少可执行信息的方案审查 |
| `review-code` | `review-code.md` | 误报 Critical 的可核验裁决 |

每个文件都包含固定六段：`Preconditions`、`User Prompt`、`Required Evidence`、`Forbidden Actions`、`Pass Criteria`、`Evidence Record`。

执行顺序见 `docs/skill-behavior-evals.md`：先基线，再修改后，最后最终模板复跑。

可执行入口：

```bash
pnpm eval:skills -- --case propose --version current
pnpm eval:skills -- --version both --baseline-ref dce2466 --output /tmp/lyx-skill-evals
```

runner 在独立临时仓库与 fixture HOME 中安装 skill 并真实调用 Codex；状态分为 `passed` / `failed` / `not-executed`。真实执行后，各场景文件的 `Evidence Record` 必须写回 baseline、current 和结果文件引用。
