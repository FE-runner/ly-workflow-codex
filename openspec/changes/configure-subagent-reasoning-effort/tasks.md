## 1. 候选构造与配置合并

- [ ] 1.1 新增推理档候选构造器（不覆盖哨兵 + `minimal` / `low` / `medium` / `high` / `max` + 自定义输入 + 既有值默认），并添加单元测试覆盖"无既有值默认不覆盖""既有自定义值作为候选并默认"；验证 `pnpm test` 对应用例通过
- [ ] 1.2 新增/抽取 `codexHost` 合并辅助逻辑：按采集结果写入推理档，显式 undefined 表示清除对应字段，同时保留 `codingModel` / `spawnableModels` 等未触碰字段；添加单元测试覆盖"已有值 + undefined → 字段移除""已有值 + 新值 → 覆盖""其他 extras 保留"；验证 `pnpm test` 对应用例通过

## 2. init 向导采集

- [ ] 2.1 扩展 `CodexHostCollected` 与 `defaultCollected`，纳入 `reviewReasoningEffort` / `codingReasoningEffort`；执行者为 `subagent` 时在对应模型采集后追加推理档覆盖选择（自定义输入留空等价"不覆盖"），执行者为 `main` 时保留既有推理档值不采集；验证 `pnpm typecheck` 通过且候选/合并单测覆盖该数据流
- [ ] 2.2 交互 `lycx init` 写回改用新的合并辅助逻辑，确保选择"不覆盖"时清除既有字段，非交互 `--skip-prompt` / update 保留原值；验证相关单元测试通过并检查写回配置字段形态
- [ ] 2.3 配置摘要展示每个 subagent 的推理档状态（不覆盖 / 已覆盖: 值）；执行者为 `main` 时标注"主 agent 执行时不生效"；验证 `pnpm typecheck` 通过且摘要文案与 spec 用语一致

## 3. 菜单与文案

- [ ] 3.1 `lycx` 菜单"配置审查模型"在 `reviewExecutor = "subagent"` 时追加 `reviewReasoningEffort` 覆盖选择，显式"不覆盖"清除该字段，未触碰时保留，且不影响 coding 与 spawnableModels；同步把"模型与执行者都没变"的提前 return 判定纳入推理档选择变化（只改/清空推理档也必须写回）；验证菜单写回路径复用合并辅助逻辑并补必要测试
- [ ] 3.2 补齐 zh-CN / en i18n：推理档候选、覆盖提示、摘要文案、现状检测提示改为"向导可采集覆盖/不覆盖"；验证 `pnpm typecheck` 通过且不再存在"向导不采集推理档"的旧文案

## 4. doctor 与文档

- [ ] 4.1 更新 doctor 推理档展示文案为"未覆盖（继承模型/宿主默认）"与"已覆盖: <值>"，同步更新 `doctor.test.ts` 断言；验证 `pnpm test` 通过
- [ ] 4.2 更新 `README.md`、`CLAUDE.md`、`AGENTS.md` 中"向导不采集推理档 / 维护方式 = 手改"的旧描述，改为交互配置入口可覆盖或不覆盖、非交互保留原值；验证文档描述与 delta spec 一致

## 5. 验证

- [ ] 5.1 运行 `pnpm typecheck && pnpm test && pnpm build`，验证全部通过且无模板渲染回归
