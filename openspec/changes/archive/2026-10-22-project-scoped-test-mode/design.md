## Context

参见 `proposal.md` 的 Why 与 `specs/test-mode/spec.md` 的行为契约。当前 `testMode` 只通过 `[host]` 读取；配置由每个宿主的 `config.toml` 持有，`lycx init` 会用 `createDefaultConfig` 重建整份配置，菜单则读取后局部改写。工作流模板和审查角色词直接读取宿主配置文件中的 `[host].testMode`。

本变更必须同时覆盖配置存储、配置保留、项目路径归一、有效值解析、CLI 管理、doctor/status 展示和六类工作流模板。只在 CLI 层增加路径条目而保留模板的全局读取，会造成新配置看似写入但不生效。

## Goals / Non-Goals

**Goals:**

- 在既有宿主配置文件中提供路径键 `testMode` 覆盖，保持配置仍是每宿主一个自包含文件。
- 让普通仓库子目录与 linked worktree 归一到同一主仓库根键。
- 用一套共享解析规则同时服务 CLI、doctor/status 与工作流模板。
- 保持无项目覆盖用户的既有行为与配置升级兼容。
- 对非法项目覆盖、冲突路径键与配置读取失败提供可审计结果。

**Non-Goals:**

- 不新增项目级独立配置文件。
- 不把 `reviewMode`、执行者或模型字段扩展到项目级。
- 不提供命令级单次 `testMode` 覆盖或环境变量覆盖。
- 不自动迁移、规范化或删除用户已有的任意 `[projects]` 原始键。
- 不改变 `normal` / `off` 取值集合或无测试模式对非测试门禁的保留规则。
- 不提供跨进程配置写锁；并发执行多个 lyx 配置写入命令时仍为最后写入者生效，命令需如实报告自己的写入结果。

## Decisions

### D1. 在 `LyConfig` 顶层增加路径键项目表

配置结构使用：

```toml
[host]
testMode = "normal"

[projects."/canonical/main-repository-root"]
testMode = "off"
```

`src/types/index.ts` 增加项目条目可选 `testMode` 字段与 `LyConfig.projects`。项目条目只解释 `testMode`；其他字段按未知字段原样保留，避免当前版本静默删除未来字段。`smol-toml` 已验证该结构可稳定 stringify / parse。

替代方案是项目根 `lyx/config.toml` 或全局数组 `[[projects]]`。前者被用户明确排除；后者避免重复路径键，但不如 TOML 表直观，也无法让同一路径的更新天然覆盖旧值。

### D2. 项目键归一到主仓库根

新增共享项目路径解析，输入为当前工作目录：

1. 在 Git 仓库内同时读取 `git rev-parse --show-toplevel`、`--git-dir`、`--git-common-dir` 与 `--show-superproject-working-tree`，并把相对结果按 cwd 转绝对、`realpath` 归一。
2. `--show-superproject-working-tree` 非空时判定为子模块，项目键取子模块自身 `--show-toplevel`，不归并到 superproject。
3. 非子模块且 `git-dir` 与 `git-common-dir` 相同时，当前目录是普通 checkout（包含 separate-git-dir），项目键取 `--show-toplevel`。
4. 非子模块且 `git-dir` 与 `git-common-dir` 不同时，当前目录是 linked worktree。先以 common git dir 为 `--git-dir` 探测 `git rev-parse --is-bare-repository`：bare 时取当前 worktree 的 `--show-toplevel`。非 bare 时依次尝试 `core.worktree`，以及 common dir 父目录下的候选 `.git`：候选必须显式以 `--git-dir=<candidate>` 可解析，且规范化 git dir 等于当前 common git dir，才可判定为主 checkout。两者都无法确认主工作树时，取当前 worktree 的 `--show-toplevel`，不得猜测 common dir 父目录。
5. 不在 Git 仓库内或 Git 解析失败时，使用 `realpath(cwd)`；目录不存在时回退 `path.resolve(cwd)`。
6. 返回规范化绝对路径，并保留“解析来源”（git-root / submodule-root / worktree-main-root / worktree-root-bare / worktree-root-unresolved / cwd）供 doctor 展示。

替代方案继续使用 `--show-toplevel` 会让每个 linked worktree 拥有独立配置键，与已确认方案冲突。`--show-superproject-working-tree` 不作为主键来源；子模块按自身 Git 仓库处理。

现有 `src/utils/preflight.ts` 的 `resolveProjectRoot` 继续服务 OpenSpec root 校验，不修改其语义；测试模式使用独立的项目配置键解析，避免把两种“项目根”概念混在一起。

### D3. 有效值解析返回模式、来源与诊断

新增单一解析函数，返回至少：

```ts
interface EffectiveTestModeResolution {
  mode: 'normal' | 'off'
  source: 'project' | 'host' | 'default'
  projectPath: string
  matchedProjectKey?: string
  warnings: string[]
}
```

解析顺序严格按 delta spec。实现要点：

- 只做当前项目键的精确匹配，不做祖先前缀匹配；子目录与 worktree 已在 D2 归一。
- 多个原始键规范化后指向同一项目时，若有效 `testMode` 相同则视为一致；若不同则忽略覆盖并产生 doctor WARN。
- 匹配项目字段缺失、空白或非法时忽略覆盖并回退宿主默认；宿主默认非法仍按既有规则等价 `normal`。
- `projects` 不是表、项目条目不是表或字段类型非法时产生结构化诊断；doctor 输出 WARN，运行时使用回退值。
- 整个宿主配置文件不可读或 TOML 解析失败时返回“未知”，工作流在测试动作前停止。

替代方案在各模板中各自手写路径和优先级会形成六份漂移实现；本方案要求模板使用同一文字契约，doctor/status 使用同一 TypeScript 解析器。

### D4. 所有配置重写路径显式保留项目表

`readLyConfig` / `writeLyConfig` 保留 `projects`。`createDefaultConfig` 增加项目表透传入口，`lycx init` 从既有配置读取后传入；菜单已经基于完整 fresh config 局部合并 `host`，仍需在重装 smoke 中确认项目表不会因配置重建丢失。

新增面向写入链路的配置读取结果，区分 `missing` / `ok` / `invalid`，不得继续把“文件存在但不可读或 TOML 非法”折叠成 `null` 后按全新安装处理。`lycx init` / `update` 在宿主选择完成后、写入任何配置前，预检全部所选宿主的既有配置；任一配置为 `invalid` 时整体停止，报告全部路径并提示 `lycx doctor`，不写任何宿主的默认配置。普通菜单编辑读取到 `invalid` 时同样停止，不覆盖原文件。

设置命令只修改 canonical 目标路径键内的 `testMode`。`--unset` 的目标集合是所有规范化后等于当前项目根的原始键：逐项删除 `testMode`，条目为空时删除条目，条目仍含其他字段时保留；没有任何规范化等价键才视为无需移除。其他项目条目、宿主字段、路径和未知字段不做规范化或重排，保持语义等价。

替代方案让 `createDefaultConfig` 重建后再单独写回项目表会破坏“一次写入、原子失败”和未知字段保留；本方案在创建配置时即携带既有项目表。

### D5. 新增 `lycx project test-mode` 命令

`src/cli-setup.ts` 注册：

```text
lycx project test-mode normal|off [--host <hosts>]
lycx project test-mode --unset [--host <hosts>]
```

新命令模块负责：

- 复用既有 `--host` 解析；未指定时使用全部已安装宿主。
- 对每个目标宿主读取配置；配置文件不存在时报告未安装并跳过，SHALL NOT 创建新宿主安装。
- 写入前先预校验全部目标配置可读且可解析，并在每个目标配置内检查其他原始键规范化后是否指向当前主仓库根且与目标值冲突；存在任一可提前发现的目标错误或冲突键时不写入任何文件，并列出全部冲突路径键。
- 设置时写入当前规范化主仓库根对应的项目条目。`--unset` 时遍历所有规范化等价原始键并删除其 `testMode`；仅在没有任何匹配键时作为幂等成功处理。
- 参数冲突、目标宿主为空或预校验失败时以非零状态退出且不写入；多宿主实际写入中途失败时停止后续写入，并逐项报告已成功与失败的目标，不自动回滚已成功文件或猜测性修复。

该命令只管理测试模式，不复用 `collectSubagentConfig`，避免把宿主默认值采集与项目覆盖编辑混成一个交互流程。

### D6. doctor/status 展示默认值、有效值与来源

doctor 的每宿主配置检查增加三类信息：

- 宿主默认 `testMode`；
- 当前项目规范化路径与有效 `testMode`；
- 来源：项目覆盖 / 宿主默认 / 内置默认。

项目覆盖非法、重复规范化键冲突或 `projects` 结构异常输出 WARN。status 在每个宿主分组展示有效值与来源，不重复完整项目表。

宿主检查仍接收现有 `HostAdapterConfig` 用于子代理字段，但 doctor 外层需要保留完整 `LyConfig` 以解析项目表；不得把项目表压进 `[host]` 类型。

### D7. 工作流与审查角色词统一消费有效值

六个共享模板与四份审查角色词不再直接断言 `[host].testMode`，改为明确要求：

1. 读取当前宿主 `{{LYX_CONFIG_FILE}}`；
2. 按主仓库根规则定位当前项目键；
3. 按项目覆盖 > 宿主默认 > normal 解析有效值；
4. 项目覆盖来源为 `off` 时，跳过状态写明 `testMode=off（项目配置）`；宿主默认来源可写 `testMode=off（宿主默认）`。

共享模板中的规则文本保持一致，并使用 `rg` 静态检查六模板与四份角色词都包含项目覆盖、主仓库根、来源与回退规则。当前有效 `testMode=off`，本 change 不新增或修改测试文件；配置不可读时仍停止并提示 `lycx doctor`。

### D8. 宿主默认采集文案改为“默认值”

`lycx init` 与菜单保留现有的宿主默认采集，不把项目键编辑塞进安装向导。i18n 标题、hint、摘要与菜单状态改写为“默认测试模式（未命中项目覆盖时生效）”，避免用户误以为它仍是所有项目的最终值。

项目覆盖通过 D5 命令显式管理，doctor/status 提供当前项目结果。该分工避免安装命令隐式修改用户当前项目。

## Risks / Trade-offs

- **路径移动或仓库重命名导致项目条目失配** → doctor 展示规范化路径与来源，用户可通过 `lycx project test-mode` 在新路径重建；不自动删除旧条目。
- **worktree 共享同一键可能超出一个用户预期** → 这是已确认语义；文档和 doctor 明确展示主仓库根，不使用 worktree 自身路径。
- **六份模板/四份角色词发生读取规则漂移** → 对六份共享模板与四份角色词执行同一组 `rg` 静态规则检查。
- **`init` 重建配置丢失项目表** → `createDefaultConfig` 显式接收并透传；通过重装 smoke、菜单编辑与 update 路径核对保留。
- **非法项目条目静默改变测试义务** → 非法覆盖不参与解析并回退宿主默认，doctor 输出 WARN；整个配置不可读则停止测试动作。
- **绝对路径配置跨机器不可移植** → 配置是宿主本地文件，不随项目仓库提交；每台机器独立维护自己的项目条目。
- **重复路径键造成不确定结果** → 规范化后冲突且值不同则忽略覆盖并告警，不按 TOML 枚举顺序猜测。
- **管理命令写入一个被冲突覆盖遮蔽的新键** → 写入前检查规范化等价键；存在冲突时整体失败且不写，避免“命令成功但运行时不生效”。
- **重装覆盖不可读配置** → 配置读取区分 missing/ok/invalid；任何所选宿主 invalid 时在写入前整体停止。
- **并发写入造成后写覆盖前写** → 保持现有单用户 CLI 语义并明确最后写入者生效；本变更不引入跨进程锁，命令逐项报告实际写入结果。

## Migration Plan

1. 扩展配置类型、清洗与保留逻辑，并加入项目路径解析与有效模式解析。
2. 修正 `lycx init` / 配置创建链路，确保既有 `[projects]` 重装不丢，并阻止不可读配置被默认配置覆盖。
3. 新增 `lycx project test-mode` 与 i18n/help 文案。
4. 接入 Codex / Claude doctor 与 status。
5. 更新六个工作流模板、四份审查角色词与静态规则检查。
6. 更新 AGENTS / CLAUDE / 双语 README。
7. 当前有效 `testMode=off`：不运行测试命令；执行配置/CLI 手工 smoke、`rg` 静态检查、`pnpm typecheck`、`pnpm build` 与 OpenSpec 校验。

升级兼容：已有配置没有 `[projects]` 时行为与当前版本一致；已有全局 `testMode` 自动成为宿主默认值，无需迁移。回滚可恢复旧模板与配置读写代码，磁盘中的 `[projects]` 会被旧版本忽略但不会被自动删除。
