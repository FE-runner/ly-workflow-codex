# 软上下文（讨论结论，非文档复述）

需求与规格见 `proposal.md` / `specs/subagent-agent-config/spec.md`；实现取舍见 `design.md`。本文件只记录讨论过程里产生、文档之外的决策与坑。

## 关键决策与理由

- 用户目标原话："claude 的 workflow 的子模型配置在 init 时可以像 codex 那边可以配置就行了——模型名称、思考强度"。菜单入口是用户后续追加的要求，不是首发需求。
- 菜单方案最终确定为"两宿主都补齐为执行者二连 + 模型二连 + 推理档二连"（讨论中称"口径二"）。用户先选过"只让 claude 对齐 codex 菜单现状"（口径一），随后改为口径二，理由是口径一做完之后 claude 的实施侧模型仍只有 init 一个入口。
- 建议档位清单按宿主分：claude 用 `low`/`medium`/`high`/`xhigh`/`max`（Claude Code 的 `effort` 不认 `minimal`、多一个 `xhigh`），codex 保持 `minimal`/`low`/`medium`/`high`/`max`。用户明确选择"按宿主分列表"。
- 用户明确选择"不加额外说明"：向导里不解释"审查模型同时作用于 plan-review 与 review-code"——理由是 codex 侧同样没说明，保持口径一致。
- 用户明确说"claude 的 config 我自己会改"，因此实现不得触碰 Claude Code 自身的配置；交互采集只写 `~/.claude/lyx/config.toml` 与子代理定义。

## 已否决的备选

- 菜单只补审查侧（口径一）：会导致 claude 的 `codingModel` 仍无菜单入口，需求没真正解决；已被用户否决。
- 菜单只做 claude 二连、codex 保持仅审查侧：会引入新的跨宿主不对称；已否决。
- 从 provider / relay 的 `/v1/models` 拉取模型候选：越过"不读宿主 provider 配置"的边界，且引入对外部服务的依赖；已否决。
- 把建议档位清单放在共享层按宿主名分支：违反 `multi-host-install` 的"宿主适配层与共享安装流程解耦"约束；已否决，改为挂 `HostAdapter`。
- 为 claude 复制一份采集实现：两份实现无法发现漂移；已否决，改为抽出共享采集步骤。

## 范围边界（明确不做）

- 不改子代理定义的渲染格式与 `doctor` 的判定口径（两者已支持 `model` / `effort`）。
- 不改非交互路径（`--skip-prompt`）与 `lycx update` 的字段保留语义。
- 不做推理档枚举强校验，不新增对宿主自身 provider / settings 的读写。

## 已知坑与注意事项

- **Claude Code 的 `availableModels: []` 会静默吃掉子代理模型配置**：本机实测（claude 2.1.284）中该空数组会让子代理定义里的具名 `model` 被替换为继承的主会话模型，且 headless 模式不打印警告。本 change 不修改该行为，但排查"子代理模型不生效"时应先看这个字段。
- **`CLAUDE_CODE_SUBAGENT_MODEL` 管不到定义了 `model` 的子代理**：解析顺序是"调用时参数 > 定义 frontmatter（含 `inherit`）> 该环境变量 > 主会话模型"，因此 lyx 的定义文件优先。
- **`~/.claude/settings.json` 的 `env` 块会压过 shell 变量**：本机用 `ANTHROPIC_MODEL=... claude -p` 覆盖无效，实测仍走 settings 里的模型。验证模型可用性时不要依赖 shell 覆盖。
- claude 侧 `reviewModel` 同时作用于 `lyx-plan-reviewer` 与 `lyx-reviewer`（两个定义共用 `reviewModel`），`codingModel` 只作用于 `lyx-implementer`；这是既有粒度，本 change 不改。
- 本仓 `lycx init --skip-prompt` 不会覆盖已存在的命令文件（按旧安装残留跳过），但会重渲染子代理定义；改完 `[host]` 配置后这条路径可用于刷新定义。

## 实施决策（apply 阶段回写）

- 共享采集实现落在**新文件** `src/commands/collect-subagent-config.ts`（`collectSubagentConfig` + `SubagentConfigCollected`），而不是留在 `init.ts` 里——menu 需要复用同一套采集，放 init.ts 会造成 commands 之间反向依赖。
- `printSummary` **无需改动**：它本来就按宿主无关的口径渲染四个字段（claude 仅影响空值时的"继承当前会话"文案豁免）。因此该任务改为补测试锁定行为，而不是改实现。
- 菜单测试落在**新文件** `src/commands/__tests__/menu-config.test.ts`（原 `menu.test.ts` 的菜单结构断言保持不变）；`configExecutorsAndModels` 为测试导出，与既有 `pickInstalledHostsWith` 的测试导出惯例一致。
- `buildReasoningEffortChoices` 的 `suggestions` 改为**必填参数**，共享常量 `REASONING_EFFORT_SUGGESTIONS` 删除；建议清单只在两个宿主适配器里各定义一份。
- 两个 README 的"维护方式 = 手改配置（编辑交互入口为后续增强 / an interactive editor is planned）"按实际主语改写为显式限定 `spawnableModels`（该字段本次仍无交互入口），而不是删除整句。
- `CLAUDE.md` 经检索不含旧采集口径表述（它是精简导航，正文以 AGENTS.md 为准），本次未改动该文件。

## 实施期间发现的坑

- **`pnpm lint` 在本仓 HEAD 上并非全绿**：`src/utils/__tests__/host-adapters.test.ts` 有 3 处 quote/prefer-template 报错，`package.json` 的 `files` 数组排序与若干 `openspec/changes/archive/**` 文档同样报错。本次只保证改动文件的 lint 干净，未顺带修复这些无关项（发版规则的门禁是 `typecheck && build && test`，不含 lint）。
- **import 排序规则（perfectionist/sort-imports）**：type-only import 需归组在前，且同一模块的 type import 必须排在 value import 之前，否则报 `Expected "./x" (sibling-type) to come before ...`。新增共享模块的引用时先跑一次 eslint 可省一轮返工。
