## Context

当前 `src/utils/preflight.ts` 只有两个检测点：`openspec --version` 与“任一 `openspec-*` skill 是否存在”。`lycx init`、`@lyx-init` 与 `lycx doctor` 分别消费不同粒度的结果；`@lyx-init` 是模板提示词，运行时无法直接 import TypeScript 检测器。已确认的边界是：`lycx init` 默认不得创建或修复当前项目 `openspec/`，但两个入口的检测、判定、建议动作应尽量一致；`global-only` skills 是合法可用状态，但必须 WARN。

## Goals / Non-Goals

**Goals:**

- 用同一个 OpenSpec 依赖检查模型覆盖 CLI、skills、root 三层。
- skills 检查按 OpenSpec workflow profile 推导 required skill，并逐个解析安装来源。
- `lycx init` 默认只诊断；`@lyx-init` 与显式 `lycx init --init-openspec` 共用同一套修复动作。
- `lycx doctor` 展示与前置检查一致的 CLI、skills、root 状态。

**Non-Goals:**

- 不让 `lycx init` 默认创建 `openspec/` 或安装项目级 skills。
- 不用 `openspec doctor` 替代 CLI 或 skills 检测。
- 不改变 `@lyx-apply` / `@lyx-review-code` 对本地 change 目录和 git diff 的依赖。
- 不引入自动 archive 或改变全自动 propose 流水线终止语义。

## Decisions

### 决策 1：共享检查器返回结构化事实与建议动作

在 `src/utils/preflight.ts` 实现统一 `inspectOpenspec()`，返回：

```ts
interface OpenspecInspection {
  cli: { status: 'ok' | 'missing' | 'unhealthy'; version?: string }
  skills: {
    status: 'project-ready' | 'global-only' | 'missing' | 'unknown'
    required: string[]
    resolved: Record<string, string>
    missing: string[]
    roots: string[]
  }
  root: { status: 'healthy' | 'missing' | 'unhealthy' | 'not-checked'; doctor?: unknown }
  actions: OpenspecAction[]
}
```

`actions` 是建议动作清单，如 `install-cli`、`init-root`、`repair-skills`、`report-root`。状态判定与动作生成只实现一次；调用方只决定是否允许执行动作。

备选方案：每个入口各自实现 shell 检查。否决，因为 `@lyx-init` 模板与 TypeScript 代码会漂移。

### 决策 2：skills required 清单来自 OpenSpec profile

检查器在 CLI 可用时运行 `openspec config list --json`，读取 `workflows`，并用固定映射转换为 skill 目录名：

```text
explore       -> openspec-explore
propose       -> openspec-propose
apply         -> openspec-apply-change
sync          -> openspec-sync-specs
archive       -> openspec-archive-change
new           -> openspec-new-change
continue      -> openspec-continue-change
update        -> openspec-update-change
ff            -> openspec-ff-change
bulk-archive  -> openspec-bulk-archive-change
verify        -> openspec-verify-change
onboard       -> openspec-onboard
```

若 `openspec config list --json` 失败，检查器 SHALL 降级为默认 profile 的 required 清单并输出 `unknown`/WARN 口径，SHALL NOT 静默按空清单通过。

备选方案：硬编码当前 4 个或 5 个 skill。否决，因为 OpenSpec profile 可配置，且后续 workflow 会变化。

### 决策 3：skills 扫描多根目录，项目级优先

扫描根按顺序解析：

```text
<project>/.agents/skills
<project>/.codex/skills
~/.agents/skills
~/.codex/skills
```

每个 required skill 记录实际命中路径。项目级存在时优先于全局级；全部只在全局级命中时状态为 `global-only`；任一无命中时状态为 `missing`。`global-only` 输出 WARN 并继续，不自动修复；只有 `missing` 才生成 `repair-skills` 动作（root 存在时 `openspec update --force`，root 缺失时先 `openspec init --tools codex`）。

备选方案：只检查 `~/.agents/skills` 与项目 `.agents/skills`。否决，因为当前 OpenSpec Codex 目标包含 legacy `.codex/skills`，实际机器也可能有全局 `~/.agents/skills` 安装。

### 决策 4：`openspec doctor --json` 只作为 root 健康层

CLI 与 root 都存在时，检查器运行 `openspec doctor --json` 并读取 `root.healthy` 与 `status[]`。若返回 `no_openspec_root`，映射为 `root.missing`，不是 CLI 失败；其他 error status 映射为 `root.unhealthy`。

备选方案：用 `openspec doctor` 作为总检查。否决，因为运行它需要 CLI 已存在，且它不检查 `.agents/skills/openspec-*`。

### 决策 5：通过 CLI 子命令暴露共享检查与修复，避免模板漂移

新增 CLI 子命令：

```bash
lycx openspec inspect --json
lycx openspec ensure --json
```

`inspect` 只读，返回完整 `OpenspecInspection` JSON。`ensure` 执行可修复动作：CLI 缺失时安装（交互模式询问，`--yes` 时自动确认），root 缺失时 `openspec init --tools codex`，skills `missing` 时 `openspec update --force`（必要时回退 `openspec init --tools codex`），随后重新 inspect 并校验 root 健康。`global-only` 不是可修复状态，`ensure` SHALL 输出 WARN 并继续。

`@lyx-init` 模板改为调用 `lycx openspec ensure --yes --json`；若 `lycx` 不在 PATH，则使用 `npx -y ly-workflow-codex openspec ensure --yes --json`。`lycx init --init-openspec` 复用同一个 `ensure` 实现；`lycx init` 默认只调用 `inspect` 并打印结果。

备选方案：`@lyx-init` 直接运行 `openspec` 命令。否决，因为修复策略会在模板中复制一份，无法与 `lycx init --init-openspec` 保持一致。

### 决策 6：状态与动作按入口分级执行

| 状态/动作 | `lycx init` 默认 | `lycx init --init-openspec` | `@lyx-init` | `lycx doctor` |
|---|---|---|---|---|
| `cli.missing` | WARN + 询问安装 | 询问安装后继续 | 安装后继续 | 展示 |
| `skills.project-ready` | 静默 | 静默 | 静默 | 正常 |
| `skills.global-only` | WARN，继续 | WARN，继续 | WARN，继续 | WARN |
| `skills.missing` | WARN + 缺失清单 | `repair-skills` 后复查 | `repair-skills` 后复查 | WARN |
| `root.missing` | WARN + 提示 `@lyx-init` | `init-root` 后复查 | `init-root` 后复查 | WARN |
| `root.unhealthy` | WARN | 报告并停止 | 报告并停止 | WARN |

## Risks / Trade-offs

- [新增 `lycx openspec inspect/ensure` 公共面] → 仅作为 OpenSpec 依赖检查/修复入口，文档和 help 标明用途；内部函数仍由 `init`/`doctor` 直接复用。
- [`@lyx-init` 通过 `npx` 调用 lyx CLI 可能触发网络] → 优先使用 PATH 上的 `lycx`，仅缺失时回退 `npx -y`；本包文档已以 `npx ly-workflow-codex` 为入口。
- [`openspec config list --json` 或 `openspec doctor --json` 输出随上游变化] → 解析集中在 `inspectOpenspec()`；失败时降级为 `unknown`/WARN，避免误判为通过。
- [多根目录导致同名 skill shadow] → 结果记录 `resolved` 与 `roots`；项目级优先，`doctor` 展示最终命中路径，必要时提示 shadow。
- [`lycx init --init-openspec` 被误解为默认行为] → help 与文档明确默认 check-only，只有显式参数或 `@lyx-init` 才写当前项目。

## Migration Plan

1. 先落地 `inspectOpenspec()` 与单元测试，保持现有 `checkExternalDeps()` 行为兼容。
2. 接入 `lycx openspec inspect/ensure` 子命令，并让 `lycx doctor` 使用同一结果模型。
3. 更新 `lycx init`：默认 check-only，新增 `--init-openspec` 走 `ensure`。
4. 更新 `templates/skills-codex/init.md` 调用 `ensure`，并在缺失 CLI/skills/root 时按 JSON 结果报告。
5. 更新 README/AGENTS/CLAUDE 中 OpenSpec 依赖检查描述。

回滚策略：移除 `--init-openspec` 与 `openspec inspect/ensure` 子命令接入，恢复 `checkExternalDeps()` 旧行为；已由 `@lyx-init` 创建/修复的 `openspec/` 与 `.agents/skills` 属于项目级产物，不自动回滚。
