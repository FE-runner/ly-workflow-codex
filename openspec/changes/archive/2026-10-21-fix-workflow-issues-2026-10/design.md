## Context

见 `proposal.md` - Why 与 `docs/lyx-workflow-issues-2026-10-10.md`。关键约束：

- root 判定当前只信任 `openspec doctor` 的 `root.healthy`（`src/utils/preflight.ts`），不校验位置。
- `ensureOpenspec` 已有 `init-root` 动作（`root.status === 'missing'` 时触发），可复用。
- `@lyx-propose` 的隔离询问与 WIP 文案都在 `templates/skills/propose.md`；`@lyx-explore` 的扫描在其模板顶部。

## Goals / Non-Goals

**Goals:** 让 root 位置错误变成显式、可修复、可测试的状态；让隔离选项与 WIP 文案贴合实际场景；消除 zsh glob 报错。

**Non-Goals:** 不改 `openspec init` 本身；不自动删除家目录 root；不改 review/apply/archive 流程。

## Decisions

**D1：explore 扫描改用 `find`。**
`ls glob` 在 zsh `nomatch` 下于展开阶段失败，重定向无法抑制。`find openspec/changes -maxdepth 2 -name review-findings.md` 不依赖 shell glob，且输出仍为路径清单，行为不变。

**D2：新增 `outside-project` 状态，而不是把位置错误塞进 `unhealthy`。**
`unhealthy` 已表示 doctor 执行失败或环境异常；位置错误需要不同的提示与修复动作（在项目内 `openspec init`）。项目顶层取 `git rev-parse --show-toplevel`，失败时用 cwd；用 `path.relative(top, rootPath)` 判断是否越界（`..` 开头或绝对路径即越界），路径先 `realpath` 归一化。

**D3：ensure 把 `outside-project` 当 `missing` 处理。**
都可被 `init-root` 修复；`allowWrite` 为真时执行，否则只报告并给 `openspec init` 指引。执行后重新检查一次，避免"命令成功但状态未变"。

**D4：unborn HEAD 时禁用 worktree 选项。**
`git worktree add ... <HEAD>` 在无提交仓库必然失败；在呈现选项前用 `git rev-parse --verify HEAD` 探测，禁用并说明需要 baseline commit。另两项不受影响。

**D5：WIP 文案按路径参数化。**
切新分支才有"切分支前"语义；留在当前分支用 `chore: 暂存工作区改动`。暂存命令与快照排除保持同一份。

**D6：init 路径规范顺序写入 `@lyx-init`。**
统一为「先 `openspec init`（项目级 root/skills），再 `lycx openspec ensure`（校验与补齐）」；ensure 在 root 缺失或 `outside-project` 时给出同样的可执行建议，避免两条路径产物相反。

## Risks / Trade-offs

- **monorepo 把 root 放在仓库上层** → 会被判 `outside-project`。这是有意的收紧；README/AGENTS 需说明"root 必须在项目顶层或其下"。
- **symlink / 大小写路径** → 统一 `realpath` 后比较；无法 realpath 时退回字符串比较并在报告中注明。
- **ensure 自动 init 的写入风险** → 沿用既有 `allowWrite` + 用户确认门禁，不新增自动写入路径。
- **测试覆盖** → preflight 单测覆盖 outside-project / 项目内 / ensure 修复三种场景。

## Migration Plan

- 无配置字段变更。已有家目录兜底 root 的用户升级后 `doctor` 会从 healthy 变为 `outside-project`，需在项目内执行 `openspec init`（或 `lycx openspec ensure --host <host>` 确认修复）。
- 回滚：还原 `preflight.ts`/i18n/模板与主 spec 即可。
