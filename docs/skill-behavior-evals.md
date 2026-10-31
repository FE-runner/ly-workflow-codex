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
