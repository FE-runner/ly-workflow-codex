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
