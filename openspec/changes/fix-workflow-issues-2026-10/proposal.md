## Why

`docs/lyx-workflow-issues-2026-10-10.md` 记录的五条问题经逐一复核仍然存在，其中 issue 2 为高严重度：家目录遗留的 `/Users/ly/openspec` 会让任意子项目解析到该兜底 root，`ensure` 返回 healthy，change 产物被写到仓库之外且 `git status` 看不到。

## What Changes

- **issue 1**：`@lyx-explore` 的快照扫描由 `ls` glob 改为 `find`，消除 zsh `nomatch` 报错（行为不变：仍扫描 active 与 archive 两处）。
- **issue 2**：OpenSpec root 判定新增 `outside-project` 状态——`root.path` 不在当前项目顶层之下时不再判 healthy；`ensure` 在允许写入时按 `init-root` 修复，否则给出 `openspec init` 指引；`@lyx-init` 步骤 2 增加 root 位置校验。
- **issue 3**：`@lyx-propose` 在呈现隔离方式前检查 `git rev-parse --verify HEAD`；无提交时禁用"隔离 worktree"选项并说明原因与恢复路径。
- **issue 4**：WIP commit 文案按路径参数化——切新分支用 `chore(wip): 切分支前暂存工作区改动`，留在当前分支用 `chore: 暂存工作区改动`。
- **issue 5**：`@lyx-init` 写明规范顺序「先 `openspec init`、再 `lycx openspec ensure`」及各自产物，使两条路径口径一致。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `installer-preflight-checks`: OpenSpec root 三层检查中的 root 判定新增 `outside-project` 状态与对应修复/提示行为。
- `worktree-create-before-propose`: 隔离 worktree 选项增加 unborn-branch 前置检查；WIP commit 文案按隔离路径参数化。

## Impact

- CLI：`src/utils/preflight.ts`（root 判定、ensure 动作、打印）、`src/i18n/index.ts`（zh-CN/en 新文案）、相关测试。
- 模板：`templates/skills/explore.md`、`templates/skills/propose.md`、`templates/skills/init.md`。
- 文档：`AGENTS.md` 的 preflight 描述如需同步。
- 兼容：无配置字段变更；`outside-project` 是新状态值，旧调用方按非 healthy 处理即可。属行为变更，下一次发版为 0.11.x。
