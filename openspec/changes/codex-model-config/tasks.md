## 1. 类型与配置域（常量 + 清洗）

- [ ] 1.1 `src/types/index.ts`：`LyConfig.codexHost` 增加 `spawnableModels?: string[]`，验证 `pnpm typecheck` 通过
- [ ] 1.2 `src/utils/config.ts`：新增 `SPAWNABLE_MODELS_DEFAULT`（gpt-6-astra / gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna / gpt-5.5）、`sanitizeSpawnableModels`（仅字符串数组、trim、去重、空→undefined）、`resolveSpawnableModels`（配置或默认），验证新增单测覆盖清洗/回退三态（未配置/空数组/非法混合）
- [ ] 1.3 `createDefaultConfig`/`readLyConfig` 透传并保全 `spawnableModels`，验证写读往返保留原值

## 2. Codex 现状读取（静态）

- [ ] 2.1 `src/utils/codex-provider.ts` 新增 `readCodexCurrentModel()`（config.toml 顶层 `model`，解析失败→undefined）与 `readModelsJson()`（`~/.codex/models.json`，失败→[]），验证单测覆盖缺文件/坏 JSON/正常
- [ ] 2.2 确认不引入新依赖、不读敏感字段（API key 不进入返回值），验证单测断言返回结构不含 envKey/key

## 3. init 向导改造

- [ ] 3.1 `collectCodexHostConfig`：provider 步骤后新增"Codex 现状检测"只读展示块（主模型/provider 条目/注册模型数，失败标注未检测到、不阻断），验证手工运行交互 init 出现检测块
- [ ] 3.2 模型三连候选改为 `留空（默认继承当前会话模型）+ resolveSpawnableModels()`；删除 `pickModelField` 的 CUSTOM 哨兵与 `inputModelField` 自由输入回退、不再调用 `fetchCodexModels`，验证候选不再含 provider `/models` 内容且无自由输入
- [ ] 3.3 既有值非空且 ∉ 清单时候选附加"保留当前值 `<v>`（不在可用列表，警告）"并默认该项，验证确认后原值写回、不静默替换
- [ ] 3.4 写回保留 `reviewModelB`/`codingModel`/`spawnableModels`（交互与非交互两条路径），验证 update 后原值不丢

## 4. menu 审查模型编辑

- [ ] 4.1 `configReviewModel` 由自由 input 改为 list（同一候选/默认语义），写回同时保留 `spawnableModels`，验证 `pnpm test` 中 menu 相关用例与手工菜单编辑

## 5. doctor 检查项

- [ ] 5.1 `doctor()` 新增第 7 项"Codex 子代理模型配置"（留空=OK/∈=OK/∉=FAIL 附修配指引，detail 展示生效清单），验证三态单测或手工：清空配置→OK、`reviewModel=gpt-5.6-luna`→OK、`reviewModel=deepseek-v4-flash`→FAIL

## 6. 模板注入与运行时校验规则

- [ ] 6.1 `installer-template.ts` 新增 `{{SPAWNABLE_MODELS_DEFAULT}}` 占位渲染（注入默认列表文本，签名扩展传配置），验证安装产物含该占位替换结果
- [ ] 6.2 `templates/skills-codex/review-plan.md`/`review-code.md`/`apply.md` 模型指示段补"模型可用性校验"规则（运行时读取 `[codexHost] spawnableModels` 校验：∉ → 明确报配置无效停止该关卡转人工、不回退；留空 → 继承回退；spawn 失败含 `Available models:` 如实展示），验证渲染后三模板含规则文本且无占位残留

## 7. 文案与文档

- [ ] 7.1 `src/i18n/index.ts` zh-CN/en 补齐现状检测、候选哨兵（留空/保留当前值警告）、doctor 检查文案，验证 `pnpm test` i18n 用例
- [ ] 7.2 `README.md`/`CLAUDE.md` 同步 `spawnableModels` 字段与"候选 = 留空 + 可 spawn 清单"语义，验证文档无版本残留引用

## 8. 全量验证

- [ ] 8.1 `pnpm typecheck && pnpm build && pnpm test` 全绿
- [ ] 8.2 端到端手工过一遍：`lycx init`（现状检测+候选选择）→ 配置合法模型 → `lycx doctor` 该项 OK；配置清单外模型 → doctor FAIL 且提示修配
