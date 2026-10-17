# lyx workflow 问题整理（2026-10-10）

来源：在 `/Users/ly/codes/timesheet` 用 `@lyx-explore` → `@lyx-propose` 编排一个全新项目时（仓库此前无任何提交、无 OpenSpec）暴露的问题。

环境：macOS + zsh、Codex 宿主、openspec CLI 1.13.0、`lyx` 命令由 `npx -y ly-workflow-codex` 提供（`lycx` 不在 PATH）。

---

## 1. `lyx-explore` 前置快照扫描在 zsh 下直接报错

**严重度**：中

**位置**：`lyx-explore/SKILL.md` 进入前扫描段

```bash
ls openspec/changes/*/review-findings.md 2>/dev/null
ls openspec/changes/archive/*/review-findings.md 2>/dev/null
```

**现象**：zsh 默认 `nomatch` 行为在 glob 不匹配时会让整条命令失败，且报错发生在 glob 展开阶段，`2>/dev/null` 无法抑制：

```
zsh:1: no matches found: openspec/changes/*/review-findings.md
```

**影响**：skill 约定"无命中 → 直接进入探索流程"，但实际会先抛错。若 agent 未谨慎处理，容易把"没有快照"误判成"扫描失败"，与 skill 里"读取失败要如实注明、不得静默"的规则混淆。

**建议**：改用不依赖 shell glob 的写法，例如

```bash
find openspec/changes -maxdepth 2 -name review-findings.md 2>/dev/null
find openspec/changes/archive -maxdepth 2 -name review-findings.md 2>/dev/null
```

或在脚本头部显式 `setopt null_glob` 并注明依赖 zsh。

---

## 2. `lycx openspec ensure` 被家目录遗留的 openspec root 截胡

**严重度**：高

**现象**：`/Users/ly/openspec` 存在一份 9-18 留下的空骨架（只有 `changes/archive`、空的 `specs/`、默认 `config.yaml`）。此后在**任意子目录项目**里：

```
$ openspec context --json
{ "root": { "path": "/Users/ly", "source": "nearest", "role": "openspec_root" } }
```

`openspec doctor --json` 也报 `healthy: true`。而 `lycx openspec ensure --host codex --yes --json` 返回：

```json
{ "root": { "status": "healthy", "doctor": { "root": { "path": "/Users/ly", "source": "nearest", "healthy": true } } },
  "actions": null, "executed": [] }
```

即：**不会在项目里建 openspec root**。

**影响**：`@lyx-init` 步骤 2 的判据是 `root.status === "healthy"` 就继续，于是在一个没有 OpenSpec 的项目里这一步会"假通过"。接着 `@lyx-propose` 的 change 产物会被写到 `/Users/ly/openspec/changes/<name>/`，而不是项目仓库里——产物位置错误且极难发现（`git status` 里看不到任何东西）。

**建议**：

1. ensure / doctor 判定 root 健康时，补充"最近 root 是否位于当前项目"的校验：root 不在 cwd 之下（尤其 root 恰为 `$HOME` 而 cwd 不是 `$HOME`）应判为 `unhealthy` 或新增状态值（如 `outside-project`），并给出 `openspec init` 建议。
2. `@lyx-init` 增加一步：ensure 返回的 `root.path` 必须位于当前仓库顶层之下，否则停止并要求初始化，而不是仅看 `healthy`。
3. （可选）当 root 落在 `$HOME` 且 cwd 在 `$HOME` 之下时，打印显式告警，提示该 root 是"家目录兜底根"，可能截胡所有子项目。

---

## 3. `lyx-propose` 的 worktree 选项缺少"仓库无提交"前置检查

**严重度**：中

**位置**：`lyx-propose/SKILL.md` 步骤 1「隔离 worktree」分支第 4 步

```
git worktree add -b <开发分支名> /Users/ly/.ly/worktrees/<项目名>/<开发分支名> <当前分支HEAD>
```

**现象**：当仓库处于 unborn branch（`git log` 报 `your current branch 'main' does not have any commits yet`）时没有任何 commit 可切，该命令必然失败。

**影响**：三选一里"隔离 worktree"被呈现为可用选项，但选了只会撞到 git 报错；用户需要自己判断为什么不可用。本次会话即遇到该状态（仓库刚初始化、`src/` 全部未跟踪）。

**建议**：呈现选项前先做前置检查：

```bash
git rev-parse --verify HEAD >/dev/null 2>&1 || echo "no-baseline-commit"
```

无提交时禁用"隔离 worktree"选项（或明确标注"需先创建 baseline commit"），并说明原因与恢复路径。

---

## 4. 「留在当前分支」场景复用 WIP commit 文案，语义不符

**严重度**：低

**位置**：`lyx-propose/SKILL.md` 步骤 1「留在当前分支」分支

> WIP commit 选项将改动提交到当前分支，message 与暂存命令（含快照排除）沿用同一文案

**现象**：复用文案为 `chore(wip): 切分支前暂存工作区改动`，但该场景**并不发生切分支动作**；若该提交恰好是仓库的首个提交（本次即如此），"切分支前暂存"就更加文不对题。

**建议**：按场景参数化文案。例如：

- 切新分支路径：`chore(wip): 切分支前暂存工作区改动`
- 留在当前分支路径：`chore: 暂存工作区改动`

---

## 5. 两条初始化路径产物不一致（`@lyx-init` 的 ensure 与 `openspec init`）

**严重度**：低（一致性）

**现象**：

- `@lyx-init` 走 `lycx openspec ensure`：本次返回 `skills.status: "global-only"`，明确"不自动固化项目级"。
- 由于 ensure 未建项目 root（见问题 2），实际改用 `openspec init --tools codex` 后，仓库里多出 `.agents/skills/`（5 个 openspec-* skill 副本 + `.openspec-target`）与 `openspec/`。

两条路径对"项目级 skill 是否落盘"给出相反结果，且都不生成 `AGENTS.md`（`@lyx-init` 步骤 1 由 agent 自行生成，`openspec init` 不生成）。

**建议**：明确一条规范路径并让另一条对齐——要么 ensure 在项目 root 缺失时直接给出 `openspec init` 的可执行建议（含 `--tools` 参数），要么在 `@lyx-init` 文档里写清"先 init、再 ensure"的顺序与各自产物。

---

## 复现清单（最小化）

1. 在 `$HOME` 下留一个 `openspec/` 骨架（空 `specs/` 即可）。
2. `mkdir -p /tmp/probe && cd /tmp/probe && git init -q && openspec context --json` → root 应为 `/Users/<user>`。
3. `npx -y ly-workflow-codex openspec ensure --host codex --yes --json` → `root.status=healthy`、`actions=null`、`executed=[]`。
4. 在未提交任何 commit 的仓库里跑 `@lyx-propose`，选择"隔离 worktree" → `git worktree add` 失败。
5. 在 zsh（默认 `nomatch`）下执行 `ls openspec/changes/*/review-findings.md 2>/dev/null` → 报 `no matches found`。
