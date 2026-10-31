## Context

See `proposal.md - Why`. Existing `evals/skills/*.md` define scenario intent but have no executable fixtures. The repository already has `tsx`, a Codex CLI on PATH, and current `codex exec --json` support. Running real agent calls is unsuitable for ordinary unit tests because it is networked, nondeterministic and materially slower.

## Goals / Non-Goals

**Goals:**

- 用同一 fixture/prompt 对比 `dce2466` baseline 与当前工作树的真实 agent 行为。
- 生成可复跑的 8 个 case/version 结果，并留下可审计但不含凭据的精简报告。
- 让失败环境、调用超时和行为失败三种状态可区分。
- 保持用户安装命令、15 个 skill 和运行时配置不变。

**Non-Goals:**

- 不把评测放进默认 CI 或 `pnpm test`。
- 不引入新的公共 CLI 子命令或 `lyx-*` skill。
- 不自动修改被测 skill；发现行为失败后由后续明确修复任务处理。
- 不支持首个版本中的 Claude Code runner；本轮真实执行以当前可用 Codex CLI 为宿主。

## Decisions

### D1：runner 位于 `src/evals/`，由 `pnpm eval:skills` 显式调用

使用 TypeScript + `tsx`，复用 `src/hosts/codex` 适配器和 `src/utils/installer-template` 的渲染/引用解析逻辑。case 定义也放在 `src/evals/cases.ts`，以便静态测试校验每个 case 必备字段。这样无需新增依赖，并受现有 typecheck/lint 覆盖。

替代方案是独立 shell 脚本，但 fixture 生成、JSONL 解析和 per-case 判定会快速变得脆弱；替代方案是 Vitest 集成测试，但会污染普通测试的确定性和耗时。

### D2：baseline 与 current 使用临时 Git worktree/source tree

baseline 通过 `git worktree add --detach <tmp> <baseline-ref>` 提取完整模板源；current 默认使用当前工作树。runner 从各自 `templates/` 渲染只需要的命令 bundle，因此能比较 old single-file skill 与 current references bundle。`dce2466` 没有 `templates/skill-references/`，因此 baseline 允许在该目录缺失且模板未声明 required references 时安装单文件 bundle；current 必须渲染其声明的全部 references 并校验完整。runner 提供 `--setup-only`，用于只构建 fixture/source/skill 而不调用模型，支持确定性静态验证和故障排查。

fixture 每个 case/version 使用独立临时 Git 仓库；不修改用户工作区。

### D3：隔离 HOME，保留真实 CODEX_HOME 认证

child 环境使用 fixture `HOME`，使 skill 中的 `~/.codex/lyx/config.toml` 和角色路径落在 fixture；`CODEX_HOME` 显式继承当前真实值，以复用认证和模型配置。runner 渲染 skill bundle 时也必须把 fixture HOME 作为 `~/` 的展开目标，不得依赖父进程 `homedir()`；静态测试须断言安装后的审查 skill 指向 fixture 下的角色词绝对路径。runner 不读取或复制 `auth.json` 内容，不把 HOME、token 或完整环境写进报告。

### D4：通过 `codex exec --json` 调用并解析最终 agent message

每个单元：

```bash
codex exec --json --ephemeral \
  --skip-git-repo-check \
  -C <fixture> \
  -s workspace-write \
  -c approval_policy="never" \
  --output-last-message <tmp/final.txt> \
  <prompt>
```

runner 从 `--output-last-message` 读取最终文本，解析 JSONL 中的事件数量/turn status 作为环境证据。命令缺失、认证/网络失败、调用超时、非零退出或最终文本为空时标记 `not-executed`；只有调用完成且最终文本存在时，才用 case 的 `passPatterns` 与 `forbiddenPatterns` 判定 `passed` 或行为 `failed`。

### D5：case fixture 使用代码生成

四个 case 分别构造：

- `propose`：main checkout + 与 change 目录重叠的 dirty file。skill 按隔离方式 → 自动/手动模式顺序提问；`codex exec` 是非交互单轮调用，正确停在第一个未决问题（通常是隔离方式）且未写入目标 change 目录即视为本场景通过，不要求同一段输出问完两项，也不要求后续确认或 propose commit。
- `apply`：run-state/task/git 不一致，要求识别 partial apply 并停止。
- `review-plan`：接口未定义、任务缺验证命令，要求 finding 提到可执行性缺口。
- `review-code`：已提交 apply commit，上层已有统一异常捕获证据；fixture 使用 `reviewExecutor=subagent`（main 路径明确不适用驳回硬线），并预置第一轮 `run-state.md` 与第二轮审查报告输入，两者包含逐字相同的误报 Critical 原文，第一轮还包含主会话驳回依据。本轮要求给出可核验裁决，并在该 Critical 第二轮仍出现时触发驳回硬线，不依赖被测 agent 随机生成审查发现。

fixture 文件由 case 的 `setup()` 写入临时仓库，避免维护多份重复 fixture 目录。

### D6：报告提交，原始 transcript 不提交

runner 默认把 transcript/最终输出写到临时输出目录；实际运行后手工生成 `evals/results/2026-10-31.md`，只保留每个 case 的状态、关键 token/pattern 证据和失败摘要。避免将大段 agent 输出或环境相关路径提交仓库。

## Risks / Trade-offs

- [真实 agent 输出非确定] → case 使用少量行为关键 pattern + 文件副作用，不比较全文；每行保留 final output 摘要供人工审计。
- [网络或认证波动] → 单次超时限定，环境失败标记 `not-executed`，不记作行为失败。
- [prompt 引导过强导致测试失真] → prompt 只提供场景与本地 skill 路径，不直接告诉 agent 期望动作；通过条件留在 runner。
- [运行成本高] → 默认不跑、不进 CI，支持按 case 运行。
- [HOME 隔离影响 Codex] → 显式继承 `CODEX_HOME`，保留认证与模型配置；失败时记录环境状态而非假装通过。

## Migration Plan

新增 dev-only runner 和 npm script，不影响安装产物。移除或修改 runner 不影响已安装的 15 个 skill；回滚只需删除 runner、script、tests 与报告文件。
