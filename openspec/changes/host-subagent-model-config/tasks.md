## 1. 建议档位清单按宿主提供

- [ ] 1.1 在 `src/utils/host-adapters.ts` 的 `HostAdapter` 增加只读建议档位清单字段（如 `reasoningEffortSuggestions`），由 `src/hosts/codex/adapter.ts` 提供 `minimal` / `low` / `medium` / `high` / `max`、`src/hosts/claude/adapter.ts` 提供 `low` / `medium` / `high` / `xhigh` / `max`；验证：`pnpm typecheck` 通过，且共享层不再出现按宿主名选择清单的分支（`rg "host === 'claude'|host === 'codex'" src/utils src/commands` 无新增命中）
- [ ] 1.2 改造 `src/utils/model-candidates.ts` 的 `buildReasoningEffortChoices` 接收清单参数（不再引用单一常量），并更新 `src/commands/init.ts`、`src/commands/menu.ts` 的调用点；验证：`pnpm typecheck` 通过，两个宿主的建议清单断言各一条
- [ ] 1.3 更新 `src/utils/__tests__/model-candidates.test.ts`：按传入清单渲染候选、既有值不在清单内仍追加并默认选中、自定义输入入口保留；验证：`pnpm vitest run src/utils/__tests__/model-candidates.test.ts` 通过

## 2. init 采集面统一

- [ ] 2.1 从 `src/commands/init.ts` 的 `collectCodexHostConfig` 中抽出宿主无关的采集步骤（执行者二连 → 模型二连 → 推理档二连，输入既有值 defaults 与宿主建议清单），供两个宿主共用；验证：`collectCodexHostConfig` 行为不变（既有 codex init 测试全绿），函数不再内联模型 / 推理档采集细节
- [ ] 2.2 `collectClaudeHostConfig` 改为调用该共享步骤，实现执行者二连 → 模型二连 → 推理档二连，`main` 执行者下保留既有值不采集；验证：新增测试断言 claude 交互安装出现四个字段的采集、写入 `~/.claude/lyx/config.toml` 的宿主配置节，且不出现 provider 配置步骤
- [ ] 2.3 `printSummary` 的 claude 分支按已配置展示模型与推理档（未配置仍按"继承当前会话"标注），并保留 `main` 执行者下的"不生效"标注；验证：新增测试断言 claude 摘要分别展示模型值与推理档状态
- [ ] 2.4 补充 `src/commands/__tests__/init.test.ts` 回归：claude 全新安装（执行者 main）不采集模型、claude 选择 subagent 后采集模型与推理档、非交互 `--skip-prompt` 保留既有四字段；验证：`pnpm vitest run src/commands/__tests__/init.test.ts` 通过

## 3. 菜单采集面统一

- [ ] 3.1 把 `src/commands/menu.ts` 的配置入口改造为通用流程（执行者二连 → 模型二连 → 推理档二连 → read/merge/write → 重渲染产物），替换仅审查侧实现与 `configClaudeExecutors`；验证：新增测试断言两个宿主写回六个字段、未触碰字段保留既有值、写回后触发重渲染
- [ ] 3.2 菜单标签与 i18n key 由「配置审查模型」改名为「配置执行者与模型」（zh-CN / en 同步）；验证：`rg -n "configReviewModel|配置审查模型" src` 零命中，菜单渲染测试通过
- [ ] 3.3 补充 `src/commands/__tests__/menu.test.ts` 回归：codex 菜单新增编码侧提问并按选择写回 `codingExecutor` / `codingModel` / `codingReasoningEffort`；claude 菜单新增审查侧模型与推理档提问且保留执行者二连；两侧"显式选择不覆盖"仍清除对应推理档；验证：`pnpm vitest run src/commands/__tests__/menu.test.ts` 通过

## 4. 文案与文档同步

- [ ] 4.1 更新 `src/i18n/index.ts` 的 zh-CN / en 文案：claude 采集提示（由"只采集执行者"改为与 codex 同口径）、菜单标签、配置摘要相关条目；验证：`src/i18n/__tests__/i18n.test.ts` 中针对 `init:claude.executorHint` 的 `/inherit/` 断言按新文案同步且通过
- [ ] 4.2 同步 `README.md`、`AGENTS.md`、`CLAUDE.md` 中"claude 只采集执行者 / 不采集模型与推理档"的表述；验证：`rg -n "只采集执行者|不采集模型|模型与推理档不采集" README.md AGENTS.md CLAUDE.md src` 零命中
- [ ] 4.3 更新 `src/commands/__tests__/host-ops.test.ts` 与 `src/hosts/claude/__tests__/claude-host.test.ts` 中依赖旧采集边界的断言；验证：`pnpm vitest run src/commands/__tests__/host-ops.test.ts src/hosts/claude/__tests__/claude-host.test.ts` 通过

## 5. 收尾

- [ ] 5.1 在 `CHANGELOG.md` 顶部新增本次条目，标注 claude 采集面扩展与菜单交互行为变更（BREAKING 交互变更：codex 菜单新增编码侧提问）；验证：条目位于 `Unreleased` 或最新版本段顶部且措辞与 proposal 的 What Changes 一致
- [ ] 5.2 确认边界未被突破：`rg -n "settings\\.json" src` 不出现对宿主自身配置文件的读写；验证：`pnpm typecheck && pnpm build && pnpm test` 全绿
