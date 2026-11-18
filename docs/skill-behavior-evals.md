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

全自动续跑场景 SHALL 单独验证：用户只确认一次执行模式后，阶段报告输出不能结束回合；propose、review-plan、apply 与 review-code 必须按 run-state 的下一流水线阶段连续执行，直到正常终态或明确人工介入条件。场景还应核对主 `SKILL.md` 注入内容自身包含续跑不变量，且 `run-state.md` 在方案自审前已经初始化，不能只依赖后续读取 reference 或自审完成后的补写。

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
pnpm eval:skills -- --case propose-full-auto --version current
pnpm eval:skills -- --case propose-self-review-full-auto --version current
pnpm eval:skills -- --version both --baseline-ref dce2466
```

可选参数：

- `--case propose|apply|review-plan|review-code|propose-full-auto|propose-self-review-full-auto`：只运行指定 case，可重复或逗号分隔。默认仍运行前四个基础场景；后两个是显式多阶段连续性场景。
- `--version baseline|current|both`：比较 `dce2466` 与当前工作树，默认 `both`。
- `--baseline-ref <git-ref>`：覆盖 baseline。
- `--output <dir>`：把每个单元和 `summary.json` 写入指定目录。
- `--keep-temp`：保留 fixture、临时 HOME 与 transcript 路径供排查。
- `--setup-only`：只构建 baseline source、fixture 和本地 skill，不调用模型。

每个 case/version 使用独立的临时 Git 仓库。基础场景安装被测命令自身的 skill bundle；`propose-full-auto` 安装 review-plan、apply、review-code 三个 bundle，并从 review-plan 中途恢复；`propose-self-review-full-auto` 从空仓库调用 propose，安装 propose、review-plan、apply、review-code 四个 bundle，验证 opsx artifacts 与方案自审都不会终止回合。child `HOME` 指向 fixture，`CODEX_HOME` 只用于复用当前认证；runner 不复制或提交 `auth.json`，报告不写完整环境。

状态语义：

- `passed`：最终 agent 文本满足该 case 的通过条件，且 fixture 副作用符合预期。
- `failed`：调用完成并产生最终文本，但通过条件、禁止条件或 fixture 副作用不满足。
- `not-executed`：命令缺失、认证/网络失败、超时、非零退出、最终文本为空或 JSONL 缺少完成事件；不得写成行为通过。

真实执行后，把 baseline/current 状态、关键摘要和结果文件引用回写到对应 `evals/skills/*.md` 的 `Evidence Record`。`propose-full-auto` 的 current 必须实际产生 apply commit、代码/测试文件、run-state `终止类型: normal`，最终文本含 review-code、0 Critical/未发现问题与正常终态锚点；只验证停在 review-plan→apply 不能记为通过。current 因认证、网络或 runner 环境失败时只能记 `not-executed`。

`propose-self-review-full-auto` 的 current 必须从空仓库生成 propose artifacts，并在同一个回合完成 propose 自审、context/metadata、propose commit、review-plan、apply 与 review-code；停在 opsx artifacts 或方案自审清单后均判 failed。
