## 1. 配置契约与清洗

- [ ] 1.1 在 `src/types/index.ts` 的 `LyConfig.codexHost` 增加 `reviewReasoningEffort`、`reviewReasoningEffortB`、`codingReasoningEffort` 三个可选字符串字段及对应注释，验证 `pnpm typecheck` 通过。
- [ ] 1.2 在 `src/utils/config.ts` 增加推理档文本清洗入口，并在 `createDefaultConfig` 的入参类型、清洗、`codexHost` 条件构造中接入三个字段；空值省略、非空值 trim 保留，只有推理档有值时也允许生成 `codexHost`，验证新增单测通过。
- [ ] 1.3 在 `src/utils/config.ts` 增加 `sanitizeCodexHostExtras(codexHost)`，统一清洗并返回 `reviewModelB`、`codingModel`、`spawnableModels` 与三个推理档字段（不含被编辑的 `reviewModel`）；验证其输出可供 init/menu 直接展开且不改写 `spawnableModels` 原形态。
- [ ] 1.4 在 `src/utils/__tests__/config.test.ts` 覆盖三字段同时写入、单字段写入、空白清洗、与其他 `codexHost` 字段并存、`sanitizeCodexHostExtras` 保留全部其余字段及 round-trip 读取，运行 `pnpm vitest run src/utils/__tests__/config.test.ts` 验证通过。

## 2. CLI 重写路径与诊断

- [ ] 2.1 在 `src/commands/init.ts` 用 `sanitizeCodexHostExtras(existingConfig?.codexHost)` 把既有三个推理档字段与 `spawnableModels` 一同透传给 `createDefaultConfig`，并在 `src/i18n/index.ts` 更新 `init:codexStatus.reasoningHint` 文案指向 `[codexHost]` 维护入口；通过 1.4 的 helper 单测验证保留语义。
- [ ] 2.2 在 `src/commands/menu.ts` 的审查模型写回路径中用 `sanitizeCodexHostExtras(fresh.codexHost)` 保留三个推理档字段，确保仅编辑 `reviewModel` 时不会被清除；通过 1.4 的 helper 单测验证保留语义。
- [ ] 2.3 在 `src/commands/doctor.ts` 扩展子代理模型配置判定结果，在每条模型字段旁展示对应推理档值或“未配置”，且推理档不改变 OK/WARN 判定；在 `src/i18n/index.ts` 同步 zh-CN/en 文案，验证 `src/commands/__tests__/doctor.test.ts` 通过。
- [ ] 2.4 更新 `README.md`、`CLAUDE.md`、`templates/CLAUDE.md`，写明三字段名称、非空传入/空白不传语义、手改配置维护方式及不做枚举强校验；验证文档中三字段名称与实际类型、doctor 文案一致。

## 3. 模板执行指示

- [ ] 3.1 在 `templates/skills-codex/review-plan.md` 与 `review-code.md` 的 spawn 指示中补充：agent A 读取 `reviewReasoningEffort`，agent B 读取 `reviewReasoningEffortB`，仅在非空时把值作为宿主 `reasoning_effort` 随对应模型传入；明确禁止模型名到档位的硬编码映射，并沿用 spawn 失败原样报告口径。
- [ ] 3.2 在 `templates/skills-codex/apply.md` 的 coding subagent spawn 指示中补充：仅当 `codingReasoningEffort` 非空时把值作为宿主 `reasoning_effort` 随 `codingModel` 传入；空白不传，报错原样展示。
- [ ] 3.3 更新 `src/utils/__tests__/installer.test.ts` 或 `src/utils/__tests__/host-adapters.test.ts` 的模板渲染断言，确认三个安装后 SKILL 均包含对应推理档字段和“非空才传”规则，且不出现任何模型名到档位的硬编码映射；运行 `pnpm vitest run src/utils/__tests__/installer.test.ts src/utils/__tests__/host-adapters.test.ts` 验证通过。

## 4. 集成验证

- [ ] 4.1 运行 `openspec validate --changes subagent-reasoning-effort`，确认 proposal/design/tasks/spec 结构与引用合法。
- [ ] 4.2 运行 `pnpm typecheck && pnpm build && pnpm test`，确认类型检查、构建与全量测试全部通过。
- [ ] 4.3 运行 `node bin/lycx.mjs doctor` 做本机烟测；若本机未配置三个推理档，确认 doctor 仍显示未配置且检查通过，若已配置则确认原值被展示且不被判为格式错误。
