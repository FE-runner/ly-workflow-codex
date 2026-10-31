# Skill Behavior Evals

lyx skill 是流程代码，测试应包含两层：

1. 普通自动化测试，验证模板结构、渲染、安装和关键文本契约。
2. 行为评测，验证 agent 在真实压力场景中实际调用的工具、产生的文件、执行的命令和报告结论。

## 评测记录

每个场景必须在 `Evidence Record` 中记录：

- `基线`：不加载新版 skill 或使用旧版时的行为、关键输出和结论。
- `修改后`：加载新版 skill 后的行为、关键输出和结论。
- `未执行`：无法启动受测 agent 时记录“未执行”、原因和替代证据；未执行不等于通过。

推荐记录格式：

```text
Baseline: passed|failed|not-executed — <summary>
Modified: passed|failed|not-executed — <summary>
Evidence: <paths, commands, transcript refs>
```

## 压力场景要求

场景必须让 agent 采取行动，而不是回答规则问题。每个场景至少声明：

- 前置仓库与配置
- 用户请求
- 必须出现的工具动作或命令
- 禁止动作
- 预期产物或报告
- 通过条件

优先覆盖时间压力、沉没成本、权威指令、上下文压缩、脏工作区和真实失败输出。场景 SHALL NOT 只断言模板里存在某句文字。

## 高风险 Skill 门禁

修改 `propose`、`apply`、`review-plan`、`review-code` 的行为规则时：

1. 修改前运行受影响场景，记录基线。
2. 修改后运行同一场景，记录修改后结果。
3. 最终模板完成后再次运行，不得用中间证据替代。
4. 失败或未执行的结论写入 change 的 `run-state.md`，不能写成“测试通过”。

当前 `evals/skills/` 是人工可复跑资产，不进入用户安装命令面。

## 可执行 runner

仓库提供显式调用的内部 runner，不进入普通 `pnpm test` 或默认 CI：

```bash
pnpm eval:skills -- --help
pnpm eval:skills -- --case propose --version current
pnpm eval:skills -- --version both --baseline-ref dce2466
```

可选参数：

- `--case propose|apply|review-plan|review-code`：只运行指定 case，可重复或逗号分隔。
- `--version baseline|current|both`：比较 `dce2466` 与当前工作树，默认 `both`。
- `--baseline-ref <git-ref>`：覆盖 baseline。
- `--output <dir>`：把每个单元和 `summary.json` 写入指定目录。
- `--keep-temp`：保留 fixture、临时 HOME 与 transcript 路径供排查。
- `--setup-only`：只构建 baseline source、fixture 和本地 skill，不调用模型。

每个 case/version 使用独立的临时 Git 仓库，被测 skill 安装在项目本地 `.agents/skills/lyx-<command>/`。child `HOME` 指向 fixture，`CODEX_HOME` 只用于复用当前认证；runner 不复制或提交 `auth.json`，报告不写完整环境。

状态语义：

- `passed`：最终 agent 文本满足该 case 的通过条件，且 fixture 副作用符合预期。
- `failed`：调用完成并产生最终文本，但通过条件、禁止条件或 fixture 副作用不满足。
- `not-executed`：命令缺失、认证/网络失败、超时、非零退出、最终文本为空或 JSONL 缺少完成事件；不得写成行为通过。

真实执行后，把 baseline/current 状态、关键摘要和结果文件引用回写到四个 `evals/skills/*.md` 的 `Evidence Record`。
