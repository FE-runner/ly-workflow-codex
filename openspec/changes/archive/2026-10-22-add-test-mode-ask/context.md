# 方案软上下文

## 已确认决策

- 新增 `testMode = "ask"`；配置层可取 `normal` / `off` / `ask`，最终测试义务仍只有 `normal` / `off`。
- 选择粒度为每个 change 生命周期只询问一次。回答保存在 `.openspec.yaml` 的 `lyx.testModeDecision`，后续 apply/review/archive 沿用。
- 配置 normal/off 是显式最终值，优先于历史 change 决策；配置为 ask 时才读取或补写 change 决策。
- `@lyx-fix` 不创建 change 元数据，因此 ask 下每次调用询问一次，不持久化。
- 用户取消或环境无法交互时停止，不默认选择 normal/off。

## 否决方案

- 每次命令都重复询问：会在 propose/apply/review/archive 间产生不一致测试策略。
- 把决策放 `context.md` 或独立文件：绕开 change 的唯一元数据载体，增加双份生命周期状态。
- 历史决策永久覆盖配置：会让项目级 normal/off 无法修正旧 change；改为配置优先。
- 为 fix 创建隐藏状态文件：破坏 fix 不创建 change/元数据的轻量边界。

## 范围边界

- 做：三取值配置、CLI/init/menu/doctor/status、change 元数据决策、propose/apply/review/archive 消费、fix 每次询问、测试与双语文档。
- 不做：测试以外的 ask 配置、跨 change 共享回答、为 fix 持久化决策、清理历史 `testModeDecision`、新增 YAML 运行时依赖。

## 已知坑与注意

- propose 必须在生成 artifacts 前询问，但只能在真实 change 名确定后写 `.openspec.yaml`；两者之间需在会话内保留选择。
- review-plan / review-code 若为 ask 写入决策但无其他修复，仍需提交仅含 `.openspec.yaml` 的实际变更。
- 决策写入后立即生效；正常成功路径必须提交，但 propose 中断、review `--no-commit`、非清零终止或 commit 失败时允许 dirty 保留并报告，后续恢复可复用该磁盘决策。
- apply 的待提交清单必须并入 `.openspec.yaml`；archive 的 `git add -- openspec/` 天然覆盖。
- 写 YAML 时只增改 `lyx.testModeDecision`，保留其他 `lyx` 字段与文件其他内容。
- `.openspec.yaml` 整体不可读或解析失败时停止，不得当作字段缺失覆盖。
- 文件缺失按决策缺失并允许创建；`lyx` 非 mapping 或 decision 为 object/list/number 时结构非法，停止人工修复；`null` 视为缺失。
- apply 在最终 normal 覆盖历史 off/补问 normal，但 artifacts 未按 normal 规划测试时必须停止，不得临时加范围外测试。
- `ask` 本身不是测试最终模式；任何模板或角色词都不得把 ask 直接按 normal/off 判级。

## 实施决策

- `ask` 已扩展到 `TestMode`、`TEST_MODES`、`HostAdapterConfig.testMode`、init/menu 候选、project CLI、doctor 与双语文案。
- 元数据决策由模板运行时按文件编辑协议维护，不新增 YAML 依赖；缺失文件允许创建，`lyx` 非 mapping 或 decision 非 string/null 时停止。
- review 主会话先解析 final mode，并在 TASK 中显式传给审查 subagent；角色词不再自行推断 ask。
- 正常清零提交范围包含本轮新写或继承且实际消费的 `.openspec.yaml`；`--no-commit`、非清零、commit 失败允许 dirty 保留并复用。
- 新增 `project-config.test.ts` 验证 ask 项目覆盖、非法覆盖回退、宿主非法回退 normal 与配置不可读停止。
- 验证结果：`pnpm test` 415 passed、`pnpm typecheck`、`pnpm build`、`openspec validate --changes add-test-mode-ask --strict`、CLI ask smoke 全部通过。
